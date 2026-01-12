"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface VoiceLoginRecorderProps {
    onRecorded: (samples: Float32Array, sampleRate: number) => void;
    onError: (error: string) => void;
    maxDurationMs?: number;
    disabled?: boolean;
    className?: string;
}

const TARGET_SAMPLE_RATE = 16000;
const MIN_DURATION_MS = 1500;
const DEFAULT_MAX_DURATION_MS = 5000;

export default function VoiceLoginRecorder({
    onRecorded,
    onError,
    maxDurationMs = DEFAULT_MAX_DURATION_MS,
    disabled = false,
    className = "",
}: VoiceLoginRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [durationMs, setDurationMs] = useState(0);
    const [audioLevel, setAudioLevel] = useState(0);
    const [status, setStatus] = useState<"idle" | "recording" | "processing">("idle");

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const chunksRef = useRef<BlobPart[]>([]);
    const startTsRef = useRef<number>(0);
    const rafIdRef = useRef<number | null>(null);
    const timerRef = useRef<number | null>(null);

    // Resample PCM to target sample rate
    async function resamplePcm(
        input: Float32Array,
        fromRate: number,
        toRate: number
    ): Promise<Float32Array> {
        if (fromRate === toRate) return input;
        try {
            const lengthSeconds = input.length / fromRate;
            const offline = new OfflineAudioContext(1, Math.ceil(lengthSeconds * toRate), toRate);
            const buffer = offline.createBuffer(1, input.length, fromRate);
            buffer.copyToChannel(new Float32Array(input), 0, 0);
            const src = offline.createBufferSource();
            src.buffer = buffer;
            src.connect(offline.destination);
            src.start(0);
            const rendered = await offline.startRendering();
            return rendered.getChannelData(0).slice(0);
        } catch {
            // Fallback: linear interpolation
            const ratio = toRate / fromRate;
            const outLength = Math.round(input.length * ratio);
            const out = new Float32Array(outLength);
            for (let i = 0; i < outLength; i++) {
                const srcPos = i / ratio;
                const i0 = Math.floor(srcPos);
                const i1 = Math.min(i0 + 1, input.length - 1);
                const t = srcPos - i0;
                out[i] = input[i0] * (1 - t) + input[i1] * t;
            }
            return out;
        }
    }

    // Cleanup audio resources
    const cleanup = useCallback(() => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        try { sourceRef.current?.disconnect(); } catch { }
        try { analyserRef.current?.disconnect(); } catch { }
        streamRef.current?.getTracks().forEach(t => t.stop());
        sourceRef.current = null;
        analyserRef.current = null;
        streamRef.current = null;
    }, []);

    // Monitor audio levels during recording
    const startLevelMonitor = useCallback(() => {
        const analyser = analyserRef.current;
        if (!analyser) return;

        const dataArray = new Uint8Array(analyser.fftSize);

        const monitor = () => {
            if (!analyserRef.current) return;

            analyser.getByteTimeDomainData(dataArray);

            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const amplitude = Math.abs((dataArray[i] - 128) / 128);
                sum += amplitude;
            }
            const avgLevel = sum / dataArray.length;
            setAudioLevel(Math.min(1, avgLevel * 3));

            rafIdRef.current = requestAnimationFrame(monitor);
        };

        monitor();
    }, []);

    // Start recording
    const startRecording = useCallback(async () => {
        if (disabled || isRecording) return;

        try {
            cleanup();
            chunksRef.current = [];
            setDurationMs(0);
            setStatus("recording");

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            streamRef.current = stream;

            // Set up audio analysis
            const audioCtx = new AudioContext();
            audioCtxRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            sourceRef.current = source;
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            // Set up recorder
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : "audio/webm";
            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                const duration = durationMs;
                setStatus("processing");

                if (duration < MIN_DURATION_MS) {
                    onError(`Recording too short. Please speak for at least ${MIN_DURATION_MS / 1000} seconds.`);
                    setStatus("idle");
                    cleanup();
                    return;
                }

                try {
                    const blob = new Blob(chunksRef.current, { type: mimeType });
                    const arrayBuffer = await blob.arrayBuffer();

                    // Decode audio
                    const ctx = audioCtxRef.current || new AudioContext();
                    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                    const rawPcm = audioBuffer.getChannelData(0);

                    // Resample to target rate
                    const resampled = await resamplePcm(rawPcm, audioBuffer.sampleRate, TARGET_SAMPLE_RATE);

                    onRecorded(resampled, TARGET_SAMPLE_RATE);
                    setStatus("idle");
                } catch (err) {
                    onError("Failed to process audio recording");
                    setStatus("idle");
                }

                cleanup();
            };

            // Start recording
            recorder.start(100);
            setIsRecording(true);
            startTsRef.current = Date.now();
            startLevelMonitor();

            // Duration timer
            timerRef.current = window.setInterval(() => {
                const elapsed = Date.now() - startTsRef.current;
                setDurationMs(elapsed);

                // Auto-stop at max duration
                if (elapsed >= maxDurationMs) {
                    stopRecording();
                }
            }, 100);

        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            if (errorMessage.includes("Permission denied") || errorMessage.includes("NotAllowedError")) {
                onError("Microphone access denied. Please allow microphone permission.");
            } else {
                onError(`Could not start recording: ${errorMessage}`);
            }
            setStatus("idle");
            cleanup();
        }
    }, [disabled, isRecording, cleanup, startLevelMonitor, maxDurationMs, onRecorded, onError, durationMs]);

    // Stop recording
    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        setAudioLevel(0);
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    const formatTime = (ms: number): string => {
        const seconds = Math.floor(ms / 1000);
        const tenths = Math.floor((ms % 1000) / 100);
        return `${seconds}.${tenths}s`;
    };

    const progress = Math.min(100, (durationMs / maxDurationMs) * 100);

    return (
        <div className={`flex flex-col items-center gap-4 ${className}`}>
            {/* Voice visualization circle */}
            <div className="relative">
                <button
                    type="button"
                    disabled={disabled || status === "processing"}
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onMouseLeave={isRecording ? stopRecording : undefined}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    className={`
            relative w-28 h-28 rounded-full flex items-center justify-center
            transition-all duration-300 ease-out
            ${disabled
                            ? "bg-neutral-200 cursor-not-allowed"
                            : isRecording
                                ? "bg-gradient-to-br from-brand-500 to-brand-600 shadow-glow-lg scale-110"
                                : "bg-gradient-to-br from-brand-400 to-brand-500 hover:from-brand-500 hover:to-brand-600 hover:shadow-glow cursor-pointer"
                        }
            ${status === "processing" ? "animate-pulse" : ""}
          `}
                    aria-label={isRecording ? "Recording... Release to stop" : "Hold to record"}
                >
                    {/* Audio level rings */}
                    {isRecording && (
                        <>
                            <div
                                className="absolute inset-0 rounded-full bg-brand-400 opacity-30 animate-ping"
                                style={{ transform: `scale(${1 + audioLevel * 0.5})` }}
                            />
                            <div
                                className="absolute inset-0 rounded-full border-4 border-white/30"
                                style={{ transform: `scale(${1 + audioLevel * 0.3})` }}
                            />
                        </>
                    )}

                    {/* Icon */}
                    <div className="relative z-10">
                        {status === "processing" ? (
                            <svg className="w-10 h-10 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        ) : (
                            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                            </svg>
                        )}
                    </div>
                </button>

                {/* Progress ring */}
                {isRecording && (
                    <svg className="absolute inset-0 w-28 h-28 -rotate-90">
                        <circle
                            cx="56"
                            cy="56"
                            r="52"
                            fill="none"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="4"
                        />
                        <circle
                            cx="56"
                            cy="56"
                            r="52"
                            fill="none"
                            stroke="white"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 52}`}
                            strokeDashoffset={`${2 * Math.PI * 52 * (1 - progress / 100)}`}
                            className="transition-all duration-100"
                        />
                    </svg>
                )}
            </div>

            {/* Status text */}
            <div className="text-center">
                {status === "idle" && !disabled && (
                    <p className="text-sm text-neutral-600">
                        Hold to record your voice
                    </p>
                )}
                {status === "recording" && (
                    <p className="text-sm text-brand-600 font-medium">
                        Recording... {formatTime(durationMs)}
                    </p>
                )}
                {status === "processing" && (
                    <p className="text-sm text-neutral-600">
                        Processing audio...
                    </p>
                )}
                {disabled && (
                    <p className="text-sm text-neutral-400">
                        Enter your username first
                    </p>
                )}
            </div>

            {/* Duration bar */}
            {isRecording && (
                <div className="w-full max-w-48 h-1 bg-neutral-200 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-100"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
        </div>
    );
}

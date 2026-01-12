"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/Button";
import { createTransport } from "@/lib/grpc/transport";
import { createGrpcClient } from "@/lib/grpc/client";
import { AudioModelService } from "@/gen/org/example/voicingbackend/audiomodel/audiomodel_pb";

export interface AudioRecorderResult {
  blob: Blob;
  url: string;
  pcmSamples: Float32Array;
  sampleRate: number;
  durationMs: number;
}

export interface AudioRecorderProps {
  onRecorded?: (result: AudioRecorderResult) => void;
  onBackgroundSuppress?: (foregroundUrl: string, backgroundUrl: string) => void;
  onError?: (error: string) => void;
  onRecordingAvailable?: (hasRecording: boolean) => void;
  onCurrentRecordingChange?: (recording: AudioRecorderResult | null) => void;
  className?: string;
  maxDurationMs?: number;
}

const CANVAS_HEIGHT = 120;
const PARTICLE_COUNT = 15;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface AudioMetrics {
  level: number;
  peak: number;
  frequency: number;
  clarity: number;
}

export default function AudioRecorder({ onRecorded, onBackgroundSuppress, onError, onRecordingAvailable, onCurrentRecordingChange, className, maxDurationMs }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const isLiveAnimRef = useRef<boolean>(false);
  const startTsRef = useRef<number>(0);
  const chunksRef = useRef<BlobPart[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [staticWave, setStaticWave] = useState<Float32Array | null>(null);
  const [staticSampleRate, setStaticSampleRate] = useState<number>(0);
  const lastResultRef = useRef<AudioRecorderResult | null>(null);
  const [targetRate, setTargetRate] = useState<number>(16000);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const playRafRef = useRef<number | null>(null);
  const playbackAnalyserRef = useRef<AnalyserNode | null>(null);
  const playbackSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playTime, setPlayTime] = useState<number>(0);
  const [playDuration, setPlayDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [audioMetrics, setAudioMetrics] = useState<AudioMetrics>({
    level: 0,
    peak: 0,
    frequency: 0,
    clarity: 0
  });
  
  // Separated tracks state
  const [separatedTracks, setSeparatedTracks] = useState<{
    original?: { url: string; samples: Float32Array; sampleRate: number };
    foreground?: { url: string; samples: Float32Array; sampleRate: number };
    background?: { url: string; samples: Float32Array; sampleRate: number };
  }>({});
  const [selectedTrack, setSelectedTrack] = useState<'original' | 'foreground' | 'background'>('original');
  
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [recordingPulse, setRecordingPulse] = useState<number>(0);
  const [visualState, setVisualState] = useState<'idle' | 'recording' | 'playing' | 'static'>('idle');
  const [stateTransition, setStateTransition] = useState<number>(0);

  // gRPC client
  const transport = useMemo(() => createTransport(), []);
  const client = useMemo(() => createGrpcClient(AudioModelService as any, transport) as any, [transport]);

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

  function pcmToWav(samples: Float32Array, sampleRate: number): Blob {
    // Convert Float32 -> 16-bit PCM
    const bytesPerSample = 2;
    const numChannels = 1;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    let offset = 0;
    const writeString = (s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i));
    };

    writeString('RIFF');
    view.setUint32(offset, 36 + dataSize, true); offset += 4;
    writeString('WAVE');
    writeString('fmt ');
    view.setUint32(offset, 16, true); offset += 4; // PCM chunk size
    view.setUint16(offset, 1, true); offset += 2; // PCM format
    view.setUint16(offset, numChannels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, byteRate, true); offset += 4;
    view.setUint16(offset, blockAlign, true); offset += 2;
    view.setUint16(offset, 8 * bytesPerSample, true); offset += 2; // bits per sample
    writeString('data');
    view.setUint32(offset, dataSize, true); offset += 4;

    // PCM samples
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const cssWidth = canvas.clientWidth || 600;
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(CANVAS_HEIGHT * dpr);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const cleanupAudioGraph = useCallback(() => {
    if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = null;
    isLiveAnimRef.current = false;
    try { sourceRef.current?.disconnect(); } catch {}
    try { analyserRef.current?.disconnect(); } catch {}
    sourceRef.current = null;
    analyserRef.current = null;
    // Do not close AudioContext immediately; keep for decoding
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const resetRecording = useCallback(() => {
    setIsRecording(false);
    setHasRecording(false);
    onRecordingAvailable?.(false);
    onCurrentRecordingChange?.(null);
    setDurationMs(0);
    setAudioUrl("");
    setStaticWave(null);
    setStaticSampleRate(0);
    chunksRef.current = [];
    cleanupAudioGraph();
  }, [cleanupAudioGraph, onRecordingAvailable, onCurrentRecordingChange]);

  const updateParticles = useCallback(() => {
    setParticles(prev => {
      const updated = prev.map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        life: p.life - 1,
        vx: p.vx * 0.99,
        vy: p.vy * 0.99
      })).filter(p => p.life > 0);

      // Add new particles based on audio activity
      if (updated.length < PARTICLE_COUNT && audioMetrics.level > 0.1) {
        const canvas = canvasRef.current;
        if (canvas) {
          const width = canvas.width;
          const height = canvas.height;
          for (let i = updated.length; i < Math.min(PARTICLE_COUNT, updated.length + 3); i++) {
            updated.push({
              x: Math.random() * width,
              y: height / 2 + (Math.random() - 0.5) * 40,
              vx: (Math.random() - 0.5) * 2,
              vy: (Math.random() - 0.5) * 2,
              life: 60,
              maxLife: 60,
              size: Math.random() * 3 + 1
            });
          }
        }
      }
      return updated;
    });
  }, [audioMetrics.level]);

  const drawLive = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const timeLen = analyser.fftSize;
    const timeData = new Uint8Array(timeLen);
    const freqData = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      if (!isLiveAnimRef.current) return;
      
      analyser.getByteTimeDomainData(timeData);
      analyser.getByteFrequencyData(freqData);
      
      // Calculate audio metrics
      let level = 0, peak = 0;
      for (let i = 0; i < timeData.length; i++) {
        const amplitude = Math.abs((timeData[i] - 128) / 128);
        level += amplitude;
        peak = Math.max(peak, amplitude);
      }
      level /= timeData.length;
      
      // Calculate dominant frequency
      let maxFreqIndex = 0;
      let maxFreqValue = 0;
      for (let i = 1; i < freqData.length / 4; i++) {
        if (freqData[i] > maxFreqValue) {
          maxFreqValue = freqData[i];
          maxFreqIndex = i;
        }
      }
      const frequency = (maxFreqIndex * 44100) / (2 * freqData.length);
      
      setAudioMetrics({
        level: level * 2,
        peak,
        frequency,
        clarity: level > 0.01 ? peak / level : 0
      });
      
      // Update recording pulse
      setRecordingPulse(prev => (prev + 0.1) % (Math.PI * 2));
      
      ctx.clearRect(0, 0, width, height);
      
      // Dynamic background with breathing effect
      const time = performance.now() / 2000;
      const breathe = Math.sin(time) * 0.1 + 0.9;
      const bgGradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height) * breathe);
      bgGradient.addColorStop(0, `rgba(15, 23, 42, ${0.95 + level * 0.05})`);
      bgGradient.addColorStop(0.4, `rgba(30, 41, 59, ${0.9 + level * 0.1})`);
      bgGradient.addColorStop(1, `rgba(51, 65, 85, ${0.85 + level * 0.15})`);
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);
      
      // Ambient grid with glow effect
      ctx.save();
      ctx.globalAlpha = 0.3 + level * 0.4;
      ctx.strokeStyle = "#0ea5e9";
      ctx.lineWidth = 1;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#0ea5e980";
      ctx.beginPath();
      for (let i = 1; i < 6; i++) {
        const y = (height / 6) * i;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      for (let i = 1; i < 10; i++) {
        const x = (width / 10) * i;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      ctx.stroke();
      ctx.restore();

      // Advanced waveform with multiple layers
      const waveIntensity = 1 + level * 3;
      
      // Main waveform
      const gradient = ctx.createLinearGradient(0, height/2 - 50, 0, height/2 + 50);
      gradient.addColorStop(0, `rgba(14, 165, 233, ${0.8 * waveIntensity})`);
      gradient.addColorStop(0.5, `rgba(59, 130, 246, ${0.4 * waveIntensity})`);
      gradient.addColorStop(1, `rgba(14, 165, 233, ${0.8 * waveIntensity})`);
      
      ctx.fillStyle = gradient;
      ctx.strokeStyle = `rgba(14, 165, 233, ${waveIntensity})`;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#0ea5e9";
      
      ctx.beginPath();
      const sliceWidth = width / timeLen;
      let x = 0;
      
      for (let i = 0; i < timeLen; i++) {
        const v = (timeData[i] - 128) / 128.0;
        const intensity = Math.abs(v) * waveIntensity;
        const y = height / 2 + v * (height / 3) * intensity;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      
      // Create envelope effect
      x = width;
      for (let i = timeLen - 1; i >= 0; i--) {
        const v = (timeData[i] - 128) / 128.0;
        const intensity = Math.abs(v) * waveIntensity;
        const y = height / 2 - v * (height / 3) * intensity;
        ctx.lineTo(x, y);
        x -= sliceWidth;
      }
      
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Frequency spectrum bars (subtle background)
      ctx.save();
      ctx.globalAlpha = 0.3;
      const barWidth = width / (freqData.length / 4);
      for (let i = 0; i < freqData.length / 4; i++) {
        const barHeight = (freqData[i] / 255) * (height / 3) * waveIntensity;
        const hue = (i / (freqData.length / 4)) * 60 + 200; // Blue to cyan range
        ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
      }
      ctx.restore();

      // Particles system
      particles.forEach(particle => {
        const alpha = particle.life / particle.maxLife;
        const size = particle.size * alpha;
        
        ctx.save();
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = `rgba(14, 165, 233, ${alpha})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#0ea5e9";
        
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Scanning beam effect
      const scanX = ((performance.now() * 0.1) % (width + 100)) - 50;
      ctx.save();
      ctx.globalAlpha = 0.6;
      const beamGradient = ctx.createLinearGradient(scanX - 30, 0, scanX + 30, 0);
      beamGradient.addColorStop(0, 'rgba(14, 165, 233, 0)');
      beamGradient.addColorStop(0.5, `rgba(14, 165, 233, ${0.8 + level})`);
      beamGradient.addColorStop(1, 'rgba(14, 165, 233, 0)');
      ctx.fillStyle = beamGradient;
      ctx.fillRect(scanX - 30, 0, 60, height);
      ctx.restore();

      updateParticles();
      rafIdRef.current = requestAnimationFrame(draw);
    };
    draw();
  }, [particles, updateParticles]);

  const drawStatic = useCallback((samples: Float32Array, sampleRate: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Modern dark background with subtle gradient
    const bgGradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height));
    bgGradient.addColorStop(0, 'rgba(15, 23, 42, 0.98)');
    bgGradient.addColorStop(0.6, 'rgba(30, 41, 59, 0.95)');
    bgGradient.addColorStop(1, 'rgba(51, 65, 85, 0.92)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
    
    // Sophisticated grid with subtle glow
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 0.5;
    ctx.shadowBlur = 5;
    ctx.shadowColor = "#0ea5e950";
    ctx.beginPath();
    for (let i = 1; i < 6; i++) {
      const y = (height / 6) * i;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    for (let i = 1; i < 12; i++) {
      const x = (width / 12) * i;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    ctx.stroke();
    ctx.restore();

    // Premium waveform with multiple layers
    const samplesPerPixel = Math.max(1, Math.floor(samples.length / width));
    
    // Background waveform (subtle)
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#1e40af40";
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    
    for (let x = 0; x < width; x++) {
      const sampleStart = x * samplesPerPixel;
      const sampleEnd = Math.min(samples.length, sampleStart + samplesPerPixel);
      
      let min = 0, max = 0;
      for (let i = sampleStart; i < sampleEnd; i++) {
        const sample = samples[i] || 0;
        min = Math.min(min, sample);
        max = Math.max(max, sample);
      }
      
      const yMax = height / 2 + max * (height / 2.5);
      const yMin = height / 2 + min * (height / 2.5);
      
      if (x === 0) {
        ctx.moveTo(x, yMax);
      } else {
        ctx.lineTo(x, yMax);
      }
    }
    
    for (let x = width - 1; x >= 0; x--) {
      const sampleStart = x * samplesPerPixel;
      const sampleEnd = Math.min(samples.length, sampleStart + samplesPerPixel);
      
      let min = 0;
      for (let i = sampleStart; i < sampleEnd; i++) {
        const sample = samples[i] || 0;
        min = Math.min(min, sample);
      }
      
      const yMin = height / 2 + min * (height / 2.5);
      ctx.lineTo(x, yMin);
    }
    
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    
    // Main waveform with advanced gradient
    const mainGradient = ctx.createLinearGradient(0, height/2 - 60, 0, height/2 + 60);
    mainGradient.addColorStop(0, 'rgba(14, 165, 233, 0.9)');
    mainGradient.addColorStop(0.2, 'rgba(59, 130, 246, 0.7)');
    mainGradient.addColorStop(0.5, 'rgba(147, 197, 253, 0.4)');
    mainGradient.addColorStop(0.8, 'rgba(59, 130, 246, 0.7)');
    mainGradient.addColorStop(1, 'rgba(14, 165, 233, 0.9)');
    
    ctx.fillStyle = mainGradient;
    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#0ea5e9";
    
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    
    // Enhanced envelope with smoothing
    const smoothedPoints = [];
    for (let x = 0; x < width; x++) {
      const sampleStart = x * samplesPerPixel;
      const sampleEnd = Math.min(samples.length, sampleStart + samplesPerPixel);
      
      let rms = 0;
      for (let i = sampleStart; i < sampleEnd; i++) {
        const sample = samples[i] || 0;
        rms += sample * sample;
      }
      rms = Math.sqrt(rms / (sampleEnd - sampleStart));
      smoothedPoints.push(rms);
    }
    
    // Apply smoothing filter
    const smoothed = [];
    for (let i = 0; i < smoothedPoints.length; i++) {
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, i - 2); j <= Math.min(smoothedPoints.length - 1, i + 2); j++) {
        sum += smoothedPoints[j];
        count++;
      }
      smoothed.push(sum / count);
    }
    
    // Draw smoothed waveform
    for (let x = 0; x < width; x++) {
      const amplitude = smoothed[x] || 0;
      const y = height / 2 + amplitude * (height / 2.2);
      
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    // Mirror for lower envelope
    for (let x = width - 1; x >= 0; x--) {
      const amplitude = smoothed[x] || 0;
      const y = height / 2 - amplitude * (height / 2.2);
      ctx.lineTo(x, y);
    }
    
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Add center line with glow
    ctx.save();
    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#0ea5e980";
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.restore();
  }, []);

  const drawStaticWithProgress = useCallback((samples: Float32Array, sampleRate: number, progress: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Dynamic background with playback intensity
    const time = performance.now() / 1000;
    const playbackIntensity = 1 + Math.sin(time * 4) * 0.2;
    const bgGradient = ctx.createRadialGradient(
      width * progress, height/2, 0, 
      width/2, height/2, Math.max(width, height)
    );
    bgGradient.addColorStop(0, `rgba(14, 165, 233, ${0.15 * playbackIntensity})`);
    bgGradient.addColorStop(0.3, `rgba(15, 23, 42, ${0.98})`);
    bgGradient.addColorStop(0.6, `rgba(30, 41, 59, ${0.95})`);
    bgGradient.addColorStop(1, `rgba(51, 65, 85, ${0.92})`);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
    
    // Enhanced grid with wave effects
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.sin(time * 2) * 0.1;
    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 0.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#0ea5e980";
    ctx.beginPath();
    
    // Animated vertical grid lines
    for (let i = 1; i < 12; i++) {
      const x = (width / 12) * i;
      const wave = Math.sin(time * 3 + i * 0.5) * 3;
      ctx.moveTo(x + wave, 0);
      ctx.lineTo(x - wave, height);
    }
    
    // Animated horizontal grid lines
    for (let i = 1; i < 6; i++) {
      const y = (height / 6) * i;
      const wave = Math.sin(time * 2 + i * 0.8) * 2;
      ctx.moveTo(0, y + wave);
      ctx.lineTo(width, y - wave);
    }
    ctx.stroke();
    ctx.restore();

    // Advanced waveform with progress-based effects
    const samplesPerPixel = Math.max(1, Math.floor(samples.length / width));
    const progressX = progress * width;
    
    // Pre-progress waveform (played portion) - more vibrant
    ctx.save();
    ctx.globalAlpha = 1;
    const playedGradient = ctx.createLinearGradient(0, height/2 - 80, 0, height/2 + 80);
    playedGradient.addColorStop(0, `rgba(34, 197, 94, ${0.9})`); // Emerald
    playedGradient.addColorStop(0.2, `rgba(14, 165, 233, ${0.8})`); // Blue
    playedGradient.addColorStop(0.5, `rgba(147, 197, 253, ${0.6})`); // Light blue
    playedGradient.addColorStop(0.8, `rgba(14, 165, 233, ${0.8})`);
    playedGradient.addColorStop(1, `rgba(34, 197, 94, ${0.9})`);
    
    ctx.fillStyle = playedGradient;
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#22c55e";
    
    // Clip to played region
    ctx.beginPath();
    ctx.rect(0, 0, progressX, height);
    ctx.clip();
    
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    
    // Draw played portion with enhanced amplitude
    const enhancementFactor = 1.3 + Math.sin(time * 6) * 0.2;
    for (let x = 0; x < progressX && x < width; x++) {
      const sampleStart = x * samplesPerPixel;
      const sampleEnd = Math.min(samples.length, sampleStart + samplesPerPixel);
      
      let rms = 0;
      for (let i = sampleStart; i < sampleEnd; i++) {
        const sample = samples[i] || 0;
        rms += sample * sample;
      }
      rms = Math.sqrt(rms / (sampleEnd - sampleStart)) * enhancementFactor;
      
      const y = height / 2 + rms * (height / 2.1);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    
    // Complete envelope for played portion
    for (let x = Math.min(progressX, width) - 1; x >= 0; x--) {
      const sampleStart = x * samplesPerPixel;
      const sampleEnd = Math.min(samples.length, sampleStart + samplesPerPixel);
      
      let rms = 0;
      for (let i = sampleStart; i < sampleEnd; i++) {
        const sample = samples[i] || 0;
        rms += sample * sample;
      }
      rms = Math.sqrt(rms / (sampleEnd - sampleStart)) * enhancementFactor;
      
      const y = height / 2 - rms * (height / 2.1);
      ctx.lineTo(x, y);
    }
    
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    
    // Post-progress waveform (unplayed portion) - subdued
    if (progressX < width) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      const unplayedGradient = ctx.createLinearGradient(0, height/2 - 60, 0, height/2 + 60);
      unplayedGradient.addColorStop(0, 'rgba(14, 165, 233, 0.6)');
      unplayedGradient.addColorStop(0.5, 'rgba(147, 197, 253, 0.3)');
      unplayedGradient.addColorStop(1, 'rgba(14, 165, 233, 0.6)');
      
      ctx.fillStyle = unplayedGradient;
      ctx.strokeStyle = "#0ea5e9";
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#0ea5e950";
      
      // Clip to unplayed region
      ctx.beginPath();
      ctx.rect(progressX, 0, width - progressX, height);
      ctx.clip();
      
      ctx.beginPath();
      ctx.moveTo(progressX, height / 2);
      
      // Draw unplayed portion
      for (let x = Math.floor(progressX); x < width; x++) {
        const sampleStart = x * samplesPerPixel;
        const sampleEnd = Math.min(samples.length, sampleStart + samplesPerPixel);
        
        let rms = 0;
        for (let i = sampleStart; i < sampleEnd; i++) {
          const sample = samples[i] || 0;
          rms += sample * sample;
        }
        rms = Math.sqrt(rms / (sampleEnd - sampleStart));
        
        const y = height / 2 + rms * (height / 2.2);
        if (x === Math.floor(progressX)) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      
      // Complete envelope for unplayed portion
      for (let x = width - 1; x >= Math.floor(progressX); x--) {
        const sampleStart = x * samplesPerPixel;
        const sampleEnd = Math.min(samples.length, sampleStart + samplesPerPixel);
        
        let rms = 0;
        for (let i = sampleStart; i < sampleEnd; i++) {
          const sample = samples[i] || 0;
          rms += sample * sample;
        }
        rms = Math.sqrt(rms / (sampleEnd - sampleStart));
        
        const y = height / 2 - rms * (height / 2.2);
        ctx.lineTo(x, y);
      }
      
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Real-time frequency spectrum during playback
    if (isPlaying && playbackAnalyserRef.current) {
      ctx.save();
      const freqData = new Uint8Array(playbackAnalyserRef.current.frequencyBinCount);
      playbackAnalyserRef.current.getByteFrequencyData(freqData);
      
      ctx.globalAlpha = 0.4;
      const barWidth = width / (freqData.length / 8);
      const spectrumHeight = height * 0.2;
      
      for (let i = 0; i < freqData.length / 8; i++) {
        const barHeight = (freqData[i] / 255) * spectrumHeight;
        const x = i * barWidth;
        const y = height - barHeight;
        
        // Dynamic color based on frequency and intensity
        const intensity = freqData[i] / 255;
        const hue = (i / (freqData.length / 8)) * 60 + 200; // Blue to cyan range
        const saturation = 70 + intensity * 30;
        const lightness = 40 + intensity * 40;
        
        ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${0.3 + intensity * 0.7})`;
        ctx.shadowBlur = 5 + intensity * 10;
        ctx.shadowColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        
        ctx.fillRect(x, y, barWidth - 1, barHeight);
      }
      ctx.restore();
    }

    // Dynamic playback particles
    if (isPlaying) {
      // Spawn particles at playhead position with intensity based on audio level
      const particleCount = Math.min(5, Math.max(1, Math.floor(audioMetrics.level * 8)));
      for (let i = 0; i < particleCount; i++) {
        const intensityFactor = audioMetrics.level * 2;
        const newParticle: Particle = {
          x: progressX + (Math.random() - 0.5) * (20 + intensityFactor * 20),
          y: height / 2 + (Math.random() - 0.5) * (60 + intensityFactor * 40),
          vx: (Math.random() - 0.5) * (3 + intensityFactor * 2),
          vy: (Math.random() - 0.5) * (3 + intensityFactor * 2),
          life: 40 + Math.random() * 20 + intensityFactor * 20,
          maxLife: 60 + intensityFactor * 30,
          size: (Math.random() * 2 + 1) * (1 + intensityFactor)
        };
        
        setParticles(prev => [...prev.slice(-15), newParticle]); // Keep more particles during intense playback
      }
    }

    // Render particles with enhanced effects
    particles.forEach((particle, index) => {
      const alpha = particle.life / particle.maxLife;
      const pulsePhase = (time * 10 + index * 0.5) % (Math.PI * 2);
      const size = particle.size * alpha * (1.5 + Math.sin(pulsePhase) * 0.4);
      
      ctx.save();
      ctx.globalAlpha = alpha * 0.9;
      
      // Particle trail effect
      ctx.shadowBlur = 15 + Math.sin(pulsePhase) * 5;
      ctx.shadowColor = "#22c55e";
      
      // Core particle with multiple layers
      const coreGradient = ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, size * 2
      );
      coreGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.8})`);
      coreGradient.addColorStop(0.3, `rgba(34, 197, 94, ${alpha})`);
      coreGradient.addColorStop(0.7, `rgba(14, 165, 233, ${alpha * 0.6})`);
      coreGradient.addColorStop(1, `rgba(14, 165, 233, 0)`);
      
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
      ctx.fill();
      
      // Outer glow layer
      const glowGradient = ctx.createRadialGradient(
        particle.x, particle.y, size,
        particle.x, particle.y, size * 4
      );
      glowGradient.addColorStop(0, `rgba(34, 197, 94, ${alpha * 0.3})`);
      glowGradient.addColorStop(0.5, `rgba(14, 165, 233, ${alpha * 0.2})`);
      glowGradient.addColorStop(1, `rgba(14, 165, 233, 0)`);
      
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, size * 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Energy ripple effect for larger particles
      if (particle.size > 1.5) {
        ctx.strokeStyle = `rgba(34, 197, 94, ${alpha * 0.5})`;
        ctx.lineWidth = 1;
        const rippleRadius = size * (2 + Math.sin(pulsePhase * 2) * 0.5);
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, rippleRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      ctx.restore();
    });

    // Enhanced playhead with wave effects
    ctx.save();
    const playheadPulse = 1 + Math.sin(time * 8) * 0.3;
    const playheadGlow = 15 + Math.sin(time * 6) * 5;
    
    // Playhead glow effect
    ctx.shadowBlur = playheadGlow;
    ctx.shadowColor = "#22c55e";
    
    // Main playhead line
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 3 * playheadPulse;
    ctx.beginPath();
    ctx.moveTo(progressX, 0);
    ctx.lineTo(progressX, height);
    ctx.stroke();
    
    // Playhead top indicator
    ctx.fillStyle = "#22c55e";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(progressX, 8, 4 * playheadPulse, 0, Math.PI * 2);
    ctx.fill();
    
    // Playhead bottom indicator  
    ctx.beginPath();
    ctx.arc(progressX, height - 8, 4 * playheadPulse, 0, Math.PI * 2);
    ctx.fill();
    
    // Energy wave from playhead
    const waveRadius = (time * 150) % 80;
    ctx.globalAlpha = 1 - (waveRadius / 80);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(progressX, height / 2, waveRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
    
    // Update particles
    updateParticles();
  }, [drawStatic, isPlaying, particles, updateParticles]);

  const handleStart = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ac = audioCtxRef.current ?? new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ac;
      const source = ac.createMediaStreamSource(stream);
      sourceRef.current = source;
      const analyser = ac.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      source.connect(analyser);
      isLiveAnimRef.current = true;
      drawLive();

      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        cleanupAudioGraph();
        stopStream();
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setHasRecording(true);
        onRecordingAvailable?.(true);
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const ctx = audioCtxRef.current ?? new (window.AudioContext || (window as any).webkitAudioContext)();
          audioCtxRef.current = ctx;
          const audioBuf = await ctx.decodeAudioData(arrayBuffer.slice(0));
          // mono mix
          const samples = audioBuf.numberOfChannels > 1
            ? (() => {
                const left = audioBuf.getChannelData(0);
                const right = audioBuf.getChannelData(1);
                const mixed = new Float32Array(audioBuf.length);
                for (let i = 0; i < audioBuf.length; i++) mixed[i] = (left[i] + right[i]) / 2;
                return mixed;
              })()
            : audioBuf.getChannelData(0).slice(0);
          setStaticWave(samples);
          setStaticSampleRate(audioBuf.sampleRate);
          drawStatic(samples, audioBuf.sampleRate);
          lastResultRef.current = { blob, url, pcmSamples: samples, sampleRate: audioBuf.sampleRate, durationMs };
          onCurrentRecordingChange?.(lastResultRef.current);
        } catch (err) {
          // decoding failure already surfaced by parent via callback if needed
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      startTsRef.current = performance.now();
      setIsRecording(true);
      setDurationMs(0);
    } catch (err) {
      // no mic permission, ignore here
    }
  }, [cleanupAudioGraph, drawLive, drawStatic, onRecorded, stopStream, durationMs]);

  const handleStop = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    }
    isLiveAnimRef.current = false;
    setIsRecording(false);
  }, []);

  const handleLoadFile = useCallback(async (file: File) => {
    try {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setHasRecording(true);
      onRecordingAvailable?.(true);
      const arrayBuffer = await file.arrayBuffer();
      const ctx = audioCtxRef.current ?? new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const audioBuf = await ctx.decodeAudioData(arrayBuffer.slice(0));
      // mono
      const samples = audioBuf.numberOfChannels > 1
        ? (() => {
            const left = audioBuf.getChannelData(0);
            const right = audioBuf.getChannelData(1);
            const mixed = new Float32Array(audioBuf.length);
            for (let i = 0; i < audioBuf.length; i++) mixed[i] = (left[i] + right[i]) / 2;
            return mixed;
          })()
        : audioBuf.getChannelData(0).slice(0);
      setStaticWave(samples);
      setStaticSampleRate(audioBuf.sampleRate);
      drawStatic(samples, audioBuf.sampleRate);
      lastResultRef.current = {
        blob: file,
        url,
        pcmSamples: samples,
        sampleRate: audioBuf.sampleRate,
        durationMs: Math.round((samples.length / audioBuf.sampleRate) * 1000),
      };
      onCurrentRecordingChange?.(lastResultRef.current);
    } catch {
      // ignore
    }
  }, [drawStatic]);

  const getCurrentResult = useCallback(async (): Promise<AudioRecorderResult | null> => {
    const r = lastResultRef.current;
    if (!r && staticWave && staticSampleRate) {
      const resampled = await resamplePcm(staticWave, staticSampleRate, targetRate);
      const wav = pcmToWav(resampled, targetRate);
      const url = URL.createObjectURL(wav);
      return { blob: wav, url, pcmSamples: resampled, sampleRate: targetRate, durationMs: Math.round((resampled.length / targetRate) * 1000) };
    }
    if (!r) return null;
    const resampled = await resamplePcm(r.pcmSamples, r.sampleRate, targetRate);
    const wav = pcmToWav(resampled, targetRate);
    const url = URL.createObjectURL(wav);
    return { blob: wav, url, pcmSamples: resampled, sampleRate: targetRate, durationMs: r.durationMs };
  }, [staticWave, staticSampleRate, targetRate]);

  // Background suppression using gRPC
  const handleSuppressBackground = useCallback(async () => {
    if (isProcessing) return;
    try {
      setIsProcessing(true);
      const cur = await getCurrentResult();
      if (!cur) return;

      const response = await client.suppressBackground({
        audioSamples: Array.from(cur.pcmSamples),
        sampleRate: cur.sampleRate,
        returnBackground: true,
        timestamp: BigInt(Date.now()),
      });

      if (!response?.success) {
        throw new Error(response?.errorMessage || 'Suppression failed');
      }

      const fgSamples = new Float32Array(response.foregroundSamples || []);
      const bgSamples = new Float32Array(response.backgroundSamples || []);

      const fgBlob = pcmToWav(fgSamples, cur.sampleRate);
      const bgBlob = bgSamples.length ? pcmToWav(bgSamples, cur.sampleRate) : null;
      const fgUrl = URL.createObjectURL(fgBlob);
      const bgUrl = bgBlob ? URL.createObjectURL(bgBlob) : "";

      // Store separated tracks
      setSeparatedTracks({
        original: { url: audioUrl || '', samples: cur.pcmSamples, sampleRate: cur.sampleRate },
        foreground: { url: fgUrl, samples: fgSamples, sampleRate: cur.sampleRate },
        background: bgBlob ? { url: bgUrl, samples: bgSamples, sampleRate: cur.sampleRate } : undefined
      });
      
      // Update local preview to foreground
      setStaticWave(fgSamples);
      setStaticSampleRate(cur.sampleRate);
      setAudioUrl(fgUrl);
      setSelectedTrack('foreground');
      drawStatic(fgSamples, cur.sampleRate);

      onBackgroundSuppress?.(fgUrl, bgUrl);
    } catch (err: any) {
      onError?.(err?.message || 'Background suppression failed');
    } finally {
      setIsProcessing(false);
    }
  }, [client, getCurrentResult, drawStatic, onBackgroundSuppress, onError, isProcessing]);

  useEffect(() => {
    let raf: number | null = null;
    if (isRecording) {
      const tick = () => {
        const now = performance.now();
        const ms = Math.max(0, now - startTsRef.current);
        setDurationMs(ms);
        if (maxDurationMs && ms >= maxDurationMs) {
          handleStop();
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isRecording, maxDurationMs, handleStop]);

  // State transition management
  useEffect(() => {
    let targetState: 'idle' | 'recording' | 'playing' | 'static' = 'idle';
    
    if (isRecording) {
      targetState = 'recording';
    } else if (isPlaying) {
      targetState = 'playing';
    } else if (hasRecording) {
      targetState = 'static';
    }
    
    if (targetState !== visualState) {
      setVisualState(targetState);
      setStateTransition(1); // Start transition
      
      // Smooth transition animation
      const transitionDuration = 500; // ms
      const startTime = performance.now();
      
      const animateTransition = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / transitionDuration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
        setStateTransition(1 - eased);
        
        if (progress < 1) {
          requestAnimationFrame(animateTransition);
        }
      };
      
      requestAnimationFrame(animateTransition);
    }
  }, [isRecording, isPlaying, hasRecording, visualState]);

  const mmss = useMemo(() => {
    const s = Math.floor(durationMs / 1000);
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, "0");
    return `${m}:${ss}`;
  }, [durationMs]);

  return (
    <div 
      className={`${className} relative group max-w-6xl mx-auto`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header with Status and Metrics */}
      <div className="glass rounded-2xl p-6 mb-4 border border-slate-200/50 backdrop-blur-xl bg-white/90">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              {isRecording && (
                <div className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping" />
              )}
              <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                isRecording ? 'bg-red-500 shadow-lg shadow-red-500/50' : 
                hasRecording ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 
                'bg-slate-400'
              }`} />
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-800">
                {isRecording ? "Recording" : hasRecording ? "Audio Ready" : "Standby"}
              </div>
              <div className="text-sm text-slate-600">{mmss}</div>
            </div>
          </div>
          
          {/* Real-time Audio Metrics */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-xs text-slate-600 mb-1">Level</div>
              <div className="flex items-center gap-2">
                <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-150"
                    style={{ width: `${Math.min(100, audioMetrics.level * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-slate-700 font-mono w-8">
                  {Math.round(audioMetrics.level * 100)}
                </span>
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-xs text-slate-600 mb-1">Peak</div>
              <div className="text-xs text-cyan-600 font-mono">
                {Math.round(audioMetrics.peak * 100)}
              </div>
            </div>
            
            {audioMetrics.frequency > 0 && (
              <div className="text-center">
                <div className="text-xs text-slate-600 mb-1">Freq</div>
                <div className="text-xs text-blue-600 font-mono">
                  {Math.round(audioMetrics.frequency)}Hz
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Track Selection - Moved above visualization */}
      {Object.keys(separatedTracks).length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900">Audio Tracks</h3>
            <span className="text-xs text-gray-500">Select which track to play</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectedTrack('original');
                if (separatedTracks.original) {
                  setAudioUrl(separatedTracks.original.url);
                  setStaticWave(separatedTracks.original.samples);
                  setStaticSampleRate(separatedTracks.original.sampleRate);
                  drawStatic(separatedTracks.original.samples, separatedTracks.original.sampleRate);
                }
              }}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-200 ${
                selectedTrack === 'original'
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <div className={`w-2 h-2 rounded-full ${selectedTrack === 'original' ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
                Original
              </div>
            </button>
            {separatedTracks.foreground && (
              <button
                onClick={() => {
                  setSelectedTrack('foreground');
                  if (separatedTracks.foreground) {
                    setAudioUrl(separatedTracks.foreground.url);
                    setStaticWave(separatedTracks.foreground.samples);
                    setStaticSampleRate(separatedTracks.foreground.sampleRate);
                    drawStatic(separatedTracks.foreground.samples, separatedTracks.foreground.sampleRate);
                  }
                }}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-200 ${
                  selectedTrack === 'foreground'
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-600'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${selectedTrack === 'foreground' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  Foreground
                </div>
              </button>
            )}
            {separatedTracks.background && (
              <button
                onClick={() => {
                  setSelectedTrack('background');
                  if (separatedTracks.background) {
                    setAudioUrl(separatedTracks.background.url);
                    setStaticWave(separatedTracks.background.samples);
                    setStaticSampleRate(separatedTracks.background.sampleRate);
                    drawStatic(separatedTracks.background.samples, separatedTracks.background.sampleRate);
                  }
                }}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-200 ${
                  selectedTrack === 'background'
                    ? 'bg-orange-50 border-orange-200 text-orange-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${selectedTrack === 'background' ? 'bg-orange-500' : 'bg-gray-400'}`}></div>
                  Background
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Advanced Visualization Panel */}
      <div className="relative glass rounded-2xl border border-slate-200/50 backdrop-blur-xl overflow-hidden bg-white/90">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 via-slate-800/30 to-slate-900/50" />
        
        <canvas
          ref={canvasRef}
          height={CANVAS_HEIGHT}
          className="w-full block cursor-crosshair relative z-10 transition-all duration-300 hover:brightness-110"
          onClick={(e) => {
            const el = audioElRef.current;
            if (!el || !staticWave) return;
            const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            const pct = Math.max(0, Math.min(1, x / rect.width));
            if (el.duration && !Number.isNaN(el.duration)) {
              el.currentTime = pct * el.duration;
              setPlayTime(el.currentTime);
              drawStaticWithProgress(staticWave, staticSampleRate, pct);
            }
          }}
        />
        
        {/* Modern Control Panel */}
        <div className="relative z-10 p-4 bg-gradient-to-r from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-sm border-t border-slate-700/50">
          <div className="flex items-center justify-between">
            {/* Primary Controls */}
            <div className="flex items-center gap-4">
              {!isRecording && (
                <button 
                  onClick={handleStart}
                  className="group relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 transition-all duration-300 shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:scale-105 active:scale-95"
                  aria-label="Start recording"
                >
                  <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="relative z-10">
                    <path d="M12 5a4 4 0 00-4 4v5a4 4 0 108 0V9a4 4 0 00-4-4z"/>
                    <path d="M19 13a7 7 0 01-14 0" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
              
              {isRecording && (
                <button 
                  onClick={handleStop}
                  className="group relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 transition-all duration-300 shadow-lg shadow-slate-500/25 hover:shadow-slate-500/40 hover:scale-105 active:scale-95"
                  aria-label="Stop recording"
                >
                  <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="w-5 h-5 bg-white rounded-md relative z-10" />
                </button>
              )}
              
              {!isRecording && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleLoadFile(f);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative flex items-center justify-center w-10 h-10 rounded-lg bg-slate-700/50 hover:bg-slate-600/60 border border-slate-600/50 hover:border-slate-500/60 transition-all duration-300 hover:scale-105 active:scale-95"
                    aria-label="Load audio file"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 group-hover:text-white transition-colors duration-300">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14,2 14,8 20,8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10,9 9,9 8,9"/>
                    </svg>
                  </button>
                </>
              )}
              
              {hasRecording && (
                <>
                  <button 
                    onClick={async () => {
                      const cur = await getCurrentResult();
                      if (cur) onRecorded?.(cur);
                    }}
                    className="group relative flex items-center justify-center px-3 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 transition-all duration-300 shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-105 active:scale-95 text-white font-medium text-xs"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="mr-1.5">
                      <path d="M17 3H5a2 2 0 00-2 2v14l4-4h10a2 2 0 002-2V5a2 2 0 00-2-2z"/>
                    </svg>
                    Save
                  </button>

                  <button
                    onClick={handleSuppressBackground}
                    disabled={isProcessing}
                    className={`group relative flex items-center justify-center px-3 h-8 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95 text-white font-medium text-xs ${isProcessing ? 'bg-slate-600 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30'}`}
                  >
                    {isProcessing ? (
                      <>
                        <div className="spinner w-3 h-3 mr-1.5" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
                          <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Suppress Background
                      </>
                    )}
                  </button>
                  
                  <button 
                    onClick={() => {
                      if (!audioUrl) return;
                      const el = audioElRef.current ?? new Audio();
                      audioElRef.current = el;
                      el.src = audioUrl;
                      el.volume = volume;
                      el.onloadedmetadata = () => setPlayDuration(el.duration || 0);
                      el.ontimeupdate = () => setPlayTime(el.currentTime || 0);
                      el.onended = () => { 
                        setIsPlaying(false); 
                        setPlayTime(0); 
                        if (playRafRef.current) cancelAnimationFrame(playRafRef.current); 
                        if (staticWave) drawStatic(staticWave, staticSampleRate); 
                      };
                      
                      if (isPlaying) {
                        el.pause();
                        setIsPlaying(false);
                        if (playRafRef.current) cancelAnimationFrame(playRafRef.current);
                        // Cleanup playback analyzer
                        try {
                          playbackSourceRef.current?.disconnect();
                          playbackAnalyserRef.current?.disconnect();
                        } catch {}
                        playbackSourceRef.current = null;
                        playbackAnalyserRef.current = null;
                      } else {
                        // Setup real-time audio analysis for playback
                        try {
                          const audioCtx = audioCtxRef.current ?? new (window.AudioContext || (window as any).webkitAudioContext)();
                          audioCtxRef.current = audioCtx;
                          
                          if (!playbackSourceRef.current) {
                            const source = audioCtx.createMediaElementSource(el);
                            playbackSourceRef.current = source;
                            
                            const analyser = audioCtx.createAnalyser();
                            analyser.fftSize = 2048;
                            analyser.smoothingTimeConstant = 0.8;
                            playbackAnalyserRef.current = analyser;
                            
                            source.connect(analyser);
                            analyser.connect(audioCtx.destination);
                          }
                        } catch (error) {
                          console.warn("Could not setup playback analysis:", error);
                        }
                        
                        el.play().catch(() => {});
                        setIsPlaying(true);
                        const loop = () => {
                          if (!el || !staticWave) return;
                          const progress = el.duration ? el.currentTime / el.duration : 0;
                          
                          // Update audio metrics during playback
                          if (playbackAnalyserRef.current) {
                            const timeData = new Uint8Array(playbackAnalyserRef.current.fftSize);
                            const freqData = new Uint8Array(playbackAnalyserRef.current.frequencyBinCount);
                            playbackAnalyserRef.current.getByteTimeDomainData(timeData);
                            playbackAnalyserRef.current.getByteFrequencyData(freqData);
                            
                            // Calculate real-time metrics
                            let level = 0, peak = 0;
                            for (let i = 0; i < timeData.length; i++) {
                              const amplitude = Math.abs((timeData[i] - 128) / 128);
                              level += amplitude;
                              peak = Math.max(peak, amplitude);
                            }
                            level /= timeData.length;
                            
                            // Find dominant frequency
                            let maxFreqIndex = 0;
                            let maxFreqValue = 0;
                            for (let i = 1; i < freqData.length / 4; i++) {
                              if (freqData[i] > maxFreqValue) {
                                maxFreqValue = freqData[i];
                                maxFreqIndex = i;
                              }
                            }
                            const frequency = (maxFreqIndex * 44100) / (2 * freqData.length);
                            
                            setAudioMetrics({
                              level: level * 3,
                              peak,
                              frequency,
                              clarity: level > 0.01 ? peak / level : 0
                            });
                          }
                          
                          drawStaticWithProgress(staticWave, staticSampleRate, progress);
                          playRafRef.current = requestAnimationFrame(loop);
                        };
                        loop();
                      }
                    }}
                    className="group relative flex items-center justify-center w-10 h-10 rounded-lg bg-slate-700/50 hover:bg-emerald-500/20 border border-slate-600/50 hover:border-emerald-500/60 transition-all duration-300 hover:scale-105 active:scale-95"
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-slate-300 group-hover:text-emerald-400 transition-colors duration-300">
                        <rect x="6" y="5" width="4" height="14" rx="1"/>
                        <rect x="14" y="5" width="4" height="14" rx="1"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-slate-300 group-hover:text-emerald-400 transition-colors duration-300 ml-1">
                        <path d="M8 5v14l11-7-11-7z"/>
                      </svg>
                    )}
                  </button>
                  
                  <button 
                    onClick={async () => {
                      const cur = await getCurrentResult();
                      if (!cur) return;
                      const wav = pcmToWav(cur.pcmSamples, cur.sampleRate);
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(wav);
                      a.download = `recording-${Math.floor(Date.now()/1000)}-${targetRate}hz.wav`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                    }}
                    className="group relative flex items-center justify-center w-10 h-10 rounded-lg bg-slate-700/50 hover:bg-slate-600/60 border border-slate-600/50 hover:border-slate-500/60 transition-all duration-300 hover:scale-105 active:scale-95"
                    aria-label="Download"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 group-hover:text-white transition-colors duration-300">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </button>
                  
                  <button 
                    onClick={resetRecording}
                    className="group relative flex items-center justify-center w-10 h-10 rounded-lg bg-slate-700/50 hover:bg-red-500/20 border border-slate-600/50 hover:border-red-500/60 transition-all duration-300 hover:scale-105 active:scale-95"
                    aria-label="Reset"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 group-hover:text-red-400 transition-colors duration-300">
                      <polyline points="23 4 23 10 17 10"/>
                      <polyline points="1 20 1 14 7 14"/>
                      <path d="M3.51 9a9 9 0 0114.13-3.36L23 10M1 14l5.37 4.36A9 9 0 0020.49 15"/>
                    </svg>
                  </button>
                </>
              )}
            </div>
            
            {/* Secondary Controls & Settings */}
            <div className="flex items-center gap-6">
              {hasRecording && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="text-slate-400">{formatTime(playTime)}</div>
                  <div className="text-slate-600">/</div>
                  <div className="text-slate-300">{formatTime(playDuration)}</div>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-400 font-medium">Sample Rate</label>
                <select
                  className="h-9 px-3 rounded-lg border border-slate-600/50 bg-slate-700/50 text-slate-200 text-sm focus:border-blue-500/60 focus:bg-slate-600/60 transition-all duration-200 outline-none"
                  value={targetRate}
                  onChange={(e) => setTargetRate(Number(e.target.value))}
                >
                  {[16000, 22050, 24000, 32000, 44100, 48000].map((r) => (
                    <option key={r} value={r} className="bg-slate-800">{r} Hz</option>
                  ))}
                </select>
              </div>
              
              {hasRecording && (
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-400 font-medium">Volume</label>
                  <div className="relative w-20">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={volume}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setVolume(v);
                        if (audioElRef.current) audioElRef.current.volume = v;
                      }}
                      className="w-full h-2 rounded-lg appearance-none bg-slate-700 focus:outline-none slider-thumb"
                      style={{
                        background: `linear-gradient(to right, #0ea5e9 0%, #0ea5e9 ${volume * 100}%, #475569 ${volume * 100}%, #475569 100%)`
                      }}
                    />
                  </div>
                  <span className="text-xs text-slate-300 font-mono w-8">
                    {Math.round(volume * 100)}
                  </span>
                </div>
              )}
              

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  if (!sec || !isFinite(sec)) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}



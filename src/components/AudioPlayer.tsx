"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Button from "@/components/Button";
import { createTransport } from "@/lib/grpc/transport";
import { createGrpcClient } from "@/lib/grpc/client";
import { AudioModelService } from "@/gen/org/example/voicingbackend/audiomodel/audiomodel_pb";

export interface AudioPlayerProps {
  className?: string;
  audioUrl?: string;
  onBackgroundSuppress?: (foregroundUrl: string, backgroundUrl: string) => void;
  onError?: (error: string) => void;
}

interface AudioTrack {
  name: string;
  url: string;
  samples?: Float32Array;
  sampleRate?: number;
  color: string;
  visible: boolean;
  volume: number;
}

const CANVAS_HEIGHT = 200;
const TOOLBAR_HEIGHT = 56;

export default function AudioPlayer({ 
  className, 
  audioUrl, 
  onBackgroundSuppress,
  onError 
}: AudioPlayerProps) {
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Visualization state
  const [showSpectogram, setShowSpectogram] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [playheadPosition, setPlayheadPosition] = useState(0);
  
  // Background suppression state
  const [isProcessing, setIsProcessing] = useState(false);
  const [foregroundTrack, setForegroundTrack] = useState<AudioTrack | null>(null);
  const [backgroundTrack, setBackgroundTrack] = useState<AudioTrack | null>(null);
  
  // Audio tracks
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<number>(0);
  
  // Refs
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Seek/hover state
  const [isSeeking, setIsSeeking] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  
  // Initialize audio context
  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext();
      } catch {
        onError?.("Failed to initialize audio context");
      }
    }
  }, [onError]);

  // Load and decode audio file
  const loadAudioFile = useCallback(async (url: string): Promise<AudioTrack | null> => {
    if (!url) return null;
    
    try {
      setIsLoading(true);
      await initAudioContext();
      
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);
      
      // Extract mono samples
      const samples = audioBuffer.numberOfChannels > 1
        ? (() => {
            const left = audioBuffer.getChannelData(0);
            const right = audioBuffer.getChannelData(1);
            const mono = new Float32Array(audioBuffer.length);
            for (let i = 0; i < audioBuffer.length; i++) {
              mono[i] = (left[i] + right[i]) / 2;
            }
            return mono;
          })()
        : audioBuffer.getChannelData(0).slice();
      
      return {
        name: "Original Audio",
        url,
        samples,
        sampleRate: audioBuffer.sampleRate,
        color: "#0ea5e9",
        visible: true,
        volume: 1
      };
    } catch (error) {
      onError?.(`Failed to load audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [initAudioContext, onError]);

  // Setup canvas for visualization
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = CANVAS_HEIGHT * dpr;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Draw waveform visualization
  const drawWaveform = useCallback((samples: Float32Array, progress: number = 0, color: string = "#0ea5e9") => {
    const canvas = canvasRef.current;
    if (!canvas || !samples?.length) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = CANVAS_HEIGHT;
    
    // Clear canvas with gradient background
    ctx.clearRect(0, 0, width, height);
    
    // Background gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, 'rgba(248, 250, 252, 0.95)');
    bgGradient.addColorStop(1, 'rgba(241, 245, 249, 0.95)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
    
    // Grid lines
    ctx.strokeStyle = "rgba(226, 232, 240, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      const y = (height / 4) * i;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    
    // Center line
    ctx.strokeStyle = "rgba(226, 232, 240, 0.6)";
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    
    // Waveform
    const samplesPerPixel = Math.max(1, Math.floor(samples.length / width * zoomLevel));
    const startSample = Math.floor((samples.length - width * samplesPerPixel) * progress);
    
    // Draw waveform envelope
    ctx.fillStyle = color + '40'; // 25% opacity
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    
    for (let x = 0; x < width; x++) {
      const sampleStart = startSample + x * samplesPerPixel;
      const sampleEnd = Math.min(samples.length, sampleStart + samplesPerPixel);
      
      let min = 0, max = 0;
      for (let i = sampleStart; i < sampleEnd; i++) {
        const sample = samples[i] || 0;
        min = Math.min(min, sample);
        max = Math.max(max, sample);
      }
      
      const yMin = height / 2 + min * (height / 2 - 10);
      const yMax = height / 2 + max * (height / 2 - 10);
      
      if (x === 0) {
        ctx.moveTo(x, yMax);
      } else {
        ctx.lineTo(x, yMax);
      }
    }
    
    // Complete the envelope
    for (let x = width - 1; x >= 0; x--) {
      const sampleStart = startSample + x * samplesPerPixel;
      const sampleEnd = Math.min(samples.length, sampleStart + samplesPerPixel);
      
      let min = 0;
      for (let i = sampleStart; i < sampleEnd; i++) {
        const sample = samples[i] || 0;
        min = Math.min(min, sample);
      }
      
      const yMin = height / 2 + min * (height / 2 - 10);
      ctx.lineTo(x, yMin);
    }
    
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Draw playhead
    if (progress > 0) {
      const playheadX = progress * width;
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = color + '80';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
      ctx.restore();
    }
  }, [zoomLevel]);

  // Draw spectogram visualization
  const drawSpectogram = useCallback((samples: Float32Array, sampleRate: number, progress: number = 0) => {
    const canvas = canvasRef.current;
    if (!canvas || !samples?.length) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = CANVAS_HEIGHT;
    
    ctx.clearRect(0, 0, width, height);
    
    // Background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
    bgGradient.addColorStop(1, 'rgba(30, 41, 59, 0.95)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
    
    // Simple frequency analysis visualization
    const fftSize = 2048;
    const step = Math.floor(samples.length / width);
    
    for (let x = 0; x < width; x++) {
      const startIdx = x * step;
      const endIdx = Math.min(startIdx + fftSize, samples.length);
      
      if (endIdx - startIdx < fftSize) continue;
      
      const chunk = samples.slice(startIdx, endIdx);
      
      // Simple frequency bins
      const bins = 64;
      for (let bin = 0; bin < bins; bin++) {
        const binStart = Math.floor((bin / bins) * chunk.length);
        const binEnd = Math.floor(((bin + 1) / bins) * chunk.length);
        
        let energy = 0;
        for (let i = binStart; i < binEnd; i++) {
          energy += Math.abs(chunk[i]);
        }
        energy /= (binEnd - binStart);
        
        const intensity = Math.min(1, energy * 5);
        const y = height - (bin / bins) * height;
        const barHeight = Math.max(1, (1 / bins) * height);
        
        const hue = 240 + intensity * 120; // Blue to purple
        ctx.fillStyle = `hsla(${hue}, 80%, ${40 + intensity * 40}%, ${0.3 + intensity * 0.7})`;
        ctx.fillRect(x, y - barHeight, 1, barHeight);
      }
    }
    
    // Draw playhead
    if (progress > 0) {
      const playheadX = progress * width;
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#0ea5e9";
      ctx.strokeStyle = "#0ea5e9";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  // Animation loop for visualization
  const animate = useCallback(() => {
    if (!tracks.length || !tracks[selectedTrack]) return;
    
    const track = tracks[selectedTrack];
    if (track.samples) {
      const progress = duration > 0 ? currentTime / duration : 0;
      
      if (showSpectogram && track.sampleRate) {
        drawSpectogram(track.samples, track.sampleRate, progress);
      } else {
        drawWaveform(track.samples, progress, track.color);
        
        // Draw additional tracks if any
        tracks.forEach((t, i) => {
          if (i !== selectedTrack && t.visible && t.samples) {
            drawWaveform(t.samples, progress, t.color);
          }
        });
      }
    }
    
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [tracks, selectedTrack, currentTime, duration, isPlaying, showSpectogram, drawWaveform, drawSpectogram]);

  // Helper function to convert PCM samples to WAV blob
  const pcmToWav = useCallback((samples: Float32Array, sampleRate: number): Blob => {
    const length = samples.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }, []);

  // Handle background suppression
  // gRPC client for audio model service
  const transport = useMemo(() => createTransport(), []);
  const client = useMemo(() => createGrpcClient(AudioModelService as any, transport) as any, [transport]);

  const handleBackgroundSuppress = useCallback(async () => {
    if (!tracks[selectedTrack]?.samples || isProcessing) return;
    const originalTrack = tracks[selectedTrack];
    if (!originalTrack.samples || !originalTrack.sampleRate) return;
    
    setIsProcessing(true);
    
    try {
      const response = await client.suppressBackground({
        audioSamples: Array.from(originalTrack.samples),
        sampleRate: originalTrack.sampleRate,
        returnBackground: true,
        timestamp: BigInt(Date.now()),
      });
      
      if (!response?.success) {
        throw new Error(response?.errorMessage || 'Suppression failed');
      }
      
      const fgSamples = new Float32Array(response.foregroundSamples || []);
      const bgSamples = new Float32Array(response.backgroundSamples || []);
      
      const foregroundBlob = pcmToWav(fgSamples, originalTrack.sampleRate);
      const backgroundBlob = bgSamples.length ? pcmToWav(bgSamples, originalTrack.sampleRate) : null;
      
      const foregroundUrl = URL.createObjectURL(foregroundBlob);
      const backgroundUrl = backgroundBlob ? URL.createObjectURL(backgroundBlob) : "";
      
      const newForegroundTrack: AudioTrack = {
        name: "Foreground",
        url: foregroundUrl,
        samples: fgSamples,
        sampleRate: originalTrack.sampleRate,
        color: "#22c55e",
        visible: true,
        volume: 1,
      };
      
      const newBackgroundTrack: AudioTrack | null = backgroundBlob ? {
        name: "Background",
        url: backgroundUrl,
        samples: bgSamples,
        sampleRate: originalTrack.sampleRate,
        color: "#f59e0b",
        visible: true,
        volume: 1,
      } : null;
      
      setForegroundTrack(newForegroundTrack);
      if (newBackgroundTrack) setBackgroundTrack(newBackgroundTrack);
      
      setTracks(prev => newBackgroundTrack ? [...prev, newForegroundTrack, newBackgroundTrack] : [...prev, newForegroundTrack]);
      
      onBackgroundSuppress?.(foregroundUrl, backgroundUrl);
      
    } catch (error) {
      onError?.(`Background suppression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [tracks, selectedTrack, isProcessing, client, onBackgroundSuppress, onError, pcmToWav]);

  // Time formatting
  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Initialize audio element and load file
  useEffect(() => {
    if (audioUrl) {
      loadAudioFile(audioUrl).then(track => {
        if (track) {
          setTracks([track]);
          setSelectedTrack(0);
          
          // Setup audio element
          const audio = new Audio(audioUrl);
          audioElementRef.current = audio;
          
          audio.addEventListener('loadedmetadata', () => {
            setDuration(audio.duration);
          });
          
          audio.addEventListener('timeupdate', () => {
            setCurrentTime(audio.currentTime);
          });
          
          audio.addEventListener('ended', () => {
            setIsPlaying(false);
            setIsPaused(false);
            setCurrentTime(0);
          });
        }
      });
    }
  }, [audioUrl, loadAudioFile]);

  // Setup canvas
  useEffect(() => {
    return setupCanvas();
  }, [setupCanvas]);

  // Animation loop
  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, animate]);

  // Redraw visualization when paused and currentTime changes (e.g., seeking)
  useEffect(() => {
    if (!isPlaying) {
      animate();
    }
  }, [currentTime, duration, tracks, selectedTrack, showSpectogram, zoomLevel, isPlaying, animate]);

  // Playback controls
  const handlePlay = useCallback(() => {
    const audio = audioElementRef.current;
    if (!audio) return;
    
    if (isPaused) {
      audio.play();
      setIsPlaying(true);
      setIsPaused(false);
    } else {
      audio.currentTime = 0;
      audio.play();
      setIsPlaying(true);
    }
  }, [isPaused]);

  const handlePause = useCallback(() => {
    const audio = audioElementRef.current;
    if (!audio) return;
    
    audio.pause();
    setIsPlaying(false);
    setIsPaused(true);
  }, []);

  const handleStop = useCallback(() => {
    const audio = audioElementRef.current;
    if (!audio) return;
    
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentTime(0);
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const audio = audioElementRef.current;
    if (!audio || !duration) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const progress = x / rect.width;
    const newTime = progress * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  // Drag-to-seek
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsSeeking(true);
    handleSeek(e);

    const handleMove = (ev: MouseEvent) => {
      if (!canvasRef.current || !duration || !audioElementRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
      const progress = x / rect.width;
      const newTime = progress * duration;
      audioElementRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      setHoverX(x);
      setHoverTime(newTime);
    };

    const handleUp = () => {
      setIsSeeking(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [duration, handleSeek]);

  // Hover preview
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!duration || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const progress = x / rect.width;
    setHoverX(x);
    setHoverTime(progress * duration);
  }, [duration]);

  const handleMouseLeave = useCallback(() => {
    if (!isSeeking) {
      setHoverX(null);
      setHoverTime(null);
    }
  }, [isSeeking]);

  // Keyboard seek on container
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const audio = audioElementRef.current;
    if (!audio || !duration) return;
    const smallStep = 1; // with Shift
    const largeStep = 5; // default
    if (e.key === 'ArrowLeft') {
      const delta = e.shiftKey ? smallStep : largeStep;
      const newTime = Math.max(0, audio.currentTime - delta);
      audio.currentTime = newTime;
      setCurrentTime(newTime);
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      const delta = e.shiftKey ? smallStep : largeStep;
      const newTime = Math.min(duration, audio.currentTime + delta);
      audio.currentTime = newTime;
      setCurrentTime(newTime);
      e.preventDefault();
    }
  }, [duration]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`max-w-4xl mx-auto ${className || ""} space-y-4 focus:outline-none`}
      aria-label="Audio player"
      role="region"
    >
      {/* Waveform Visualization */}
      <div className="glass rounded-2xl border border-neutral-200/60 overflow-hidden">
        <div className="p-4 border-b border-neutral-200/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-medium text-neutral-900">
                {tracks[selectedTrack]?.name || "Audio Player"}
              </h3>
              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <div className="spinner w-4 h-4" />
                  Loading...
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-600">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
        
        <div className="relative">
          <canvas
            ref={canvasRef}
            height={CANVAS_HEIGHT}
            className="w-full cursor-pointer"
            onClick={handleSeek}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
          
          {hoverX !== null && hoverTime !== null && (
            <>
              <div
                className="absolute top-0 bottom-0 w-px bg-brand-500/70 pointer-events-none"
                style={{ left: hoverX }}
              />
              <div
                className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 text-xs rounded bg-neutral-800 text-white pointer-events-none"
                style={{ left: hoverX }}
              >
                {formatTime(hoverTime)}
              </div>
            </>
          )}

          {tracks.length === 0 && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
              No audio loaded
            </div>
          )}
        </div>
        
        {/* Toolbar */}
        <div className="glass border-t border-neutral-200/30" style={{ height: TOOLBAR_HEIGHT }}>
          <div className="flex items-center justify-between h-full px-4">
            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="glass"
                size="sm"
                onClick={handlePlay}
                disabled={!tracks.length || isLoading}
                className="!p-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </Button>
              
              <Button
                variant="glass"
                size="sm"
                onClick={handlePause}
                disabled={!isPlaying}
                className="!p-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              </Button>
              
              <Button
                variant="glass"
                size="sm"
                onClick={handleStop}
                disabled={!tracks.length}
                className="!p-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h12v16H6z"/>
                </svg>
              </Button>
              
              <div className="w-px h-6 bg-neutral-200/50 mx-2" />
              
              {/* Background Suppression */}
              <Button
                variant="glass"
                size="sm"
                onClick={handleBackgroundSuppress}
                disabled={!tracks.length || isProcessing || isLoading}
                loading={isProcessing}
                className="flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Suppress Background
              </Button>
            </div>
            
            {/* View Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant={showSpectogram ? "primary" : "glass"}
                size="sm"
                onClick={() => setShowSpectogram(!showSpectogram)}
                disabled={!tracks.length}
                className="!p-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </Button>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="glass"
                  size="sm"
                  onClick={() => setZoomLevel(Math.max(0.1, zoomLevel - 0.5))}
                  disabled={!tracks.length}
                  className="!p-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM15 12H9" />
                  </svg>
                </Button>
                
                <span className="text-xs text-neutral-600 min-w-[3rem] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                
                <Button
                  variant="glass"
                  size="sm"
                  onClick={() => setZoomLevel(Math.min(10, zoomLevel + 0.5))}
                  disabled={!tracks.length}
                  className="!p-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM12 9v6m3-3H9" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Track List */}
      {(foregroundTrack || backgroundTrack) && (
        <div className="glass rounded-2xl border border-neutral-200/60 p-4">
          <h4 className="font-medium text-neutral-900 mb-3">Separated Tracks</h4>
          <div className="space-y-2">
            {tracks.map((track, index) => (
              <div 
                key={track.name}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  selectedTrack === index 
                    ? 'bg-brand-50/50 border-brand-200' 
                    : 'bg-neutral-50/50 border-neutral-200/50 hover:bg-neutral-50'
                }`}
              >
                <div 
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: track.color }}
                />
                <span className="font-medium text-sm text-neutral-900 flex-1">
                  {track.name}
                </span>
                <Button
                  variant="glass"
                  size="sm"
                  onClick={() => setSelectedTrack(index)}
                  className="!text-xs !px-3 !py-1"
                >
                  {selectedTrack === index ? 'Active' : 'Select'}
                </Button>
                <Button
                  variant="glass"
                  size="sm"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = track.url;
                    a.download = `${track.name.toLowerCase().replace(' ', '_')}_${Date.now()}.wav`;
                    a.click();
                  }}
                  className="!p-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
"use client";

import { useState } from "react";
import AudioRecorder from "@/components/AudioRecorder";
import AudioPlayer from "@/components/AudioPlayer";
import Button from "@/components/Button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function TestVisualizersPage() {
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string>("");
  const [showPlayer, setShowPlayer] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-0 via-neutral-50 to-brand-50/30 relative overflow-hidden">
      <div className="absolute inset-0 bg-mesh opacity-5" />
      
      <Header />
      
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Visualizer Comparison</h1>
          <p className="text-neutral-600">Compare the original AudioRecorder visualizer with the AudioPlayer visualizer</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Original AudioRecorder Visualizer */}
          <div className="glass rounded-2xl p-6 border border-neutral-200/60">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">
              Original AudioRecorder Visualizer
            </h2>
            <p className="text-sm text-neutral-600 mb-4">
              Features animated bars, live waveform overlay, and animated playhead during recording
            </p>
            <AudioRecorder
              onRecorded={(result) => {
                setCurrentAudioUrl(result.url);
                setShowPlayer(true);
              }}
              maxDurationMs={300000} // 5 minutes
            />
          </div>
          
          {/* Comparison Info */}
          <div className="glass rounded-2xl p-6 border border-neutral-200/60">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">
              Visualizer Features Comparison
            </h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-violet-50/50 rounded-xl border border-violet-200/50">
                <h3 className="font-medium text-neutral-900 mb-2">AudioRecorder (Original)</h3>
                <ul className="text-sm text-neutral-600 space-y-1">
                  <li>• Animated gradient background (violet hues)</li>
                  <li>• Real-time frequency bars visualization</li>
                  <li>• Live waveform overlay</li>
                  <li>• Animated scanning playhead</li>
                  <li>• Simple peak envelope for static display</li>
                  <li>• Violet color scheme (#8B5CF6)</li>
                </ul>
              </div>
              
              <div className="p-4 bg-brand-50/50 rounded-xl border border-brand-200/50">
                <h3 className="font-medium text-neutral-900 mb-2">AudioPlayer (New)</h3>
                <ul className="text-sm text-neutral-600 space-y-1">
                  <li>• Clean gradient background</li>
                  <li>• Waveform envelope visualization</li>
                  <li>• Spectrogram mode option</li>
                  <li>• Zoom controls (10% - 1000%)</li>
                  <li>• Multi-track support</li>
                  <li>• Blue color scheme (#0ea5e9)</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-neutral-50 rounded-xl">
              <h3 className="font-medium text-neutral-900 mb-2">Usage Recommendation</h3>
              <p className="text-sm text-neutral-600">
                The <strong>original AudioRecorder visualizer</strong> is better for live recording with its 
                animated bars and real-time feedback. The <strong>AudioPlayer visualizer</strong> is better 
                for playback and analysis with its envelope view and zoom capabilities.
              </p>
            </div>
          </div>
        </div>
        
        {/* AudioPlayer for comparison */}
        {showPlayer && currentAudioUrl && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4">
              AudioPlayer Visualizer (for comparison)
            </h2>
            <AudioPlayer
              audioUrl={currentAudioUrl}
              onBackgroundSuppress={(fg, bg) => {
                console.log("Foreground:", fg, "Background:", bg);
              }}
              onError={(error) => console.error(error)}
            />
          </div>
        )}
        
        {/* Test Controls */}
        <div className="glass rounded-2xl p-6 border border-neutral-200/60">
          <h3 className="font-semibold text-neutral-900 mb-4">Test Controls</h3>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="glass"
              size="sm"
              onClick={() => {
                // Generate test audio
                const sampleRate = 44100;
                const duration = 3;
                const samples = sampleRate * duration;
                const buffer = new ArrayBuffer(44 + samples * 2);
                const view = new DataView(buffer);
                
                // WAV header
                const writeString = (offset: number, str: string) => {
                  for (let i = 0; i < str.length; i++) {
                    view.setUint8(offset + i, str.charCodeAt(i));
                  }
                };
                
                writeString(0, 'RIFF');
                view.setUint32(4, 36 + samples * 2, true);
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
                view.setUint32(40, samples * 2, true);
                
                // Generate sine wave
                let offset = 44;
                for (let i = 0; i < samples; i++) {
                  const t = i / sampleRate;
                  const freq = 440 + Math.sin(t * 2) * 100; // Vibrato effect
                  const sample = Math.sin(2 * Math.PI * freq * t) * 0.3;
                  view.setInt16(offset, sample * 32767, true);
                  offset += 2;
                }
                
                const blob = new Blob([buffer], { type: 'audio/wav' });
                const url = URL.createObjectURL(blob);
                setCurrentAudioUrl(url);
                setShowPlayer(true);
              }}
            >
              Generate Test Audio
            </Button>
            
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const url = URL.createObjectURL(file);
                  setCurrentAudioUrl(url);
                  setShowPlayer(true);
                }
              }}
              className="hidden"
              id="audio-upload-test"
            />
            <Button
              variant="glass"
              size="sm"
              onClick={() => document.getElementById('audio-upload-test')?.click()}
            >
              Upload Audio File
            </Button>
            
            {showPlayer && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowPlayer(false);
                  setCurrentAudioUrl("");
                }}
              >
                Clear Player
              </Button>
            )}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
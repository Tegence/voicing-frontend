"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import AudioPlayer from "@/components/AudioPlayer";
import AudioRecorder from "@/components/AudioRecorder";
import SpeechToText from "@/components/SpeechToText";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { generateTestAudioUrl, generateCompositeAudio } from "@/utils/audioUtils";
import { createTransport } from "@/lib/grpc/transport";
import { createGrpcClient } from "@/lib/grpc/client";
import { AudioModelService } from "@/gen/org/example/voicingbackend/audiomodel/audiomodel_pb";
import { useToast } from "@/components/Toast";

export default function DemoPage() {
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string>("");
  const [showRecorder, setShowRecorder] = useState(false);
  const { show } = useToast();
  
  const transport = useMemo(() => createTransport(), []);
  const client = useMemo(() => createGrpcClient(AudioModelService as any, transport) as any, [transport]);

  const handleTranscribe = async (file: File): Promise<string> => {
    try {
      const fileContent = await file.arrayBuffer();
      
      const response = await client.transcribeAudio({
        fileContent: new Uint8Array(fileContent),
        fileName: file.name,
        model: "whisper-1",
        options: {}
      } as any);

      if (response?.success) {
        return response.text || "";
      } else {
        throw new Error(response?.errorMessage || 'Transcription failed');
      }
    } catch (err: any) {
      show({ type: "error", title: "Transcription Error", message: err?.message ?? "Failed to transcribe audio" });
      throw err;
    }
  };

  const handleRecorded = (result: { url: string; blob: Blob; pcmSamples: Float32Array; sampleRate: number; durationMs: number }) => {
    setCurrentAudioUrl(result.url);
    setShowRecorder(false);
  };

  const handleBackgroundSuppress = (foregroundUrl: string, backgroundUrl: string) => {
    console.log("Background suppression completed:");
    console.log("Foreground URL:", foregroundUrl);
    console.log("Background URL:", backgroundUrl);
  };

  const handleError = (error: string) => {
    console.error("Audio player error:", error);
  };

  const handleGenerateTestAudio = () => {
    const testUrl = generateTestAudioUrl(3, 440); // 3 second 440Hz tone
    setCurrentAudioUrl(testUrl);
  };

  const handleGenerateComposite = () => {
    const { originalUrl } = generateCompositeAudio(4); // 4 second composite
    setCurrentAudioUrl(originalUrl);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-0 via-neutral-50 to-brand-50/30 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-mesh opacity-5" />

      <Header />

      <main className="pt-20 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-6">
              Advanced Audio Player
              <span className="block gradient-text text-3xl md:text-4xl mt-2">
                with Background Suppression
              </span>
            </h1>
            <p className="text-xl text-neutral-600 max-w-3xl mx-auto leading-relaxed">
              Experience our cutting-edge audio visualization and background suppression technology. 
              Record or load audio to see real-time waveforms and separate foreground from background audio.
            </p>
          </div>

          {/* Demo Controls */}
          <div className="glass rounded-2xl p-6 border border-neutral-200/60 mb-8">
            <div className="flex flex-col lg:flex-row gap-6 items-center">
              <div className="flex-1">
                <h3 className="font-semibold text-neutral-900 mb-3">Get Started</h3>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="glass"
                    size="sm"
                    onClick={() => setShowRecorder(!showRecorder)}
                    className="flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
                    </svg>
                    {showRecorder ? "Hide" : "Record Audio"}
                  </Button>
                  
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setCurrentAudioUrl(url);
                      }
                    }}
                    className="hidden"
                    id="audio-upload"
                  />
                  <Button
                    variant="glass"
                    size="sm"
                    onClick={() => document.getElementById('audio-upload')?.click()}
                    className="flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload Audio
                  </Button>
                </div>
              </div>
              
              <div className="lg:border-l lg:border-neutral-200/50 lg:pl-6">
                <h3 className="font-semibold text-neutral-900 mb-3">Or Generate Test Audio</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateTestAudio}
                    className="text-xs"
                  >
                    Simple Tone
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateComposite}
                    className="text-xs"
                  >
                    Composite Audio
                  </Button>
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  Generated audio for testing visualization and background suppression
                </p>
              </div>
            </div>
          </div>

          {/* Audio Recorder */}
          {showRecorder && (
            <div className="mb-8 animate-slide-up">
              <AudioRecorder
                onRecorded={handleRecorded}
                onBackgroundSuppress={handleBackgroundSuppress}
                onError={handleError}
                className="max-w-4xl mx-auto"
                maxDurationMs={300000} // 5 minutes
              />
            </div>
          )}

          {/* Audio Player */}
          <div className="max-w-5xl mx-auto">
            <AudioPlayer
              audioUrl={currentAudioUrl}
              onBackgroundSuppress={handleBackgroundSuppress}
              onError={handleError}
              className="animate-fade-in"
            />
          </div>

          {/* Speech to Text Section */}
          <div className="max-w-4xl mx-auto mt-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-neutral-900 mb-3">
                Speech to Text
              </h2>
              <p className="text-lg text-neutral-600">
                Upload any audio file and get an accurate transcription powered by AI
              </p>
            </div>
            
            <div className="glass rounded-2xl p-8 border border-neutral-200/60">
              <SpeechToText onTranscribe={handleTranscribe} />
            </div>
          </div>

          {/* Features Explanation */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            <div className="glass rounded-xl p-6 border border-neutral-200/50">
              <div className="w-12 h-12 bg-gradient-to-br from-brand-400 to-brand-600 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <h3 className="font-semibold text-neutral-900 mb-2">Real-time Visualization</h3>
              <p className="text-neutral-600 text-sm">
                High-quality waveform and spectrogram visualization with interactive playhead and zoom controls.
              </p>
            </div>

            <div className="glass rounded-xl p-6 border border-neutral-200/50">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="font-semibold text-neutral-900 mb-2">Background Suppression</h3>
              <p className="text-neutral-600 text-sm">
                AI-powered background suppression separates foreground voice from background noise and music.
              </p>
            </div>

            <div className="glass rounded-xl p-6 border border-neutral-200/50">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-neutral-900 mb-2">Multiple Formats</h3>
              <p className="text-neutral-600 text-sm">
                Support for various audio formats with high-quality recording and export capabilities.
              </p>
            </div>

            <div className="glass rounded-xl p-6 border border-neutral-200/50">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="font-semibold text-neutral-900 mb-2">Speech to Text</h3>
              <p className="text-neutral-600 text-sm">
                Accurate transcription powered by OpenAI Whisper with automatic language detection.
              </p>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center mt-16">
            <div className="glass rounded-2xl p-8 border border-neutral-200/60 inline-block">
              <h3 className="text-2xl font-bold text-neutral-900 mb-4">
                Ready to enhance your audio workflow?
              </h3>
              <p className="text-neutral-600 mb-6 max-w-lg mx-auto">
                Join thousands of creators using our advanced audio processing tools to create professional content.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register">
                  <Button size="lg" className="shadow-glow hover:shadow-glow-lg">
                    Start Free Trial
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" size="lg" className="text-neutral-900">
                    Learn More
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
"use client";

import { useState } from "react";
import Button from "./Button";

interface SpeechToTextProps {
  onTranscribe: (file: File) => Promise<string>;
  className?: string;
  isLoading?: boolean;
}

export default function SpeechToText({ 
  onTranscribe, 
  className = "",
  isLoading: externalLoading = false 
}: SpeechToTextProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transcription, setTranscription] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>("");

  const isLoading = externalLoading || isProcessing;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate audio file - accept both MIME types and common audio extensions including PCM
      const isPCM = file.name.match(/\.(pcm|raw|l16|s16le)$/i);
      const isAudio = file.type.startsWith('audio/') || file.name.match(/\.(wav|mp3|m4a|flac|ogg|webm|pcm|raw|l16|s16le)$/i);
      
      if (!isAudio && !isPCM) {
        setError("Please select an audio file (WAV, MP3, M4A, FLAC, OGG, WebM, PCM)");
        return;
      }
      
      setSelectedFile(file);
      setTranscription("");
      setError("");
    }
  };

  const handleTranscribe = async () => {
    if (!selectedFile) return;

    try {
      setIsProcessing(true);
      setError("");
      const result = await onTranscribe(selectedFile);
      setTranscription(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (transcription) {
      navigator.clipboard.writeText(transcription);
    }
  };

  const handleDownload = () => {
    if (!transcription) return;
    
    const blob = new Blob([transcription], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setSelectedFile(null);
    setTranscription("");
    setError("");
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* File Upload Area */}
      <div className="border-2 border-dashed border-neutral-300 rounded-xl p-8 text-center hover:border-brand-500 transition-colors">
        <input
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.webm,.pcm,.raw,.l16,.s16le"
          onChange={handleFileSelect}
          className="hidden"
          id="speech-to-text-upload"
        />
        
        <label htmlFor="speech-to-text-upload" className="cursor-pointer">
          <div className="mx-auto w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-base font-medium text-neutral-700 mb-1">
            Click to upload audio file
          </p>
          <p className="text-sm text-neutral-500">
            Supports WAV, MP3, M4A, FLAC, OGG, WebM, PCM
          </p>
        </label>
      </div>

      {/* Selected File Info */}
      {selectedFile && (
        <div className="glass rounded-xl p-4 border border-neutral-200/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-brand-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-900">{selectedFile.name}</p>
                <p className="text-xs text-neutral-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={handleTranscribe}
                disabled={isLoading}
                size="sm"
              >
                {isLoading ? (
                  <>
                    <div className="spinner w-4 h-4" />
                    Transcribing...
                  </>
                ) : (
                  "Transcribe"
                )}
              </Button>
              
              <button
                onClick={handleClear}
                className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors"
                disabled={isLoading}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Transcription Result */}
      {transcription && (
        <div className="glass rounded-xl p-6 border border-neutral-200/60">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-semibold text-neutral-900">Transcription Result</h4>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors"
              >
                Copy
              </button>
              <button
                onClick={handleDownload}
                className="text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors"
              >
                Download
              </button>
            </div>
          </div>
          
          <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 whitespace-pre-wrap text-neutral-800">
            {transcription}
          </div>
          
          <div className="mt-3 text-xs text-neutral-500">
            {transcription.split(/\s+/).length} words • {transcription.length} characters
          </div>
        </div>
      )}

      {/* Features Info */}
      <div className="bg-brand-50 rounded-lg p-4 border border-brand-100">
        <h4 className="text-sm font-medium text-brand-900 mb-2">✨ Features</h4>
        <ul className="text-xs text-brand-800 space-y-1">
          <li>• Powered by OpenAI Whisper - industry-leading speech recognition</li>
          <li>• Supports multiple audio formats (WAV, MP3, M4A, FLAC, OGG, WebM, PCM)</li>
          <li>• Automatic language detection</li>
          <li>• High accuracy for various accents and audio quality</li>
          <li>• Download transcription as text file</li>
        </ul>
      </div>
    </div>
  );
}


"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { createTransport } from "@/lib/grpc/transport";
import { createGrpcClient } from "@/lib/grpc/client";
import { AudioModelService, AudioFormat, PhonemeFormat } from "@/gen/org/example/voicingbackend/audiomodel/audiomodel_pb";
import AudioRecorder, { type AudioRecorderResult } from "@/components/AudioRecorder";
import AudioPlayer from "@/components/AudioPlayer";

interface AudioFile {
  id: string;
  name: string;
  url: string;
  timestamp: number;
  size: number;
  duration: number;
  quality: 'Low' | 'Medium' | 'High' | 'Ultra';
  type: 'recording' | 'upload' | 'foreground' | 'background';
  metadata?: {
    sampleRate?: number;
    bitrate?: number;
    format?: string;
    noiseLevel?: number;
    clarityScore?: number;
  };
}

interface ProcessingStats {
  totalFiles: number;
  totalDuration: number;
  successRate: number;
  averageQuality: number;
  backgroundSuppressions: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { show } = useToast();
  const transport = useMemo(() => createTransport(), []);
  const client = useMemo(() => createGrpcClient(AudioModelService as any, transport) as any, [transport]);

  const [userId, setUserId] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string>("");
  const [showPlayer, setShowPlayer] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'studio' | 'library' | 'analytics' | 'automation'>('studio');
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterType, setFilterType] = useState<'all' | 'recording' | 'upload' | 'processed'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'duration' | 'quality'>('newest');
  const [processingStats, setProcessingStats] = useState<ProcessingStats>({
    totalFiles: 0,
    totalDuration: 0,
    successRate: 0,
    averageQuality: 0,
    backgroundSuppressions: 0
  });
  const [automationRules, setAutomationRules] = useState<Array<{
    id: string;
    name: string;
    enabled: boolean;
    trigger: string;
    action: string;
  }>>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    score: number;
    percentage: number;
    verified: boolean;
  } | null>(null);
  const [hasRecording, setHasRecording] = useState(false);
  const [currentRecording, setCurrentRecording] = useState<AudioRecorderResult | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<string>("");
  const [isConvertingToPhonemes, setIsConvertingToPhonemes] = useState(false);
  const [phonemeResult, setPhonemeResult] = useState<{
    sequences: Array<{ token: string; phonemes: string[] }>;
    phonemes: string[];
  } | null>(null);
  const [inputText, setInputText] = useState<string>("");
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [speechAudioUrl, setSpeechAudioUrl] = useState<string>("");
  const [speechText, setSpeechText] = useState<string>("");
  const [isGeneratingSentence, setIsGeneratingSentence] = useState(false);
  const [generatedSentence, setGeneratedSentence] = useState<{
    sentence: string;
    wordCount: number;
  } | null>(null);
  const [sentenceMinWords, setSentenceMinWords] = useState<number>(20);
  const [sentenceMaxWords, setSentenceMaxWords] = useState<number>(25);
  const [sentenceTopic, setSentenceTopic] = useState<string>("");
  const [isGeneratingJuxtaposition, setIsGeneratingJuxtaposition] = useState(false);
  const [generatedWords, setGeneratedWords] = useState<string[]>([]);
  const [juxtapositionNumWords, setJuxtapositionNumWords] = useState<number>(7);
  const [uploadedFileForTranscription, setUploadedFileForTranscription] = useState<File | null>(null);
  const [isTranscribingFile, setIsTranscribingFile] = useState(false);
  const [fileTranscriptionResult, setFileTranscriptionResult] = useState<string>("");
  const [selectedDialect, setSelectedDialect] = useState<string>("");
  const [selectedVoiceStyle, setSelectedVoiceStyle] = useState<string>("en-ng");

  useEffect(() => {
    const token = (typeof window !== "undefined" && localStorage.getItem("voicing_token")) || "";
    if (!token) {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const res = await client.validateToken({ token } as any);
        if (!res?.valid) {
          router.replace("/login");
          return;
        }
        setUserId(res.userId || "");
        setUsername(res.username || "");
      } catch (err: any) {
        show({ type: "error", title: "Session error", message: err?.message ?? "Failed to validate session" });
        router.replace("/login");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [client, router, show]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }


  const handleRecorded = async (out: AudioRecorderResult) => {
    try {
      setIsProcessing(true);
      const ts = Date.now();
      
      // Save the audio URL for the player
      setCurrentAudioUrl(out.url);
      setShowPlayer(true);
      
      // Save to server
      const res = await client.saveAudioToGCS({
        audioSamples: Array.from(out.pcmSamples),
        sampleRate: out.sampleRate || 16000,
        bucketName: "user-audio",
        fileName: `${userId || username || "user"}-${ts}.wav`,
        format: AudioFormat.WAV,
        metadata: { source: "dashboard-recording", username: username || userId || "user" },
        timestamp: BigInt(ts),
      } as any);
      
      if (res?.success) {
        show({ type: "success", title: "Saved", message: res.gcsUri || res.fileName || "Uploaded." });
        
        // Add to files
        const newFile: AudioFile = {
          id: generateFileId(),
          name: `Recording-${ts}`,
          url: out.url,
          timestamp: ts,
          size: out.pcmSamples?.length || 0,
          duration: (out.pcmSamples?.length || 0) / (out.sampleRate || 16000),
          quality: 'High',
          type: 'recording',
          metadata: {
            sampleRate: out.sampleRate,
            format: 'WAV'
          }
        };
        setFiles(prev => [newFile, ...prev]);
        setProcessingStats(prev => ({
          ...prev,
          totalFiles: prev.totalFiles + 1,
          totalDuration: prev.totalDuration + newFile.duration
        }));
      } else {
        show({ type: "error", title: "Save failed", message: res?.errorMessage || "Server rejected upload" });
      }
    } catch (err: any) {
      show({ type: "error", title: "Upload error", message: err?.message ?? "Failed to upload" });
    } finally {
      setIsProcessing(false);
    }
  };

  const generateFileId = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

  // File upload handlers
  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const audioFiles = fileArray.filter(file => file.type.startsWith('audio/'));
    
    if (audioFiles.length === 0) {
      show({ type: "error", title: "Invalid files", message: "Please select audio files only" });
      return;
    }

    setIsProcessing(true);
    
    try {
      for (const file of audioFiles) {
        const audioUrl = URL.createObjectURL(file);
        const newFile: AudioFile = {
          id: generateFileId(),
          name: file.name.replace(/\.[^/.]+$/, ""),
          url: audioUrl,
          timestamp: Date.now(),
          size: file.size,
          duration: 0, // Will be calculated when loaded
          quality: file.size > 1000000 ? 'High' : 'Medium',
          type: 'upload',
          metadata: {
            format: file.type,
            sampleRate: 44100 // Default, will be updated when decoded
          }
        };
        
        setFiles(prev => [newFile, ...prev]);
        setProcessingStats(prev => ({
          ...prev,
          totalFiles: prev.totalFiles + 1
        }));
      }
      
      show({ 
        type: "success", 
        title: "Files uploaded", 
        message: `${audioFiles.length} audio file(s) added successfully` 
      });
    } catch (error) {
      show({ 
        type: "error", 
        title: "Upload failed", 
        message: error instanceof Error ? error.message : "Failed to upload files" 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleBackgroundSuppress = async (foregroundUrl: string, backgroundUrl: string) => {
    show({ 
      type: "success", 
      title: "Background Suppressed", 
      message: "Audio has been separated into foreground and background tracks" 
    });
    
    const timestamp = Date.now();
    const foregroundFile: AudioFile = {
      id: generateFileId(),
      name: `Foreground-${timestamp}`,
      url: foregroundUrl,
      timestamp,
      size: 0,
      duration: 0,
      quality: 'High',
      type: 'foreground',
      metadata: {
        noiseLevel: 0.1,
        clarityScore: 0.9
      }
    };
    
    const backgroundFile: AudioFile = {
      id: generateFileId(),
      name: `Background-${timestamp}`,
      url: backgroundUrl,
      timestamp,
      size: 0,
      duration: 0,
      quality: 'Medium',
      type: 'background',
      metadata: {
        noiseLevel: 0.8,
        clarityScore: 0.3
      }
    };
    
    setFiles(prev => [foregroundFile, backgroundFile, ...prev]);
    setProcessingStats(prev => ({
      ...prev,
      backgroundSuppressions: prev.backgroundSuppressions + 1,
      totalFiles: prev.totalFiles + 2
    }));
  };

  const handleEnrollVoice = async (audioResult: AudioRecorderResult) => {
    try {
      setIsEnrolling(true);
      const response = await client.enrolUserVoice({
        userId: userId,
        audioId: `enrollment-${Date.now()}`,
        audioSamples: Array.from(audioResult.pcmSamples),
        sampleRate: audioResult.sampleRate,
        storeFormat: AudioFormat.WAV,
      } as any);

      if (response?.success) {
        show({ 
          type: "success", 
          title: "Voice Enrolled", 
          message: `Voice enrolled successfully. ${response.chunksStored} embedding chunks stored.` 
        });
      } else {
        throw new Error(response?.errorMessage || 'Enrollment failed');
      }
    } catch (err: any) {
      show({ type: "error", title: "Enrollment Error", message: err?.message ?? "Failed to enroll voice" });
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleVerifyVoice = async (audioResult: AudioRecorderResult) => {
    try {
      setIsVerifying(true);
      setVerificationResult(null);
      
      const response = await client.verifyUser({
        userId: userId,
        audioSamples: Array.from(audioResult.pcmSamples),
        sampleRate: audioResult.sampleRate,
      } as any);

      if (response?.success) {
        const result = {
          score: response.score || 0,
          percentage: response.percentage || 0,
          verified: response.verified || false
        };
        setVerificationResult(result);
        
        show({ 
          type: result.verified ? "success" : "error", 
          title: result.verified ? "Voice Verified" : "Voice Not Verified", 
          message: `Similarity: ${result.percentage.toFixed(1)}% (${result.verified ? 'Verified' : 'Not verified'})` 
        });
      } else {
        throw new Error(response?.errorMessage || 'Verification failed');
      }
    } catch (err: any) {
      show({ type: "error", title: "Verification Error", message: err?.message ?? "Failed to verify voice" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTranscribeAudio = async (audioResult: AudioRecorderResult) => {
    try {
      setIsTranscribing(true);
      setTranscriptionResult("");
      
      // Convert the audio result to a blob for transcription
      const audioBlob = audioResult.blob;
      const fileContent = await audioBlob.arrayBuffer();
      
      const response = await client.transcribeAudio({
        fileContent: new Uint8Array(fileContent),
        fileName: `transcription-${Date.now()}.wav`,
        model: "whisper-1",
        options: {}
      } as any);

      if (response?.success) {
        const transcribedText = response.text || "";
        setTranscriptionResult(transcribedText);
        
        show({ 
          type: "success", 
          title: "Transcription Complete", 
          message: `Audio transcribed successfully (${transcribedText.length} characters)` 
        });
      } else {
        throw new Error(response?.errorMessage || 'Transcription failed');
      }
    } catch (err: any) {
      show({ type: "error", title: "Transcription Error", message: err?.message ?? "Failed to transcribe audio" });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleTranscribeFile = async (file: File) => {
    try {
      setIsTranscribingFile(true);
      setFileTranscriptionResult("");
      
      // Convert the file to array buffer
      const fileContent = await file.arrayBuffer();
      
      const response = await client.transcribeAudio({
        fileContent: new Uint8Array(fileContent),
        fileName: file.name,
        model: "whisper-1",
        options: {}
      } as any);

      if (response?.success) {
        const transcribedText = response.text || "";
        setFileTranscriptionResult(transcribedText);
        
        show({ 
          type: "success", 
          title: "File Transcribed", 
          message: `Audio file transcribed successfully (${transcribedText.length} characters)` 
        });
      } else {
        throw new Error(response?.errorMessage || 'File transcription failed');
      }
    } catch (err: any) {
      show({ type: "error", title: "Transcription Error", message: err?.message ?? "Failed to transcribe file" });
    } finally {
      setIsTranscribingFile(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check if it's an audio file - accept both MIME types and common audio extensions including PCM
      const isPCM = file.name.match(/\.(pcm|raw|l16|s16le)$/i);
      const isAudio = file.type.startsWith('audio/') || file.name.match(/\.(wav|mp3|m4a|flac|ogg|webm|pcm|raw|l16|s16le)$/i);
      
      if (!isAudio && !isPCM) {
        show({ type: "error", title: "Invalid File", message: "Please select an audio file (WAV, MP3, M4A, FLAC, OGG, WebM, or PCM)" });
        return;
      }
      
      setUploadedFileForTranscription(file);
      setFileTranscriptionResult("");
    }
  };

  const handleTextToPhoneme = async (text: string, format: PhonemeFormat = PhonemeFormat.ARPABET, dialect: string = "") => {
    try {
      setIsConvertingToPhonemes(true);
      setPhonemeResult(null);

      const response = await client.textToPhoneme({
        text: text,
        language: "en",
        format: format,
        dialect: dialect
      } as any);

      if (response?.success) {
        const result = {
          sequences: response.sequences?.map((seq: any) => ({
            token: seq.token || "",
            phonemes: seq.phonemes || []
          })) || [],
          phonemes: response.phonemes || []
        };
        setPhonemeResult(result);
        
        show({ 
          type: "success", 
          title: "Phoneme Conversion Complete", 
          message: `Text converted to phonemes successfully (${result.phonemes.length} phonemes)` 
        });
      } else {
        throw new Error(response?.errorMessage || 'Phoneme conversion failed');
      }
    } catch (err: any) {
      show({ type: "error", title: "Phoneme Conversion Error", message: err?.message ?? "Failed to convert text to phonemes" });
    } finally {
      setIsConvertingToPhonemes(false);
    }
  };

  const handleTextToSpeech = async (text: string, sampleRate: number = 22050, voiceStyle: string = "en-ng") => {
    try {
      setIsGeneratingSpeech(true);
      setSpeechAudioUrl("");

      const response = await client.textToSpeech({
        text: text,
        sampleRate: sampleRate,
        voiceStyle: voiceStyle
      } as any);

      if (response?.success) {
        // Convert Float32Array to WAV blob
        const samples = new Float32Array(response.samples || []);
        const wavBlob = pcmToWav(samples, response.sampleRate || sampleRate);
        const audioUrl = URL.createObjectURL(wavBlob);
        
        setSpeechAudioUrl(audioUrl);
        setSpeechText(text);
        
        show({ 
          type: "success", 
          title: "Speech Generation Complete", 
          message: `Text converted to speech successfully (${samples.length} samples)` 
        });
      } else {
        throw new Error(response?.errorMessage || 'Speech generation failed');
      }
    } catch (err: any) {
      show({ type: "error", title: "Speech Generation Error", message: err?.message ?? "Failed to generate speech" });
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  const handleGenerateSentence = async (minWords: number, maxWords: number, topic?: string) => {
    try {
      setIsGeneratingSentence(true);
      setGeneratedSentence(null);
      
      const response = await client.generateSentence({
        minWords: minWords,
        maxWords: maxWords,
        topic: topic || ""
      } as any);

      if (response?.success) {
        const result = {
          sentence: response.sentence || "",
          wordCount: response.wordCount || 0
        };
        setGeneratedSentence(result);
        
        show({ 
          type: "success", 
          title: "Sentence Generated", 
          message: `Generated a ${result.wordCount}-word sentence successfully` 
        });
      } else {
        throw new Error(response?.errorMessage || 'Sentence generation failed');
      }
    } catch (err: any) {
      show({ type: "error", title: "Generation Error", message: err?.message ?? "Failed to generate sentence" });
    } finally {
      setIsGeneratingSentence(false);
    }
  };

  const handleGenerateJuxtaposition = async (numWords: number) => {
    try {
      setIsGeneratingJuxtaposition(true);
      setGeneratedWords([]);
      
      const response = await client.generateJuxtaposition({
        numWords: numWords
      } as any);

      if (response?.success) {
        const words = response.words || [];
        setGeneratedWords(words);
        
        show({ 
          type: "success", 
          title: "Words Generated", 
          message: `Generated ${words.length} random words successfully` 
        });
      } else {
        throw new Error(response?.errorMessage || 'Word generation failed');
      }
    } catch (err: any) {
      show({ type: "error", title: "Generation Error", message: err?.message ?? "Failed to generate words" });
    } finally {
      setIsGeneratingJuxtaposition(false);
    }
  };

  // Helper function to convert PCM samples to WAV blob
  const pcmToWav = (samples: Float32Array, sampleRate: number): Blob => {
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
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, numChannels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, byteRate, true); offset += 4;
    view.setUint16(offset, blockAlign, true); offset += 2;
    view.setUint16(offset, 8 * bytesPerSample, true); offset += 2;
    writeString('data');
    view.setUint32(offset, dataSize, true); offset += 4;

    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || 
      (filterType === 'processed' && (file.type === 'foreground' || file.type === 'background')) ||
      file.type === filterType;
    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'newest': return b.timestamp - a.timestamp;
      case 'oldest': return a.timestamp - b.timestamp;
      case 'name': return a.name.localeCompare(b.name);
      case 'duration': return b.duration - a.duration;
      case 'quality': 
        const qualityOrder = { Ultra: 4, High: 3, Medium: 2, Low: 1 };
        return qualityOrder[b.quality] - qualityOrder[a.quality];
      default: return b.timestamp - a.timestamp;
    }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Simple Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">Voicing</h1>
            </Link>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Welcome, {username || "User"}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    try { localStorage.removeItem("voicing_token"); } catch {}
                  }
                  router.push("/login");
                }}
              >
                Logout
              </Button>
            </div>
          </div>
          
          {/* Simple Tab Navigation */}
          <div className="flex items-center gap-4 py-4 border-t border-gray-200">
            {[
              { id: 'studio', label: 'Studio' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'studio' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Audio Studio</h2>
              <p className="text-gray-600">Record, process, and enhance your audio</p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
                              <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Recording</h3>
                  {(isProcessing || isEnrolling || isVerifying || isTranscribing || isConvertingToPhonemes) && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <div className="spinner w-4 h-4" />
                      {isEnrolling ? "Enrolling..." : isVerifying ? "Verifying..." : isTranscribing ? "Transcribing..." : isConvertingToPhonemes ? "Converting..." : "Processing..."}
                    </div>
                  )}
                </div>
              
              <AudioRecorder
                onRecorded={handleRecorded}
                onBackgroundSuppress={handleBackgroundSuppress}
                onError={(error) => show({ type: "error", title: "Recorder Error", message: error })}
                onRecordingAvailable={setHasRecording}
                onCurrentRecordingChange={setCurrentRecording}
                maxDurationMs={600000}
              />

              {/* Voice Authentication and Transcription */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-md font-medium text-gray-900 mb-4">Audio Processing</h4>
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={() => {
                      console.log('Enroll button clicked, currentRecording:', currentRecording);
                      if (currentRecording) {
                        console.log('Calling handleEnrollVoice with:', currentRecording);
                        handleEnrollVoice(currentRecording);
                      } else {
                        console.log('No current recording available');
                      }
                    }}
                    disabled={isEnrolling || isVerifying || isTranscribing || !hasRecording}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isEnrolling || isVerifying || isTranscribing || !hasRecording
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isEnrolling ? 'Enrolling...' : 'Enroll Voice'}
                  </button>
                  
                  <button
                    onClick={() => {
                      console.log('Verify button clicked, currentRecording:', currentRecording);
                      if (currentRecording) {
                        console.log('Calling handleVerifyVoice with:', currentRecording);
                        handleVerifyVoice(currentRecording);
                      } else {
                        console.log('No current recording available');
                      }
                    }}
                    disabled={isEnrolling || isVerifying || isTranscribing || !hasRecording}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isEnrolling || isVerifying || isTranscribing || !hasRecording
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {isVerifying ? 'Verifying...' : 'Verify Voice'}
                  </button>

                  <button
                    onClick={() => {
                      console.log('Transcribe button clicked, currentRecording:', currentRecording);
                      if (currentRecording) {
                        console.log('Calling handleTranscribeAudio with:', currentRecording);
                        handleTranscribeAudio(currentRecording);
                      } else {
                        console.log('No current recording available');
                      }
                    }}
                    disabled={isEnrolling || isVerifying || isTranscribing || !hasRecording}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isEnrolling || isVerifying || isTranscribing || !hasRecording
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {isTranscribing ? 'Transcribing...' : 'Transcribe Audio'}
                  </button>
                </div>

                {/* Verification Result */}
                {verificationResult && (
                  <div className="mt-4 p-3 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Verification Result:</span>
                      <span className={`text-sm font-semibold ${
                        verificationResult.verified ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {verificationResult.verified ? '✓ Verified' : '✗ Not Verified'}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      Similarity Score: {verificationResult.percentage.toFixed(1)}%
                    </div>
                  </div>
                )}

                {/* Transcription Result */}
                {transcriptionResult && (
                  <div className="mt-4 p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Transcription:</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(transcriptionResult);
                          show({ type: "success", title: "Copied", message: "Transcription copied to clipboard" });
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="text-sm text-gray-800 bg-gray-50 p-3 rounded border">
                      {transcriptionResult}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Speech to Text - File Upload Transcription */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Speech to Text (File Upload)</h3>
                {isTranscribingFile && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <div className="spinner w-4 h-4" />
                    Transcribing...
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                {/* File Upload Area */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.webm,.pcm,.raw,.l16,.s16le"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="transcription-file-upload"
                  />
                  
                  <label htmlFor="transcription-file-upload" className="cursor-pointer">
                    <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      Click to upload audio file
                    </p>
                    <p className="text-xs text-gray-500">
                      Supports WAV, MP3, M4A, FLAC, OGG, WebM, PCM
                    </p>
                  </label>
                </div>

                {/* Selected File Info */}
                {uploadedFileForTranscription && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{uploadedFileForTranscription.name}</p>
                        <p className="text-xs text-gray-500">
                          {(uploadedFileForTranscription.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (uploadedFileForTranscription) {
                            handleTranscribeFile(uploadedFileForTranscription);
                          }
                        }}
                        disabled={isTranscribingFile}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isTranscribingFile
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {isTranscribingFile ? 'Transcribing...' : 'Transcribe'}
                      </button>
                      
                      <button
                        onClick={() => {
                          setUploadedFileForTranscription(null);
                          setFileTranscriptionResult("");
                        }}
                        className="p-2 text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Transcription Result */}
                {fileTranscriptionResult && (
                  <div className="p-4 rounded-lg border bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">Transcription Result:</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(fileTranscriptionResult);
                            show({ type: "success", title: "Copied", message: "Transcription copied to clipboard" });
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => {
                            const blob = new Blob([fileTranscriptionResult], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `transcription-${Date.now()}.txt`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Download
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-800 bg-white p-4 rounded border whitespace-pre-wrap">
                      {fileTranscriptionResult}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {fileTranscriptionResult.split(/\s+/).length} words • {fileTranscriptionResult.length} characters
                    </div>
                  </div>
                )}

                {/* Features Info */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">✨ Features</h4>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li>• Powered by OpenAI Whisper - industry-leading speech recognition</li>
                    <li>• Supports multiple audio formats (WAV, MP3, M4A, FLAC, OGG, WebM, PCM)</li>
                    <li>• Automatic language detection</li>
                    <li>• High accuracy for various accents and audio quality</li>
                    <li>• Download transcription as text file</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Text to Phoneme Conversion */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Text to Phoneme Conversion</h3>
                {isConvertingToPhonemes && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <div className="spinner w-4 h-4" />
                    Converting...
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Input Text
                  </label>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Enter text to convert to phonemes..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dialect / Accent
                  </label>
                  <select
                    value={selectedDialect}
                    onChange={(e) => setSelectedDialect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                  >
                    <option value="">Standard American English</option>
                    <option value="en-ng">Nigerian English</option>
                    <option value="en-gb">British English</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedDialect === "en-ng"
                      ? "Applies TH-stopping, vowel mergers, and other Nigerian English phonological features"
                      : selectedDialect === "en-gb"
                      ? "British English pronunciation patterns"
                      : "Standard American English pronunciation"}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      if (inputText.trim()) {
                        handleTextToPhoneme(inputText.trim(), PhonemeFormat.ARPABET, selectedDialect);
                      } else {
                        show({ type: "error", title: "Input Required", message: "Please enter some text to convert" });
                      }
                    }}
                    disabled={isConvertingToPhonemes || !inputText.trim()}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isConvertingToPhonemes || !inputText.trim()
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {isConvertingToPhonemes ? 'Converting...' : 'Convert to ARPABET'}
                  </button>

                  <button
                    onClick={() => {
                      if (inputText.trim()) {
                        handleTextToPhoneme(inputText.trim(), PhonemeFormat.IPA, selectedDialect);
                      } else {
                        show({ type: "error", title: "Input Required", message: "Please enter some text to convert" });
                      }
                    }}
                    disabled={isConvertingToPhonemes || !inputText.trim()}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isConvertingToPhonemes || !inputText.trim()
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-teal-600 text-white hover:bg-teal-700'
                    }`}
                  >
                    {isConvertingToPhonemes ? 'Converting...' : 'Convert to IPA'}
                  </button>
                </div>

                {/* Phoneme Result */}
                {phonemeResult && (
                  <div className="mt-4 p-4 rounded-lg border bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">Phoneme Result:</span>
                      <button
                        onClick={() => {
                          const textToCopy = phonemeResult.phonemes.join(' ');
                          navigator.clipboard.writeText(textToCopy);
                          show({ type: "success", title: "Copied", message: "Phonemes copied to clipboard" });
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Copy Phonemes
                      </button>
                    </div>
                    
                    {/* Per-token breakdown */}
                    <div className="mb-3">
                      <h5 className="text-xs font-medium text-gray-600 mb-2">Per-token breakdown:</h5>
                      <div className="space-y-1">
                        {phonemeResult.sequences.map((seq, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-gray-800">{seq.token}:</span>
                            <span className="text-gray-600 font-mono">{seq.phonemes.join(' ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Full phoneme sequence */}
                    <div>
                      <h5 className="text-xs font-medium text-gray-600 mb-2">Full phoneme sequence:</h5>
                      <div className="text-sm text-gray-800 font-mono bg-white p-3 rounded border">
                        {phonemeResult.phonemes.join(' ')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Text to Speech Synthesis */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Text to Speech Synthesis</h3>
                {isGeneratingSpeech && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <div className="spinner w-4 h-4" />
                    Generating Speech...
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Text to Synthesize
                  </label>
                  <textarea
                    value={speechText}
                    onChange={(e) => setSpeechText(e.target.value)}
                    placeholder="Enter text to convert to speech..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Voice Style
                  </label>
                  <select
                    value={selectedVoiceStyle}
                    onChange={(e) => setSelectedVoiceStyle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                  >
                    <option value="en-ng">Nigerian English</option>
                    <option value="en-us">American English</option>
                    <option value="en-gb">British English</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedVoiceStyle === "en-ng"
                      ? "Nigerian English accent with local intonation patterns"
                      : selectedVoiceStyle === "en-gb"
                      ? "British English accent"
                      : "Standard American English accent"}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      if (speechText.trim()) {
                        handleTextToSpeech(speechText.trim(), 22050, selectedVoiceStyle);
                      } else {
                        show({ type: "error", title: "Input Required", message: "Please enter some text to synthesize" });
                      }
                    }}
                    disabled={isGeneratingSpeech || !speechText.trim()}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isGeneratingSpeech || !speechText.trim()
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {isGeneratingSpeech ? 'Generating...' : 'Generate Speech'}
                  </button>

                  <button
                    onClick={() => {
                      if (speechText.trim()) {
                        handleTextToSpeech(speechText.trim(), 16000, selectedVoiceStyle);
                      } else {
                        show({ type: "error", title: "Input Required", message: "Please enter some text to synthesize" });
                      }
                    }}
                    disabled={isGeneratingSpeech || !speechText.trim()}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isGeneratingSpeech || !speechText.trim()
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-violet-600 text-white hover:bg-violet-700'
                    }`}
                  >
                    {isGeneratingSpeech ? 'Generating...' : 'Generate (16kHz)'}
                  </button>
                </div>

                {/* Generated Speech Audio Player */}
                {speechAudioUrl && (
                  <div className="mt-4 p-4 rounded-lg border bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">Generated Speech:</span>
                      <button
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = speechAudioUrl;
                          a.download = `speech-${Date.now()}.wav`;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Download
                      </button>
                    </div>
                    
                    <audio 
                      controls 
                      className="w-full"
                      src={speechAudioUrl}
                    >
                      Your browser does not support the audio element.
                    </audio>
                    
                    <div className="mt-2 text-xs text-gray-600">
                      <p><strong>Original Text:</strong> {speechText}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sentence Generation */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Sentence Generator</h3>
                {isGeneratingSentence && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <div className="spinner w-4 h-4" />
                    Generating Sentence...
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Min Words
                    </label>
                    <input
                      type="number"
                      value={sentenceMinWords}
                      onChange={(e) => setSentenceMinWords(parseInt(e.target.value) || 20)}
                      min="1"
                      max="100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Words
                    </label>
                    <input
                      type="number"
                      value={sentenceMaxWords}
                      onChange={(e) => setSentenceMaxWords(parseInt(e.target.value) || 25)}
                      min="1"
                      max="100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Topic (Optional)
                    </label>
                    <input
                      type="text"
                      value={sentenceTopic}
                      onChange={(e) => setSentenceTopic(e.target.value)}
                      placeholder="e.g., technology, nature..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      handleGenerateSentence(sentenceMinWords, sentenceMaxWords, sentenceTopic);
                    }}
                    disabled={isGeneratingSentence}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isGeneratingSentence
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {isGeneratingSentence ? 'Generating...' : 'Generate Sentence'}
                  </button>
                  
                  <button
                    onClick={() => {
                      handleGenerateSentence(20, 25, "");
                    }}
                    disabled={isGeneratingSentence}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isGeneratingSentence
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-teal-600 text-white hover:bg-teal-700'
                    }`}
                  >
                    Quick Generate (20-25 words)
                  </button>
                </div>

                {/* Generated Sentence Display */}
                {generatedSentence && (
                  <div className="mt-4 p-4 rounded-lg border bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">Generated Sentence:</span>
                      <div className="flex gap-2">
                        <span className="text-xs text-gray-500">
                          ({generatedSentence.wordCount} words)
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedSentence.sentence);
                            show({ type: "success", title: "Copied", message: "Sentence copied to clipboard" });
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    
                    <div className="text-base text-gray-800 bg-white p-4 rounded border leading-relaxed">
                      {generatedSentence.sentence}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Word Juxtaposition Generator */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Random Word Juxtaposition</h3>
                {isGeneratingJuxtaposition && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <div className="spinner w-4 h-4" />
                    Generating Words...
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Words
                    </label>
                    <input
                      type="number"
                      value={juxtapositionNumWords}
                      onChange={(e) => setJuxtapositionNumWords(parseInt(e.target.value) || 7)}
                      min="1"
                      max="20"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  
                  <button
                    onClick={() => {
                      handleGenerateJuxtaposition(juxtapositionNumWords);
                    }}
                    disabled={isGeneratingJuxtaposition}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isGeneratingJuxtaposition
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-orange-600 text-white hover:bg-orange-700'
                    }`}
                  >
                    {isGeneratingJuxtaposition ? 'Generating...' : 'Generate Words'}
                  </button>
                </div>

                {/* Generated Words Display */}
                {generatedWords.length > 0 && (
                  <div className="mt-4 p-4 rounded-lg border bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">Generated Words:</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedWords.join(', '));
                          show({ type: "success", title: "Copied", message: "Words copied to clipboard" });
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Copy All
                      </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {generatedWords.map((word, index) => (
                        <span
                          key={index}
                          className="px-3 py-1.5 bg-white text-gray-800 rounded-full border text-sm font-medium hover:bg-blue-50 transition-colors cursor-pointer"
                          onClick={() => {
                            navigator.clipboard.writeText(word);
                            show({ type: "success", title: "Copied", message: `"${word}" copied to clipboard` });
                          }}
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {showPlayer && currentAudioUrl && (
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Audio Player</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowPlayer(false);
                      setCurrentAudioUrl("");
                    }}
                  >
                    Close
                  </Button>
                </div>
                <AudioPlayer
                  audioUrl={currentAudioUrl}
                  onBackgroundSuppress={handleBackgroundSuppress}
                  onError={(error) => show({ type: "error", title: "Player Error", message: error })}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'library' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Audio Library</h2>
                <p className="text-gray-600">Manage and organize your audio files</p>
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-2 bg-white rounded-md border border-gray-300 focus:border-blue-500 focus:outline-none"
                />
                
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="px-3 py-2 bg-white rounded-md border border-gray-300 focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">All Files</option>
                  <option value="recording">Recordings</option>
                  <option value="upload">Uploads</option>
                  <option value="processed">Processed</option>
                </select>
                
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 bg-white rounded-md border border-gray-300 focus:border-blue-500 focus:outline-none"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="name">Name</option>
                  <option value="duration">Duration</option>
                </select>
              </div>
            </div>

            {filteredFiles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className="bg-white rounded-lg p-4 border border-gray-200 hover:border-gray-300"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                      
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        {file.quality}
                      </span>
                    </div>
                    
                    <h4 className="font-medium text-gray-900 mb-1">{file.name}</h4>
                    <p className="text-sm text-gray-500 mb-3">
                      {new Date(file.timestamp).toLocaleDateString()} • {file.duration ? `${Math.round(file.duration)}s` : '0s'}
                    </p>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentAudioUrl(file.url);
                          setShowPlayer(true);
                          setActiveTab('studio');
                        }}
                        className="flex-1"
                      >
                        Play
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = file.url;
                          a.download = file.name;
                          a.click();
                        }}
                      >
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
                <h3 className="text-lg font-medium text-gray-700 mb-2">No audio files yet</h3>
                <p className="text-gray-500 mb-4">Start by recording your first audio or uploading existing files</p>
                <Button onClick={() => setActiveTab('studio')}>
                  Go to Studio
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Analytics</h2>
              <p className="text-gray-600">Track your audio processing performance</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Files', value: files.length },
                { label: 'Processing Time', value: `${Math.round(processingStats.totalDuration / 60)}m` },
                { label: 'Success Rate', value: `${Math.round(processingStats.successRate)}%` },
                { label: 'Enhancements', value: processingStats.backgroundSuppressions }
              ].map((stat, index) => (
                <div key={index} className="bg-white rounded-lg p-6 border border-gray-200">
                  <div className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
              ))}
            </div>
            
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Quality Over Time</h3>
              <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                <p className="text-gray-600">Analytics coming soon</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'automation' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Automation</h2>
              <p className="text-gray-600">Configure automated workflows for your audio processing tasks</p>
            </div>
            
            <div className="bg-white rounded-lg p-8 border border-gray-200 text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Automation Hub</h3>
              <p className="text-gray-600 mb-6">Create powerful workflows that automatically process, enhance, and organize your audio files</p>
              <Button>
                Create Automation Rule
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}



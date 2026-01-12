# Speech to Text (Audio Transcription) Feature

## Overview
This feature provides powerful speech-to-text transcription capabilities using OpenAI's Whisper model. It allows users to upload audio files and receive accurate text transcriptions with support for multiple audio formats and automatic language detection.

## What Was Implemented

### 1. Dashboard Integration
Added a comprehensive Speech to Text section to the dashboard with:
- **File upload interface** with drag-and-drop support
- **Real-time transcription** powered by OpenAI Whisper
- **Multiple format support** (WAV, MP3, M4A, FLAC, OGG, WebM, PCM)
- **Download transcription** as text file
- **Copy to clipboard** functionality
- **Word and character count** statistics

**Location:** `/src/app/dashboard/page.tsx`

### 2. Reusable Component
Created a standalone `SpeechToText` component that can be used anywhere in the app:
- Clean, modern UI with proper loading states
- Error handling and validation
- File size display
- Export functionality
- Informative feature list

**Location:** `/src/components/SpeechToText.tsx`

### 3. Existing Recorder Integration
The dashboard already had transcription for recorded audio:
- Transcribe directly from the audio recorder
- Button to transcribe current recording
- Results displayed inline

## Features

### File Upload Transcription
- ✅ Drag-and-drop file upload interface
- ✅ Support for multiple audio formats
- ✅ File validation and error handling
- ✅ Real-time processing status
- ✅ Download transcription as .txt file
- ✅ Copy to clipboard with one click
- ✅ Word and character statistics

### Recording Transcription
- ✅ Direct transcription from recorded audio
- ✅ Integrated with audio recorder component
- ✅ Same powerful Whisper model
- ✅ Inline results display

### Technical Features
- ✅ OpenAI Whisper integration
- ✅ Automatic language detection
- ✅ High accuracy across accents
- ✅ Handles various audio quality
- ✅ Optimized for speed and reliability

## Usage

### Dashboard - File Upload

1. Navigate to Dashboard (`/dashboard`)
2. Scroll to "Speech to Text (File Upload)" section
3. Click to upload or drag-and-drop an audio file
4. Supported formats: WAV, MP3, M4A, FLAC, OGG, WebM, PCM (including .raw, .l16, .s16le)
5. Click "Transcribe" button
6. View, copy, or download the transcription

### Dashboard - Recording Transcription

1. Navigate to Dashboard (`/dashboard`)
2. Record audio using the audio recorder
3. Click "Transcribe Audio" button
4. View and copy the transcription result

### Using the Component

```tsx
import SpeechToText from "@/components/SpeechToText";
import { createTransport } from "@/lib/grpc/transport";
import { createGrpcClient } from "@/lib/grpc/client";
import { AudioModelService } from "@/gen/org/example/voicingbackend/audiomodel/audiomodel_pb";

export default function MyPage() {
  const transport = createTransport();
  const client = createGrpcClient(AudioModelService, transport);

  const handleTranscribe = async (file: File): Promise<string> => {
    const fileContent = await file.arrayBuffer();
    
    const response = await client.transcribeAudio({
      fileContent: new Uint8Array(fileContent),
      fileName: file.name,
      model: "whisper-1",
      options: {}
    });

    if (response?.success) {
      return response.text || "";
    } else {
      throw new Error(response?.errorMessage || 'Transcription failed');
    }
  };

  return (
    <SpeechToText 
      onTranscribe={handleTranscribe}
      className="max-w-2xl mx-auto"
    />
  );
}
```

## API Method

### transcribeAudio

```typescript
const response = await client.transcribeAudio({
  fileContent: new Uint8Array(fileContent), // Audio file bytes
  fileName: "audio.wav",                    // File name with extension
  model: "whisper-1",                       // Model name (optional)
  options: {}                               // Additional options (optional)
});

if (response.success) {
  console.log(response.text); // Transcribed text
}
```

## Proto Definition

```protobuf
message TranscribeAudioRequest {
  bytes file_content = 1;    // Raw file bytes (WAV/MP3/FLAC/OGG)
  string file_name = 2;      // File name with extension (used for content-type)
  string model = 3;          // e.g., "whisper-1"; default if empty
  map<string, string> options = 4; // optional provider-specific params
}

message TranscribeAudioResponse {
  bool success = 1;
  string text = 2;
  string error_message = 3;
}
```

## Supported Audio Formats

| Format | Extension | MIME Type | Notes |
|--------|-----------|-----------|-------|
| WAV | `.wav` | `audio/wav` | Uncompressed, best quality |
| MP3 | `.mp3` | `audio/mpeg` | Most common format |
| M4A | `.m4a` | `audio/mp4` | Apple audio format |
| FLAC | `.flac` | `audio/flac` | Lossless compression |
| OGG | `.ogg` | `audio/ogg` | Open format |
| WebM | `.webm` | `audio/webm` | Web-optimized |
| PCM | `.pcm`, `.raw`, `.l16`, `.s16le` | `audio/l16` or none | Raw audio data, uncompressed |

## Error Handling

The implementation includes comprehensive error handling for:

### File Validation
- Invalid file types (non-audio files)
- File size checks
- Format compatibility

### Network Errors
- Connection failures
- Timeout handling
- Backend service errors

### User Feedback
- Loading states during processing
- Success notifications
- Error messages with details
- Toast notifications in dashboard

## Component Props

### SpeechToText Component

```typescript
interface SpeechToTextProps {
  onTranscribe: (file: File) => Promise<string>;
  className?: string;
  isLoading?: boolean;
}
```

- **onTranscribe**: Async function that handles the transcription
- **className**: Additional CSS classes for styling
- **isLoading**: External loading state (optional)

## Best Practices

### File Size
- Recommended: Under 25 MB for optimal performance
- Large files may take longer to upload and process
- Consider compressing audio for faster processing

### Audio Quality
- Clear audio produces better transcriptions
- Minimize background noise when possible
- 16kHz sample rate is sufficient for speech
- Mono audio works as well as stereo

### Language Detection
- Whisper automatically detects the language
- Works with 90+ languages
- No need to specify language manually

## UI Features

### Dashboard Section
- Modern, clean interface
- Drag-and-drop upload area
- File preview with size information
- Processing indicator
- Rich transcription display
- Multiple export options

### Component Features
- Reusable design
- Customizable styling
- Built-in error handling
- Loading states
- Accessible UI elements

## Integration Points

### Current Integrations
1. **Dashboard** - Full-featured transcription interface
2. **Audio Recorder** - Direct recording transcription
3. **File Library** - Can transcribe uploaded files

### Potential Future Integrations
- Demo page transcription showcase
- Batch transcription processing
- Real-time streaming transcription
- Multi-language transcription display
- Transcription history/archive

## Performance Considerations

### Optimization
- File validation before upload
- Efficient ArrayBuffer handling
- Blob URL cleanup
- Minimal re-renders

### User Experience
- Immediate visual feedback
- Clear progress indicators
- Informative error messages
- Quick copy/download actions

## Future Enhancements

Potential improvements:
- [ ] Real-time transcription during recording
- [ ] Batch file transcription
- [ ] Transcription history/archive
- [ ] Language selection override
- [ ] Timestamp generation
- [ ] Speaker diarization
- [ ] Custom vocabulary/context
- [ ] Translation integration
- [ ] Subtitle/caption export (SRT, VTT)
- [ ] Audio player with synchronized transcript

## Troubleshooting

### Common Issues

**Issue**: "Invalid file" error
- **Solution**: Ensure file is an audio format (WAV, MP3, etc.)

**Issue**: Transcription fails
- **Solution**: Check file size (< 25 MB recommended) and format

**Issue**: Poor transcription quality
- **Solution**: Ensure audio is clear with minimal background noise

**Issue**: Network timeout
- **Solution**: Check internet connection, try smaller file

## Examples

### Basic Usage in Dashboard
```typescript
// Already implemented - just use the dashboard!
// Navigate to /dashboard and scroll to Speech to Text section
```

### Custom Implementation
```typescript
import { useState } from "react";
import SpeechToText from "@/components/SpeechToText";

export default function TranscriptionPage() {
  const [result, setResult] = useState("");

  const handleTranscribe = async (file: File) => {
    // Your transcription logic here
    const text = await transcribeAudioFile(file);
    setResult(text);
    return text;
  };

  return (
    <div className="container mx-auto p-6">
      <h1>Audio Transcription</h1>
      <SpeechToText onTranscribe={handleTranscribe} />
      {result && <p>Transcription: {result}</p>}
    </div>
  );
}
```

## Security Considerations

- Files are validated before processing
- No persistent storage of audio files on client
- Secure HTTPS transmission
- Token-based authentication
- Error messages don't expose sensitive info

## Accessibility

- Keyboard navigation support
- ARIA labels for screen readers
- Clear visual feedback
- High contrast mode compatible
- Focus management


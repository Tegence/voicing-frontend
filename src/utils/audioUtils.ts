/**
 * Audio utility functions for testing and demo purposes
 */

/**
 * Generate a test audio buffer with a simple tone
 */
export function generateTestAudio(durationSeconds: number = 5, frequency: number = 440): Blob {
  const sampleRate = 44100;
  const length = sampleRate * durationSeconds;
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  
  // WAV header
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
  
  // Generate sine wave
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3; // 30% volume
    const intSample = Math.max(-32768, Math.min(32767, sample * 32767));
    view.setInt16(offset, intSample, true);
    offset += 2;
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Generate a test audio URL for demo purposes
 */
export function generateTestAudioUrl(durationSeconds: number = 5, frequency: number = 440): string {
  const blob = generateTestAudio(durationSeconds, frequency);
  return URL.createObjectURL(blob);
}

/**
 * Create a composite audio with background and foreground
 */
export function generateCompositeAudio(durationSeconds: number = 5): {
  originalUrl: string;
  foregroundUrl: string;
  backgroundUrl: string;
} {
  // Original: 440Hz tone + 220Hz background
  const originalBlob = generateMixedAudio(durationSeconds, [
    { frequency: 440, volume: 0.3 },
    { frequency: 220, volume: 0.15 }
  ]);
  
  // Foreground: mainly 440Hz
  const foregroundBlob = generateTestAudio(durationSeconds, 440);
  
  // Background: mainly 220Hz
  const backgroundBlob = generateTestAudio(durationSeconds, 220);
  
  return {
    originalUrl: URL.createObjectURL(originalBlob),
    foregroundUrl: URL.createObjectURL(foregroundBlob),
    backgroundUrl: URL.createObjectURL(backgroundBlob)
  };
}

/**
 * Generate mixed audio with multiple frequencies
 */
function generateMixedAudio(
  durationSeconds: number, 
  tones: Array<{ frequency: number; volume: number }>
): Blob {
  const sampleRate = 44100;
  const length = sampleRate * durationSeconds;
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  
  // WAV header
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
  
  // Generate mixed audio
  let offset = 44;
  for (let i = 0; i < length; i++) {
    let sample = 0;
    tones.forEach(tone => {
      sample += Math.sin(2 * Math.PI * tone.frequency * i / sampleRate) * tone.volume;
    });
    
    const intSample = Math.max(-32768, Math.min(32767, sample * 32767));
    view.setInt16(offset, intSample, true);
    offset += 2;
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}
# Sentence Generator Feature

## Overview
This feature adds the ability to generate sentences and random word juxtapositions using the backend's AI-powered text generation service.

## What Was Added

### 1. Proto File Updates
- Added `GenerateSentence` RPC method to `AudioModelService`
- Added `GenerateJuxtaposition` RPC method to `AudioModelService`
- Defined request/response message types for both methods

**Location:** `/proto/org/example/voicingbackend/audiomodel/audiomodel.proto`

### 2. Generated TypeScript Types
The proto definitions were compiled to TypeScript using Buf:

```bash
npx buf generate
```

**Generated Files:**
- `/src/gen/org/example/voicingbackend/audiomodel/audiomodel_pb.ts`
- `/src/gen/org/example/voicingbackend/audiomodel/audiomodel_connect.ts`

### 3. Dashboard Integration
Added two new sections to the dashboard page:

#### Sentence Generator
- **Min Words:** Minimum number of words (default: 20)
- **Max Words:** Maximum number of words (default: 25)
- **Topic:** Optional topic/seed for sentence generation
- **Quick Generate:** Shortcut button for 20-25 word sentences
- **Copy Function:** Easy copy-to-clipboard functionality

#### Random Word Juxtaposition
- **Number of Words:** Configure how many random words to generate (default: 7)
- **Word Display:** Interactive word chips that can be individually copied
- **Copy All:** Copy all generated words at once

**Location:** `/src/app/dashboard/page.tsx`

## Usage

### Generate a Sentence

1. Navigate to the Dashboard (`/dashboard`)
2. Scroll to the "Sentence Generator" section
3. Configure parameters:
   - Set minimum and maximum word count
   - Optionally add a topic
4. Click "Generate Sentence" or "Quick Generate"
5. Copy the generated sentence using the Copy button

### Generate Random Words

1. Navigate to the Dashboard (`/dashboard`)
2. Scroll to the "Random Word Juxtaposition" section
3. Set the number of words to generate
4. Click "Generate Words"
5. Click individual words to copy them, or use "Copy All"

## API Methods

### generateSentence

```typescript
const response = await client.generateSentence({
  minWords: 20,
  maxWords: 25,
  topic: "technology" // optional
});

if (response.success) {
  console.log(response.sentence);
  console.log(response.wordCount);
}
```

### generateJuxtaposition

```typescript
const response = await client.generateJuxtaposition({
  numWords: 7
});

if (response.success) {
  console.log(response.words); // array of strings
}
```

## Proto Definition

```protobuf
// Coherent sentence generation (aim for 20-25 words by default)
message GenerateSentenceRequest {
  int32 min_words = 1; // default 20
  int32 max_words = 2; // default 25
  string topic = 3;    // optional topic/seed
}

message GenerateSentenceResponse {
  bool success = 1;
  string sentence = 2;
  int32 word_count = 3;
  string error_message = 4;
}

// Random word juxtaposition (e.g., 7 words)
message GenerateJuxtapositionRequest {
  int32 num_words = 1; // default 7
}

message GenerateJuxtapositionResponse {
  bool success = 1;
  repeated string words = 2;
  string error_message = 3;
}
```

## Features

- ✅ Customizable word count for sentences
- ✅ Optional topic/seed for contextual generation
- ✅ Quick generate presets
- ✅ Random word juxtaposition for creative prompts
- ✅ Copy-to-clipboard functionality
- ✅ Loading states and error handling
- ✅ Toast notifications for success/error feedback
- ✅ Responsive UI design
- ✅ Word count display for generated sentences

## Error Handling

Both generators include comprehensive error handling:
- Network errors
- Backend service errors
- Invalid parameters
- Success/failure toast notifications

## Future Enhancements

Potential improvements:
- Save generated sentences to history
- Export sentences to various formats
- Integration with Text-to-Speech for immediate playback
- Word category filters for juxtaposition
- Sentence complexity settings
- Multiple sentence generation
- Language selection




import exp from "constants";

// diarizationTypes.ts
export interface Conversation {
  id: string;
  name: string;
  description: string;
  dateCreated: number;          // Float timestamp (from time.time() in Python)
  dateOfConversation: number;
  speakers: string[];
  speakerCount: number; // number of speakers in the conversation as determined by the model
  length: number;       // in seconds
  states?: {
    audioAvailable: boolean;
    diarization: boolean;
    transcript: boolean;
    speakerAudioSegments: boolean;
    speakerAssignment: boolean;
    report: boolean;
    stats: boolean;
  };
  diarizationProcess: {
    timeStarted: number;    // Float timestamp (from time.time() in Python)
    timeCompleted: number;  // Float timestamp (from time.time() in Python)
    logs: [string];         // Latest logs from the diarization process.
    device: string;         // Device used for the diarization process.
  }
  transcriptionProcess: {
    timeStarted: number;    // Float timestamp (from time.time() in Python)
    timeCompleted: number;  // Float timestamp (from time.time() in Python)
    logs: [string];         // Latest logs from the transcription process.
    device: string;         // Device used for the transcription process.
  }
  backgroundImage?: string;
}

export interface Speaker {
  id: string;
  name: string;
  color?: string;
  originalImageUrl?: string;
  croppedImageUrl?: string;
  presetAvatar?: string;
  dateCreated?: string;       // ISO date string
}

// Response format from the server for the hardware check
export interface cpu_data {
  available: boolean;
  brand: string;
  architecture: string;
  physicalCores: number;
  logicalCores: number;
  frequencyCurrentMHz: number;
}

export interface gpu_data {
  available: boolean;
  name?: string;
  totalMemoryGB?: number;
  computeCapability?: string;
  multiProcessorCount?: number;
}

export interface hardwareResponse {
  cpu: cpu_data;
  gpu: gpu_data;
  torchVersion: string;
  cudaAvailable: boolean;
  cudaVersion: string;
}

// Response format from the server for the API tokens
export interface apiTokensResponse {
  tokens: {
    [key: string]: string | null;
  };
}

// Humand readable names for the API tokens (needs to be in sync with the backend; just a list of names)
// The order of the names in this array should match the order of the tokens in the apiTokensResponse
export const apiTokenNames = [
  "Hugging Face",
  "OpenAI"
];

// Type format for the whisper transcription
export interface WhisperTranscription {
  text: string;     // This is the full transcription text in a single line.
  segments: {
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }[];
}

// Type format for the chat content
export interface ChatContent {
  segments: {
    speakerId: string;
    start: number;
    end: number;
    text: string;
  }[];
}
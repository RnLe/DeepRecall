// diarizationHelpers.ts

export interface DiarizationResult {
    startTime: number;
    duration: number;
    speaker: string;
  }
  
  export const parseRTTM = (raw: string): DiarizationResult[] => {
    // Attempt to parse JSON; if a "content" property exists, use it
    try {
      const parsed = JSON.parse(raw);
      if (parsed.content) {
        raw = parsed.content;
      }
    } catch (e) {
      // Continue with raw text if JSON parsing fails
    }
  
    // Split the file into non-empty lines using regex to support Windows and Unix line breaks
    const lines = raw.split(/\r?\n/).filter(line => line.trim() !== "");
    return lines.map(line => {
      // Example RTTM line:
      // SPEAKER e7861559aabb1e9780cd86500551b39d 1 0.031 23.186 <NA> <NA> SPEAKER_00 <NA> <NA>
      // We need: start time (index 3), duration (index 4), and speaker (index 7)
      const parts = line.split(/\s+/);
      return {
        startTime: Number(parseFloat(parts[3]).toFixed(1)), // keep first decimal point included
        duration: Number(parseFloat(parts[4]).toFixed(1)),  // keep first decimal point included
        speaker: parts[7],
      };
    });
  };

export const extractSpeakerCount = (raw: string): number => {
  const results = parseRTTM(raw);
  return new Set(results.map(r => r.speaker)).size;
};

export const getSpeakerAudioFilename = (speakerIndex: number, convId: string): string => {
  const speakerStr = speakerIndex < 10 ? `0${speakerIndex}` : `${speakerIndex}`;
  return `SPEAKER_${speakerStr}_${convId}.mp3`;
};

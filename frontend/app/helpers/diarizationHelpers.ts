// diarizationHelpers.ts

export interface DiarizationResult {
    startTime: number;
    duration: number;
    speaker: string;
  }
  
  export const parseRTTM = (raw: string): DiarizationResult[] => {
    // Split the file into non-empty lines
    const lines = raw.split("\n").filter(line => line.trim() !== "");
    return lines.map(line => {
      // Example RTTM line:
      // SPEAKER e7861559aabb1e9780cd86500551b39d 1 0.031 23.186 <NA> <NA> SPEAKER_00 <NA> <NA>
      // We need: start time (index 3), duration (index 4), and speaker (index 7)
      const parts = line.split(/\s+/);
      return {
        startTime: parseFloat(parts[3]),
        duration: parseFloat(parts[4]),
        speaker: parts[7],
      };
    });
  };
  
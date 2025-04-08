// transcriptionHelpers.ts

// Returns the full transcription block. Assumes the JSON has a 'text' property or builds it from segments.
export function getBlockTranscription(data: any): string {
  if (data.text) return data.text;
  if (data.segments && Array.isArray(data.segments)) {
    return data.segments.map((seg: any) => seg.text).join(" ");
  }
  return "";
}

// Returns the transcription as line-by-line text with timing.
export function getLineTranscription(data: any): string {
  if (data.segments && Array.isArray(data.segments)) {
    return data.segments
      .map((seg: any) => `[${seg.start.toFixed(2)}-${seg.end.toFixed(2)}] ${seg.text}`)
      .join("\n");
  }
  return getBlockTranscription(data);
}


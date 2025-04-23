// chatHelpers.ts
import { ChatContent, ChatCompact, Speaker } from '../types/conversate/diarizationTypes';
import { secondsToString } from './timesToString';
import { DiarizationResult } from './diarizationHelpers';
import { WhisperTranscription } from '../types/conversate/diarizationTypes';

// New interface for grouped messages
export interface GroupedMessage {
  speakerId: string;
  start: number;
  end: number;
  text: string;
}

// New helper to group messages as in Chat.tsx
export const groupChatMessages = (chatContent: ChatContent): GroupedMessage[] => {
  const grouped: GroupedMessage[] = [];
  let currentGroup: GroupedMessage | null = null;
  chatContent.segments.forEach(seg => {
    if (!currentGroup || currentGroup.speakerId !== seg.speakerId) {
      if (currentGroup) {
        grouped.push(currentGroup);
      }
      currentGroup = { ...seg };
    } else {
      currentGroup.end = seg.end;
      currentGroup.text += ' ' + seg.text;
    }
  });
  if (currentGroup) grouped.push(currentGroup);
  return grouped;
};

// New helper to format chat content for clipboard
export const formatChatContentForClipboard = (chatContent: ChatContent): string => {
  const groups = groupChatMessages(chatContent);
  return groups
    .map(g => `[${g.speakerId}] (${secondsToString(g.start)} - ${secondsToString(g.end)}): ${g.text}`)
    .join('\n\n');
};

// New helper to create a compact version of ChatContent by mapping speaker ids to speaker names
export const createChatCompact = (chatContent: ChatContent, speakers: Speaker[]): ChatCompact => {
  const segments = chatContent.segments.map(segment => {
    const speaker = speakers.find(s => s.id === segment.speakerId);
    return {
      speakerName: speaker ? speaker.name : "Unknown",
      text: segment.text,
    };
  });
  return { segments };
};

export const parseChatContent = (
  diarizationResults: DiarizationResult[],
  transcription: WhisperTranscription,
  speakerIds: string[]
): ChatContent => {
  // For each transcription segment, find the diarization segment with the highest overlap.
  const segments = transcription.segments.map(seg => {
    let bestSpeaker = "";
    let bestOverlap = 0;
    const segStart = seg.start;
    const segEnd = seg.end;
    diarizationResults.forEach(diag => {
      const diagStart = diag.startTime;
      const diagEnd = diag.startTime + diag.duration;
      const overlap = Math.max(0, Math.min(segEnd, diagEnd) - Math.max(segStart, diagStart));
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestSpeaker = diag.speaker;
      }
    });
    // Map the best speaker string to the corresponding speakerIds index
    const speakerIndex = parseInt(bestSpeaker.replace(/[^0-9]/g, ''), 10);
    const mappedSpeakerId = speakerIds[speakerIndex];
    return {
      speakerId: mappedSpeakerId,
      start: seg.start,
      end: seg.end,
      text: seg.text
    };
  });
  return { segments };
};
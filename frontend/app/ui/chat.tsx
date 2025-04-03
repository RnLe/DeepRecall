import React from 'react';
import SpeakerCard from './speakerCard';

/**
 * Chat component displays a chronological conversation.
 * It groups consecutive transcript entries from the same speaker.
 *
 * Props:
 *  - conversation (array, required): Array of transcript entries.
 *
 * Each entry should have the following structure:
 *   {
 *     start: number,
 *     end: number,
 *     speaker: string,
 *     speakerId: string,   // Unique identifier (e.g., an MD5 hash of the name)
 *     text: string,
 *     // Optional:
 *     image: string,       // URL for the speaker's image
 *     color: string        // Border color for the speaker's avatar
 *   }
 */
const Chat = ({ conversation }) => {
  // Group consecutive messages from the same speaker.
  const groupedMessages = [];
  let currentGroup = null;

  conversation.forEach((entry) => {
    if (!currentGroup || currentGroup.speakerId !== entry.speakerId) {
      if (currentGroup) {
        groupedMessages.push(currentGroup);
      }
      currentGroup = {
        speakerId: entry.speakerId,
        speakerName: entry.speaker,
        speakerImage: entry.image || null,
        speakerColor: entry.color || null,
        messages: [entry.text],
        start: entry.start,
        end: entry.end,
      };
    } else {
      currentGroup.messages.push(entry.text);
      currentGroup.end = entry.end;
    }
  });
  if (currentGroup) {
    groupedMessages.push(currentGroup);
  }

  return (
    <div className="space-y-4">
      {groupedMessages.map((group, index) => (
        <div key={index} className="flex space-x-3">
          <div>
            <SpeakerCard
              id={group.speakerId}
              name={group.speakerName}
              image={group.speakerImage}
              color={group.speakerColor}
              showName={false}
            />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">
              {group.start.toFixed(2)} - {group.end.toFixed(2)}
            </div>
            <div className="bg-gray-200 p-3 rounded-lg">
              {group.messages.join(' ')}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Chat;

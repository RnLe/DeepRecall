// chat.tsx

import React from 'react';
import SpeakerCard from './speakerCard';

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
    <div className="space-y-4 bg-white dark:bg-gray-900 p-4">
      {groupedMessages.map((group, index) => (
        <div key={index} className="flex space-x-3">
          <div>
            <SpeakerCard
              id={group.speakerId}
              name={group.speakerName}
              image={group.speakerImage}
              color={group.speakerColor}
              showName={true}
            />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {group.start.toFixed(2)} - {group.end.toFixed(2)}
            </div>
            <div className="bg-gray-200 dark:bg-gray-800 p-3 rounded-lg">
              {group.messages.join(' ')}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Chat;

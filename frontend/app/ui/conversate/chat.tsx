import React from 'react';
import { SpeakerData } from './speakerCard';
import { ChatContent } from '../../types/diarizationTypes';
import { secondsToString } from '../../helpers/timesToString';
import { groupChatMessages } from '../../helpers/chatHelpers';

interface ChatProps {
  chatContent: ChatContent;
}

const Chat: React.FC<ChatProps> = ({ chatContent }) => {
  const groupedMessages = groupChatMessages(chatContent);

  return (
    <div className="space-y-4 bg-white dark:bg-gray-900 p-4">
      {groupedMessages.map((group, index) => (
        <div key={index} className="flex items-center space-x-3">
          <div>
            <SpeakerData speakerId={group.speakerId} showName={true} className="w-20" />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {secondsToString(group.start)} — {secondsToString(group.end)}
            </div>
            <div className="bg-gray-200 dark:bg-gray-800 p-3 rounded-lg">
              {group.text}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Chat;

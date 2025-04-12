// conversationCard.tsx
import React, { useEffect, useState } from 'react';
import { SpeakerData } from './speakerCard';
import { Conversation } from '../../helpers/diarizationTypes';
import { agoTimeToString, secondsToString } from '../../helpers/timesToString';

interface ConversationCardProps {
  conversation: Conversation;
  active?: boolean;
  customClass?: string;
  perRow?: number;
  onClick?: () => void;
}

// New TimeAgo component
const TimeAgo: React.FC<{ timestamp: number }> = ({ timestamp }) => {
  const [timeAgo, setTimeAgo] = useState(agoTimeToString(timestamp));

  useEffect(() => {
    const diff = Date.now() / 1000 - timestamp;
    const interval = diff < 60 ? 1000 :
                     diff < 3600 ? 60000 :
                     diff < 86400 ? 3600000 : 86400000;
    const timer = setInterval(() => {
      setTimeAgo(agoTimeToString(timestamp));
    }, interval);
    return () => clearInterval(timer);
  }, [timestamp]);

  return <span>{timeAgo}</span>;
};

const ConversationCard: React.FC<ConversationCardProps> = ({ conversation, active = false, customClass = "", onClick }) => {
  return (
    <div className={`relative ${customClass}`} onClick={onClick}>
      {conversation.backgroundImage && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none cursor-pointer" 
          style={{ backgroundImage: `url(${conversation.backgroundImage})` }}
        />
      )}
      <div className={`h-full cursor-pointer p-4 bg-gray-800 rounded border relative z-10 hover:bg-slate-700 ${active ? "border-blue-500" : "border-gray-700"}`}>
        <h3 className="text-lg font-bold text-white">{conversation.name}</h3>
        <p className="text-gray-300">{conversation.description}</p>
        <p className="text-gray-300">{secondsToString(conversation.length)}</p>
        <p className="text-gray-300">Created <TimeAgo timestamp={conversation.dateCreated} /></p>
        <div className="mt-2 flex space-x-2">
          {conversation.speakers.map((speakerId) => (
            <SpeakerData key={speakerId} speakerId={speakerId} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConversationCard;

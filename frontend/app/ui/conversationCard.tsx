// conversationCard.tsx
import React, { useEffect, useState } from 'react';
import SpeakerCard from './speakerCard';
import { Conversation, Speaker } from '../helpers/diarizationTypes';
import { agoTimeToString, secondsToString } from '../helpers/timesToString';
import { classNames } from 'react-easy-crop/helpers';

interface ConversationCardProps {
  conversation: Conversation;
  active?: boolean;
  customClass?: string;
  perRow?: number;
  onClick?: () => void;
}

// New component to fetch speaker data via the API and render SpeakerCard.
const SpeakerData: React.FC<{ speakerId: string }> = ({ speakerId }) => {
  const [speaker, setSpeaker] = useState<Speaker | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/speakers/${speakerId}`)
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(data => setSpeaker(data.speaker))
      .catch(err => console.error("Error fetching speaker", err));
  }, [speakerId]);

  if (!speaker) return <div>Loading...</div>;
  return <SpeakerCard speaker={speaker} showName={false} onSelect={() => {}} className={"w-12"} />;
};

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

import React from 'react';
import SpeakerCard from './speakerCard';

interface Conversation {
  id: string;
  name: string;
  description: string;
  speakers: string[];
  length: string;
  states?: {
    diarization: boolean;
    transcription: boolean;
    speakerAssignment: boolean;
    report: boolean;
    stats: boolean;
  };
}

interface ConversationCardProps {
  conversation: Conversation;
  active?: boolean;
}

const ConversationCard: React.FC<ConversationCardProps> = ({ conversation, active = false }) => {
  return (
    <div className={`p-4 bg-gray-800 rounded border ${active ? "border-blue-500" : "border-gray-700"}`}>
      <h3 className="text-lg font-bold text-white">{conversation.name}</h3>
      <p className="text-gray-300">{conversation.description}</p>
      <p className="text-gray-300">Length: {conversation.length}</p>
      <div className="mt-2 flex space-x-2">
        {conversation.speakers.map((speakerId) => (
          <SpeakerCard key={speakerId} id={speakerId} name={speakerId} image={undefined} color={undefined} showName={false} />
        ))}
      </div>
    </div>
  );
};

export default ConversationCard;

// speakerCard.tsx
import React from 'react';
import { Speaker } from '../helpers/diarizationTypes';

interface SpeakerCardProps {
  speaker: Speaker;
  showName?: boolean;
  onSelect?: (speaker: Speaker) => void;
}
const SpeakerCard = ({speaker, showName = true, onSelect }: SpeakerCardProps) => {
  // Append a cache-busting query parameter to ensure updated image is loaded
  const imageUrl = speaker.croppedImageUrl 
    ? `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/${speaker.croppedImageUrl}?t=${new Date().getTime()}`
    : 'https://via.placeholder.com/50?text=?';
  
  return (
    <div className="flex flex-col items-center cursor-pointer" onClick={() => onSelect && onSelect({...speaker})}>
      {/* Speaker Image */}
      <img 
        src={imageUrl} 
        alt={speaker.name} 
        className="w-20 h-20 rounded-full object-cover border-2"
        style={{ borderColor: speaker.color || 'transparent' }}
      />
      {showName && <div className="mt-1 text-sm text-white text-center">{speaker.name}</div>}
    </div>
  );
};

export default SpeakerCard;

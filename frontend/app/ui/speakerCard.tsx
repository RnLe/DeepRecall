// speakerCard.tsx
import React from 'react';
import { Speaker } from '../helpers/diarizationTypes';

interface SpeakerCardProps {
  speaker: Speaker;
  showName?: boolean;
  onSelect?: (speaker: Speaker) => void;
  className?: string;
}

const SpeakerCard = ({ speaker, showName = true, onSelect, className }: SpeakerCardProps) => {
  // If the speaker does not have an image, render a dotted circle with a question mark
  if (!speaker.croppedImageUrl) {
    return (
      <div 
        className={`flex flex-col items-center cursor-pointer ${className ?? ''}`}
        onClick={() => onSelect && onSelect({ ...speaker })}
      >
        <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center">
          <span className="text-4xl text-gray-400">?</span>
        </div>
        {showName && <div className="mt-1 text-sm text-white text-center">{speaker.name}</div>}
      </div>
    );
  }
  // Otherwise, render with the image.
  const imageUrl = `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/${speaker.croppedImageUrl}?t=${new Date().getTime()}`;
  return (
    <div 
      className={`flex flex-col items-center cursor-pointer ${className ?? ''}`} 
      onClick={() => onSelect && onSelect({ ...speaker })}
    >
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

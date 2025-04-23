// speakerCard.tsx
import React from 'react';
import { Speaker } from '../../types/conversate/diarizationTypes';
import { useQuery } from '@tanstack/react-query';

interface SpeakerCardProps {
  speaker: Speaker;
  showName?: boolean;
  onSelect?: (speaker: Speaker) => void;
  className?: string;
}

export const SpeakerCard = ({ speaker, showName = true, onSelect, className }: SpeakerCardProps) => {
  // If a preset is selected, use it instead of the uploaded image.
  if (speaker.presetAvatar) {
    return (
      <div 
        className={`flex flex-col items-center cursor-pointer ${className ?? ''}`}
        onClick={() => onSelect && onSelect({ ...speaker })}
      >
        <img 
          src={`/icons/avatarPlaceholders/${speaker.presetAvatar}`} 
          alt={speaker.name} 
          className="w-20 h-20 rounded-full object-cover border-2"
          style={{ borderColor: speaker.color || 'transparent' }}
        />
        {showName && <div className="mt-1 text-base text-white text-center font-semibold">{speaker.name}</div>}
      </div>
    );
  }
  // If the speaker does not have an image, render the placeholder image
  if (!speaker.croppedImageUrl) {
    return (
      <div 
        className={`flex flex-col items-center cursor-pointer ${className ?? ''}`}
        onClick={() => onSelect && onSelect({ ...speaker })}
      >
        <img 
          src="/icons/avatarPlaceholders/avatar_placeholder_generic.png" 
          alt="Placeholder Avatar" 
          className="w-20 h-20 rounded-full object-cover border-2"
          style={{ borderColor: speaker.color || '#4B5563' }}
        />
        {showName && <div className="mt-1 text-base text-white text-center font-semibold">{speaker.name}</div>}
      </div>
    );
  }
  // Otherwise, render with the image.
  const imageUrl = `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/${speaker.croppedImageUrl}`;
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
      {showName && <div className="mt-1 text-base text-white text-center font-semibold">{speaker.name}</div>}
    </div>
  );
};

// This component fetches speaker data from the API and displays it using the SpeakerCard component.
export const SpeakerData: React.FC<{ speakerId: string, showName?: boolean, className?: string }> = ({ speakerId, showName = false, className = "" }) => {
  const { data: speaker, isLoading } = useQuery<Speaker>({
    queryKey: ['speaker', speakerId],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/speakers/${speakerId}`);
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      return data.speaker;
    }
  });

  if (isLoading || !speaker) return <div>Loading...</div>;
  return <SpeakerCard speaker={speaker} showName={showName} onSelect={() => {}} className={className} />;
};
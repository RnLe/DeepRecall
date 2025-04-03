import React from 'react';

/**
 * SpeakerCard component displays a circular avatar for a speaker.
 * 
 * Props:
 *  - id (string, required): Unique identifier for the speaker.
 *  - name (string, required): Name of the speaker.
 *  - image (string, optional): URL for the speaker's image.
 *  - color (string, optional): Border color for the avatar.
 *  - showName (boolean, optional): If true, displays the speaker's name below the avatar.
 */
const SpeakerCard = ({ id, name, image, color, showName = false }) => {
  const imageUrl = `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/${image}` || 'https://via.placeholder.com/50?text=?';
  
  return (
    <div className="flex flex-col items-center">
      <img 
        src={imageUrl} 
        alt={name} 
        className="w-12 h-12 rounded-full object-cover border-2"
        style={{ borderColor: color || 'transparent' }}
      />
      {showName && <div className="mt-1 text-sm text-white">{name}</div>}
    </div>
  );
};

export default SpeakerCard;

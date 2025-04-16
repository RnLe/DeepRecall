// speakerList.tsx

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SpeakerCard } from './speakerCard';
import SpeakerCreationForm from './speakerCreationForm';
import { Speaker } from '../../types/diarizationTypes';

// Fetch speakers from backend.
const fetchSpeakers = async (): Promise<Speaker[]> => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/speakers`);
  if (!res.ok) {
    throw new Error('Failed to fetch speakers');
  }
  const data = await res.json();
  return data.speakers.map((speaker: Speaker) => ({ ...speaker }));
};

const SpeakerList: React.FC = () => {
  const { data: speakers, isLoading, isError } = useQuery<Speaker[]>({
    queryKey: ['speakers'],
    queryFn: fetchSpeakers,
  });
  const [showForm, setShowForm] = useState(false);
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null);

  if (isLoading) {
    return <div className="p-4 text-white">Loading speakers...</div>;
  }
  if (isError) {
    return <div className="p-4 text-red-500">Error loading speakers.</div>;
  }

  return (
    <div className="p-4 bg-gray-900 h-full">
      <h2 className="text-xl font-bold mb-4 text-white">Speakers</h2>
      <div className="grid grid-cols-3 gap-2">
        {speakers?.map((speaker) => (
          <div 
            key={speaker.id} 
            className="flex flex-col items-center cursor-pointer"
            onClick={() => {
              // For a new selection, clear and then set the editing speaker.
              if (editingSpeaker?.id !== speaker.id) {
                setEditingSpeaker(null);
                setTimeout(() => {
                  setEditingSpeaker(speaker);
                  setShowForm(true);
                }, 0);
              } else {
                setEditingSpeaker(speaker);
                setShowForm(true);
              }
            }}
          >
            <SpeakerCard 
              speaker={speaker}
              showName={true}
              onSelect={() => {
                setEditingSpeaker(speaker);
                setShowForm(true);
              }}
            />
          </div>
        ))}
        {/* Plus card for creating a new speaker */}
        <div 
          className="flex flex-col items-center justify-center rounded-full w-20 h-20 cursor-pointer mx-auto"
          style={{ borderWidth: 2, borderStyle: 'solid', borderColor: '#4B5563' }}  // using a default solid color
          onClick={() => {
            setEditingSpeaker(null);
            setShowForm(true);
          }}
        >
          <span className="text-5xl text-gray-400 pb-3">+</span>
        </div>
      </div>
      {showForm && (
        <div 
          onClick={() => { setShowForm(false); setEditingSpeaker(null); }}
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-800 p-4 rounded text-white max-w-md w-full"
          >
            <SpeakerCreationForm 
              speaker={editingSpeaker}
              onSuccess={() => {
                setShowForm(false);
                setEditingSpeaker(null);
              }}
              onCancel={() => {
                setShowForm(false);
                setEditingSpeaker(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SpeakerList;

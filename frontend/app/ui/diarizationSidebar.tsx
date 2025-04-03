import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import SpeakerCard from './speakerCard';
import SpeakerCreationForm from './speakerCreationForm';

interface Speaker {
  id: string;
  name: string;
  img?: string;
  ring_color?: string;
}

const fetchSpeakers = async (): Promise<Speaker[]> => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/speakers`);
  if (!res.ok) {
    throw new Error('Failed to fetch speakers');
  }
  const data = await res.json();
  console.log('Fetched speakers:', data);
  return data.speakers;
};

const DiarizationSidebar: React.FC = () => {
  const { data: speakers, isLoading, isError } = useQuery<Speaker[]>({
    queryKey: ['speakers'],
    queryFn: fetchSpeakers,
  });
  const [showForm, setShowForm] = useState(false);

  if (isLoading) {
    return <div className="p-4 text-white">Loading speakers...</div>;
  }

  if (isError) {
    return <div className="p-4 text-red-500">Error loading speakers.</div>;
  }

  return (
    <div className="p-4 bg-gray-900 h-full">
      <h2 className="text-xl font-bold mb-4 text-white">Speakers</h2>
      <div className="grid grid-cols-3 gap-4">
        {speakers && speakers.map((speaker) => (
          <div key={speaker.id} className="flex flex-col items-center">
            <SpeakerCard 
              id={speaker.id}
              name={speaker.name}
              image={speaker.img}
              color={speaker.ring_color}
              showName={true}
            />
          </div>
        ))}
        {/* Empty card with plus icon to add a new speaker */}
        <div 
          className="flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-full w-12 h-12 cursor-pointer hover:border-blue-400"
          onClick={() => setShowForm(true)}
        >
          <span className="text-3xl text-gray-400 pb-2">+</span>
        </div>
      </div>
      {showForm && (
        <div className="mt-4">
          <SpeakerCreationForm 
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}
    </div>
  );
};

export default DiarizationSidebar;

// SpeakerAudios.tsx
import React, { useState, useEffect } from 'react';
import SpeakerCard from './speakerCard';

interface SpeakerAudio {
  speaker: string;
  audio_file: string;
  duration: number;
}

interface SpeakerAudiosProps {
  convId: string;
  onSelectionChange: (selected: string[]) => void;
}

const SpeakerAudios: React.FC<SpeakerAudiosProps> = ({ convId, onSelectionChange }) => {
  const [speakerAudios, setSpeakerAudios] = useState<SpeakerAudio[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSpeakers, setSelectedSpeakers] = useState<string[]>([]);

  useEffect(() => {
    const fetchSpeakerAudios = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/speaker-audios/${convId}`);
        const data = await res.json();
        if (data.status === "success") {
          setSpeakerAudios(data.speaker_audios);
        } else {
          alert("Failed to fetch speaker audios: " + data.message);
        }
      } catch (error: any) {
        alert("Error fetching speaker audios: " + error.message);
      }
      setLoading(false);
    };
    fetchSpeakerAudios();
  }, [convId]);

  const toggleSpeakerSelection = (speaker: string) => {
    let newSelection: string[] = [];
    if (selectedSpeakers.includes(speaker)) {
      newSelection = selectedSpeakers.filter(s => s !== speaker);
    } else {
      newSelection = [...selectedSpeakers, speaker];
    }
    setSelectedSpeakers(newSelection);
    onSelectionChange(newSelection);
  };

  return (
    <div className="mt-4 p-4 bg-gray-800 rounded text-white">
      <h2 className="text-xl font-bold">Speaker Audios</h2>
      {loading ? (
        <p>Loading speaker audios...</p>
      ) : (
        <div className="space-y-4">
          {speakerAudios.map((item, index) => (
            <div key={index} className="flex items-center justify-between border p-2 rounded">
              <div className="flex items-center space-x-4">
                <SpeakerCard id={item.speaker} name={item.speaker} image={undefined} color={undefined} showName={true} />
                <span className="text-sm">{item.duration.toFixed(2)} sec</span>
              </div>
              <div className="flex items-center space-x-2">
                <audio controls src={`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/files/${encodeURIComponent(item.audio_file)}`} className="w-32"></audio>
                <button 
                  onClick={() => toggleSpeakerSelection(item.speaker)}
                  className={`px-3 py-1 rounded ${selectedSpeakers.includes(item.speaker) ? "bg-green-500" : "bg-gray-600"}`}
                >
                  {selectedSpeakers.includes(item.speaker) ? "Selected" : "Select"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SpeakerAudios;

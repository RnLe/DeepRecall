// MergeTranscript.tsx
import React, { useState } from 'react';
import Chat from './chat';

interface MergeTranscriptProps {
  convId: string;
  onMergeComplete?: (segments: any[]) => void; // Added optional onMergeComplete prop
}

const MergeTranscript: React.FC<MergeTranscriptProps> = ({ convId, onMergeComplete }) => {
  const [selectedSpeakers, setSelectedSpeakers] = useState("");
  const [merging, setMerging] = useState(false);
  const [mergedSegments, setMergedSegments] = useState<any[]>([]);
  const [chatVisible, setChatVisible] = useState(false);

  const handleMerge = async () => {
    setMerging(true);
    try {
      const formData = new FormData();
      formData.append("conv_id", convId);
      formData.append("selected_speakers", selectedSpeakers);
      const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/merge`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.status === "success") {
        setMergedSegments(data.merged_segments);
        setChatVisible(true);
        if (onMergeComplete) {
          onMergeComplete(data.merged_segments); // Call the callback if provided
        }
      } else {
        alert("Merging failed: " + data.message);
      }
    } catch (error: any) {
      alert("Error merging transcript: " + error.message);
    }
    setMerging(false);
  };

  return (
    <div className="mt-4 p-4 bg-gray-800 rounded text-white">
      <h2 className="text-xl font-bold">Merge Transcript & Create Chat</h2>
      <div className="mb-2">
        <label className="block text-sm font-medium">Selected Speakers (comma separated)</label>
        <input
          type="text"
          value={selectedSpeakers}
          onChange={(e) => setSelectedSpeakers(e.target.value)}
          placeholder="e.g., Alice,Bob,Charlie"
          className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded"
        />
      </div>
      <button
        onClick={handleMerge}
        disabled={merging}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded"
      >
        {merging ? "Merging..." : "Merge Transcript"}
      </button>
      {chatVisible && mergedSegments.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold">Chat</h3>
          <Chat chatContent={{
            segments: mergedSegments.map(seg => ({
              start: seg.start,
              end: seg.end,
              speaker: seg.speaker,
              speakerId: seg.speaker, // using speaker name as placeholder ID
              text: seg.text
            }))
          }} />
        </div>
      )}
    </div>
  );
};

export default MergeTranscript;

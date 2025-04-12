import React, { useState } from 'react';

interface StateStatusRowClickableProps {
  convId: string;
  states: {
    diarization: boolean;
    transcript: boolean;
    speakerAudioSegments: boolean;
    speakerAssignment: boolean;
    report: boolean;
    stats: boolean;
  };
}

const StateStatusRowClickable: React.FC<StateStatusRowClickableProps> = ({ convId, states }) => {
  const [modalContent, setModalContent] = useState<string>("");
  const [modalTitle, setModalTitle] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Fetch the details from the backend for the selected type.
  const fetchDetails = async (type: "diarization" | "transcription") => {
    let endpoint = "";
    if (type === "diarization") {
      endpoint = `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/diarization-details/${convId}`;
    } else if (type === "transcription") {
      endpoint = `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/transcription-details/${convId}`;
    }
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      if (type === "diarization") {
        setModalTitle("Diarization Details");
        setModalContent(data.content);
      } else {
        setModalTitle("Transcription Details");
        // Combine the beautified JSON and the timestamp lines.
        setModalContent(
          "Beautified JSON:\n" + data.beautified_json +
          "\n\nTimestamp Lines:\n" + data.timestamp_lines
        );
      }
      setIsModalOpen(true);
    } catch (error) {
      setModalTitle("Error");
      setModalContent("Failed to fetch details.");
      setIsModalOpen(true);
    }
  };

  return (
    <div>
      <div className="flex space-x-4">
        {/* Diarization Card */}
        <div 
          className={`p-2 rounded border cursor-pointer ${states.diarization ? 'bg-green-600' : 'bg-gray-600'}`}
          onClick={() => { if(states.diarization) fetchDetails("diarization") }}
        >
          <span>Diarization: {states.diarization ? "Done" : "Pending"}</span>
        </div>
        {/* Transcription Card */}
        <div 
          className={`p-2 rounded border cursor-pointer ${states.transcript ? 'bg-green-600' : 'bg-gray-600'}`}
          onClick={() => { if(states.transcript) fetchDetails("transcription") }}
        >
          <span>Transcription: {states.transcript ? "Done" : "Pending"}</span>
        </div>
        {/* You can add more cards for other states if needed */}
      </div>

      {/* Floating Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gray-800 p-4 rounded max-w-3xl max-h-full overflow-auto shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">{modalTitle}</h2>
              <button className="text-white" onClick={() => setIsModalOpen(false)}>Close</button>
            </div>
            <pre className="text-sm text-white whitespace-pre-wrap">{modalContent}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default StateStatusRowClickable;

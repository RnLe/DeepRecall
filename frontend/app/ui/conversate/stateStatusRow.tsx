import React from 'react';

interface StateStatusRowProps {
  states: {
    diarization: boolean;
    transcription: boolean;
    speakerAssignment: boolean;
    report: boolean;
    stats: boolean;
  };
}

const stateNames = {
  diarization: "Diarization",
  transcription: "Transcription",
  speakerAssignment: "Speaker Assignment",
  report: "Report",
  stats: "Stats",
};

const StateStatusRow: React.FC<StateStatusRowProps> = ({ states }) => {
  return (
    <div className="flex space-x-2 mb-4">
      {Object.keys(stateNames).map((key) => {
        const stateKey = key as keyof StateStatusRowProps["states"];
        const value = states[stateKey];
        return (
          <div
            key={key}
            className={`px-2 py-1 rounded text-xs font-semibold flex items-center ${
              value ? "bg-green-700 text-green-200" : "bg-gray-600 text-gray-300"
            }`}
          >
            {stateNames[stateKey]}
            {value && <span className="ml-1">&#10003;</span>}
          </div>
        );
      })}
    </div>
  );
};

export default StateStatusRow;

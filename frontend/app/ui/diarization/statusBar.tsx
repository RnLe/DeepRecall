// statusBar.tsx

import React from 'react';

export type StatusType = 'media' | 'diarization' | 'transcription' | 'chat' | 'analysis';

export interface StatusBarProps {
  selectedStatus: StatusType;
  setSelectedStatus: (status: StatusType) => void;
  states?: {
    audioAvailable: boolean;
    diarization: boolean;
    transcript: boolean;
    speakerAssignment: boolean;
  };
  file: File | null;
}

interface StatusCardProps {
  status: StatusType;
  label: string;
  message: string;
  clickable: boolean;
  selected: boolean;
  onClick: () => void;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  status,
  label,
  message,
  clickable,
  selected,
  onClick,
}) => {
  // Use a fallback background color (blue for selected, gray for non-selected)
  const fallbackColor = selected ? '#2563EB' : '#374151';
  // Build the background style using the corresponding image and an overlay gradient.
  const backgroundStyle = {
    background: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(/backgrounds/statusCards/${status}.png)`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundColor: fallbackColor
  };

  // New dynamic classes based on card state.
  const cardClassNames = `p-4 border rounded flex flex-col items-center justify-center transition duration-200 ease-in-out ${
    clickable ? 'cursor-pointer hover:brightness-110 active:scale-95' : 'cursor-not-allowed opacity-50'
  } ${selected ? 'ring-2 ring-blue-500' : ''}`;

  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={cardClassNames}
      style={{ flex: 1, margin: '0 4px', ...backgroundStyle }}
    >
      <h4 className="font-bold">{label}</h4>
      <p className="text-sm">{message}</p>
    </div>
  );
};

export const StatusBar: React.FC<StatusBarProps> = ({
  selectedStatus,
  setSelectedStatus,
  states,
  file,
}) => {
  let mediaMessage = 'No media provided';
  if (file) {
    mediaMessage = 'Media selected';
    if (file.name.toLowerCase().endsWith('.mp3')) {
      mediaMessage += ' (Warning: mp3 format)';
    }
  } else if (states?.audioAvailable) {
    mediaMessage = 'Audio available';
  }
  // Diarization and Transcription become clickable when the audio file is on the server.
  const diarizationClickable = states?.audioAvailable || false;
  const transcriptionClickable = states?.audioAvailable || false;
  const speakerAssignmentClickable = (states?.audioAvailable && states?.diarization) || false;
  const chatClickable = (states?.audioAvailable && states?.diarization && states?.transcript) || false;

  return (
    <div className="flex w-full h-24">
      <StatusCard
        status="media"
        label="Media"
        message={mediaMessage}
        clickable={true}
        selected={selectedStatus === 'media'}
        onClick={() => setSelectedStatus('media')}
      />
      <StatusCard
        status="diarization"
        label="Diarization"
        message={states?.diarization ? 'Diarization available' : 'Not done'}
        clickable={diarizationClickable}
        selected={selectedStatus === 'diarization'}
        onClick={() => diarizationClickable && setSelectedStatus('diarization')}
      />
      <StatusCard
        status="transcription"
        label="Transcription"
        message={states?.transcript ? 'Transcription available' : 'Not done'}
        clickable={transcriptionClickable}
        selected={selectedStatus === 'transcription'}
        onClick={() => transcriptionClickable && setSelectedStatus('transcription')}
      />
      <StatusCard
        status="chat"
        label="Chat"
        message={chatClickable ? 'Chat available' : 'Unavailable'}
        clickable={chatClickable}
        selected={selectedStatus === 'chat'}
        onClick={() => chatClickable && setSelectedStatus('chat')}
      />
      <StatusCard
        status="analysis"
        label="Analysis"
        message="Analysis tools"
        clickable={true}
        selected={selectedStatus === 'analysis'}
        onClick={() => setSelectedStatus('analysis')}
      />
    </div>
  );
};

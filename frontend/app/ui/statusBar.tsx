// statusBar.tsx

import React from 'react';

export type StatusType = 'media' | 'diarization' | 'transcription' | 'speakerAssignment' | 'chat';

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
  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={`p-4 border rounded cursor-${clickable ? 'pointer' : 'not-allowed'} ${
        selected ? 'bg-blue-600' : 'bg-gray-700'
      } flex flex-col items-center justify-center`}
      style={{ flex: 1, margin: '0 4px' }}
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
    <div className="flex w-full">
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
        status="speakerAssignment"
        label="Speaker Assignment"
        message={states?.speakerAssignment ? 'Speakers assigned' : 'Not assigned'}
        clickable={speakerAssignmentClickable}
        selected={selectedStatus === 'speakerAssignment'}
        onClick={() => speakerAssignmentClickable && setSelectedStatus('speakerAssignment')}
      />
      <StatusCard
        status="chat"
        label="Chat"
        message={chatClickable ? 'Chat available' : 'Unavailable'}
        clickable={chatClickable}
        selected={selectedStatus === 'chat'}
        onClick={() => chatClickable && setSelectedStatus('chat')}
      />
    </div>
  );
};

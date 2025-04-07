// diarizationSidebar.tsx
import React from 'react';
import SpeakerList from './speakerList';
import ConversationList from './conversationList';
import { Conversation } from '../helpers/diarizationTypes';

const DiarizationSidebar: React.FC = () => {
  return (
    <div className="p-4 bg-gray-900 h-full">
      <div className="mb-8">
        <SpeakerList />
      </div>
      <div>
        <ConversationList/>
      </div>
    </div>
  );
};

export default DiarizationSidebar;

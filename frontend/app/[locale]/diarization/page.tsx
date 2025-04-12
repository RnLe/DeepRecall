// page.tsx
'use client';

import React from 'react';
import DiarizationSidebar from '@/app/ui/conversate/diarizationSidebar';
import DiarizationWidget from '@/app/ui/conversate/diarizationWidget';
import { ActiveConversationProvider } from '@/app/context/activeConversationContext';

const App: React.FC = () => {
  return (
    <ActiveConversationProvider>
      <div className="flex h-screen overflow-hidden">
        <div className="w-1/4 border-r border-gray-300 overflow-y-auto">
          <DiarizationSidebar />
        </div>
        <div className="flex-1 overflow-auto">
          <DiarizationWidget />
        </div>
      </div>
    </ActiveConversationProvider>
  );
};

export default App;

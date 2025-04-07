// page.tsx
'use client';

import React from 'react';
import DiarizationSidebar from '@/app/ui/diarizationSidebar';
import DiarizationWidget from '@/app/ui/diarizationWidget';
import { ActiveConversationProvider } from '@/app/context/activeConversationContext';

const App: React.FC = () => {
  return (
    <ActiveConversationProvider>
      <div className="flex h-screen bg-gray-900">
        <div className="w-1/4">
          <DiarizationSidebar />
        </div>
        <div className="flex-1">
          <DiarizationWidget />
        </div>
      </div>
    </ActiveConversationProvider>
  );
};

export default App;

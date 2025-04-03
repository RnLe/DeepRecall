'use client';

import React from 'react';
import DiarizationSidebar from '@/app/ui/diarizationSidebar';
import DiarizationWidget from '@/app/ui/diarizationWidget';

export default function DiarizationPage() {
  return (
    <div className="w-full h-full flex">
      {/* Sidebar container (e.g., 25% width) */}
      <div className="w-1/4 overflow-y-auto border-r">
        <DiarizationSidebar />
      </div>
      
      {/* Main widget container */}
      <div className="flex-1 overflow-y-auto bg-slate-800">
        <DiarizationWidget />
      </div>
    </div>
  );
}

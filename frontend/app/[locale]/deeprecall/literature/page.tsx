'use client';

import React from 'react';
import LiteratureList from '@/app/ui/deepRecall/literatureList';
import UploadWidgetModal from '@/app/ui/deepRecall/uploadWidgetModal';

export default function LiteraturePage() {
  return (
    <main className="flex h-full">
      <div className="w-1/4 border-r flex flex-col">
        <div className="flex-1 overflow-hidden">
          <UploadWidgetModal className="h-full" />
        </div>
      </div>
      <div className="w-3/4 flex flex-col">
        <div className="flex-1 overflow-hidden">
          <LiteratureList />
        </div>
      </div>
    </main>
  );
}

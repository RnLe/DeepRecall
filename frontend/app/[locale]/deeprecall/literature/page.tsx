'use client';

import React from 'react';
import LiteratureList from '@/app/ui/deepRecall/literatureList';
import UploadWidgetModal from '@/app/ui/deepRecall/uploadWidgetModal';

export default function LiteraturePage() {
  return (
    <main className="flex h-screen">
      <div className="w-1/4 p-4 border-r">
        <div className="h-full">
          <UploadWidgetModal className="h-full" />
        </div>
      </div>
      <div className="w-3/4 p-4">
        <LiteratureList />
      </div>
    </main>
  );
}

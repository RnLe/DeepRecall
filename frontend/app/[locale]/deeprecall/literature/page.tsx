'use client';

import React from 'react';
import LiteratureList from '@/app/ui/deepRecall/literatureList';
import UploadWidget from '@/app/ui/deepRecall/uploadWidget';
import VersionTypeList from '@/app/ui/deepRecall/versionTypeList';

export default function LiteraturePage() {
  return (
    <div className="w-full h-full flex">
      {/* Left sidebar: 1/3 width, stacked */}
      <div className="w-1/3 flex flex-col border-r border-gray-300">
        {/* Version Types on top */}
        <VersionTypeList
          itemsPerRow={3}
          className="my-6"
          cardClassName="bg-gray-700 text-white"
        />
        {/* Literature list fills remaining */}
        <LiteratureList className="flex-grow" />
      </div>

      {/* Right pane: 2/3 width */}
      <div className="w-2/3">
        <UploadWidget />
      </div>
    </div>
  );
}

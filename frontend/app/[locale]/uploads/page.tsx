// frontend/app/uploads/page.jsx
'use client';

import React from 'react';
import LiteratureList from '@/app/ui/literatureList';
import UploadWidget from '@/app/ui/uploadWidget';

export default function UploadsPage() {
  return (
    <div className="w-full h-full flex">
      {/* Left column: LiteratureList takes 1/3 of the width */}
      <LiteratureList className="w-1/3 border-r border-gray-300" />
      
      {/* Right column: UploadWidget takes 2/3 of the width */}
      <div className="w-2/3">
        <UploadWidget />
      </div>
    </div>
  );
}

import React from 'react';

interface LiteratureCardLProps {
  title: string;
  authors?: string[];
  editionOrVersion?: string | number;
  year?: number;
  uploadedDate?: string;
  thumbnailUrl?: string;
  className?: string;
}

export default function LiteratureCardL({
  title,
  authors = [],
  editionOrVersion,
  year,
  uploadedDate,
  thumbnailUrl,
  className = '',
}: LiteratureCardLProps) {
  return (
    <div className={`flex items-center bg-gray-200 rounded-lg shadow-sm p-4 space-x-4 hover:bg-orange-200 ${className}`}>
      <div className="flex-1">
        <h3 className="text-lg font-semibold truncate">{title}</h3>
        <p className="text-sm text-gray-600 truncate">
          Authors: {authors.length > 0 ? authors.join(', ') : 'Unknown'}
        </p>
        <div className="mt-2 flex flex-wrap text-sm text-gray-500 gap-4">
          <span>Edition: {editionOrVersion ?? 'Unknown'}</span>
          <span>Year: {year ?? 'Unknown'}</span>
          <span>Uploaded: {uploadedDate ?? 'Unknown'}</span>
        </div>
      </div>

      {/* Thumbnail placeholder */}
      <div className="w-32 h-32 bg-gray-400 rounded-lg flex-shrink-0 flex items-center justify-center">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={`${title} thumbnail`} className="object-cover w-full h-full rounded-lg" />
        ) : (
          <span className="text-black">Thumbnail</span>
        )}
      </div>
    </div>
  );
}

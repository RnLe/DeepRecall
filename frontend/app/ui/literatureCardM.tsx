// literatureCardM.tsx
import React from 'react';
import { LiteratureType, LiteratureMetadata } from '../helpers/literatureTypes';
import VersionBannerCardM from './versionBannerCardM';

interface LiteratureCardMProps {
  documentId: string;
  title: string;
  subtitle?: string;
  type: LiteratureType;
  metadata: LiteratureMetadata; // metadata is now required
}

const LiteratureCardM: React.FC<LiteratureCardMProps> = ({ documentId, title, type, metadata, subtitle }) => {
  // Extract versions from metadata (default to an empty array if not provided)
  const versions = metadata.versions ?? [];

  return (
    <div className="border rounded p-4 bg-white shadow-sm">
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      {subtitle && (
        <h4 className="text-sm text-gray-500 truncate">{subtitle}</h4>
      )}
      {versions.length > 0 ? (
        <div className="mt-4 space-y-2">
          {versions.map((version, index) => (
            <VersionBannerCardM key={index} version={version} />
          ))}
        </div>
      ) : (
        <div className="mt-4 text-gray-500">No versions available.</div>
      )}
    </div>
  );
};

export default LiteratureCardM;

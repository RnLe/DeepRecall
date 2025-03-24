// literatureCardM.tsx
import React from 'react';
import { MediaType, Version } from '../helpers/mediaTypes';
import VersionBannerCardM from './versionBannerCardM';

interface LiteratureCardMProps {
  id: number;
  title: string;
  subtitle?: string;
  type: MediaType;
  // Now versions is an array of the actual version objects (TextbookVersion, PaperVersion, or ScriptVersion)
  versions?: Version[];
}

const LiteratureCardM: React.FC<LiteratureCardMProps> = ({ id, title, type, versions, subtitle }) => {
  return (
    <div className="border rounded p-4 bg-white shadow-sm">
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      { subtitle ? (
          <h4 className="text-sm text-gray-500 truncate">{subtitle}</h4>
        ) : null }
      {versions && versions.length > 0 ? (
        <div className="mt-4 space-y-2">
          {versions.map((version) => (
            <VersionBannerCardM key={version.id} version={version} />
          ))}
        </div>
      ) : (
        <div className="mt-4 text-gray-500">No versions available.</div>
      )}
    </div>
  );
};

export default LiteratureCardM;

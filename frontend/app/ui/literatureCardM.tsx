// literatureCardM.tsx
import React from 'react';
import { MediaType } from '../helpers/mediaTypes';
import VersionBannerCardM, { Version } from './versionBannerCardM';

interface LiteratureCardMProps {
  id: number;
  title: string;
  type: MediaType;
  // Now versions is an array of the actual version objects (TextbookVersion, PaperVersion, or ScriptVersion)
  versions?: Version[];
}

const LiteratureCardM: React.FC<LiteratureCardMProps> = ({ id, title, type, versions }) => {
  return (
    <div className="border rounded p-4 bg-white shadow-sm">
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      
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

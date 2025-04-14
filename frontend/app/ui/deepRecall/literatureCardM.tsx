// literatureCardM.tsx
import React from 'react';
import { LiteratureExtended } from '../../helpers/literatureTypes';
import VersionBannerCardM from './versionBannerCardM';

interface LiteratureCardProps {
  literature: LiteratureExtended;
}

const LiteratureCardM: React.FC<LiteratureCardProps> = ({ literature }) => {
  // Destructure known and custom metadata from the literature
  const { title, subtitle, customMetadata, /* versions */ } = literature;

  return (
    <div className="border rounded p-4 bg-gray-800 text-white shadow-sm">
      {title && <h2 className="text-xl font-bold mb-2">{title}</h2>}
      {subtitle && <h4 className="text-sm text-gray-400 truncate">{subtitle}</h4>}
      {/* Optionally render other recommended fields if they exist */}
      {/* Render versions if applicable */}
      {/* {versions && versions.length > 0 ? (
        <div className="mt-4 space-y-2">
          {versions.map((version, index) => (
            <VersionBannerCardM key={index} version={version} />
          ))}
        </div>
      ) : (
        <div className="mt-4 text-gray-400">No versions available.</div>
      )} */}
    </div>
  );
};

export default LiteratureCardM;

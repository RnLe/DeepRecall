// versionBannerCardM.tsx
import React from 'react';
import { LiteratureVersion } from '../helpers/literatureTypes';
import { getStrapiMedia, prefixStrapiUrl } from "../helpers/getStrapiMedia";

export interface VersionBannerCardMProps {
  version: LiteratureVersion;
  className?: string;
  onDownload?: () => void;
  onClick?: () => void;
}

const VersionBannerCardM: React.FC<VersionBannerCardMProps> = ({ version, className = "", onDownload, onClick }) => {
  // Determine the "edition" label based on the version type.
  let editionLabel = "";
  if ('edition_number' in version) {
    editionLabel = `Edition ${version.edition_number}`;
  } else if ('version_number' in version && version.version_number) {
    editionLabel = `Version ${version.version_number}`;
  } else if ('version' in version && version.version) {
    editionLabel = `Version ${version.version}`;
  }

  // Get the year.
  const yearLabel = version.year ? version.year.toString() : "";

  // Pages (page_count): Required field. If not available, show an empty string.
  let pagesLabel = "";
  if (version.page_count) {
    pagesLabel = `${version.page_count} pages`;
  }

  // File size: computed from the file_size property.
  let fileSizeLabel = "";
  if (version.file_size) {
    // Assuming file_size is in bytes. Convert to MB.
    const sizeInMB = (version.file_size / (1024 * 1024)).toFixed(2);
    fileSizeLabel = `${sizeInMB} MB`;
  }

  const thumbnailUrl = prefixStrapiUrl(version.thumbnail_url);

  // Implement onDownload: If onDownload is provided as a prop, call it.
  // Otherwise, attempt to download using the pdf_file property.
  const handleDownload = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (onDownload) {
      onDownload();
    } else if ((version as any).pdf_file) {
      const pdfUrl = getStrapiMedia((version as any).pdf_file);
      if (pdfUrl) {
        fetch(pdfUrl)
          .then((response) => response.blob())
          .then((blob) => {
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            // You can change "file.pdf" to any dynamic name if needed.
            link.setAttribute('download', 'file.pdf');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
          })
          .catch((error) => console.error("Error downloading file:", error));
      }
    }
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-center p-4 border rounded-lg bg-white hover:shadow-lg transition-shadow cursor-pointer ${className}`}
    >
      {/* Left side: 2x2 grid */}
      <div className="grid grid-cols-2 grid-rows-2 gap-2 flex-1">
        <div className="font-bold text-lg">{editionLabel}</div>
        <div className="text-right font-semibold">{fileSizeLabel}</div>
        <div className="text-sm text-gray-600">{yearLabel}</div>
        <div className="text-right text-sm text-gray-600">{pagesLabel}</div>
      </div>

      {/* Middle reserved space for buttons */}
      <div className="mx-4 flex-shrink-0">
        <button 
          onClick={handleDownload}
          className="p-2 border rounded hover:bg-gray-100"
          title="Download"
        >
          {/* Download icon using an inline SVG */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
          </svg>
        </button>
      </div>

      {/* Right side: Thumbnail image */}
      <div className="w-24 h-auto flex-shrink-0">
        {thumbnailUrl ? (
          <img 
            src={thumbnailUrl}
            alt="Version Thumbnail"
            className="w-full h-full object-cover rounded-md"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 rounded-md flex items-center justify-center text-gray-500">
            No Thumbnail
          </div>
        )}
      </div>
    </div>
  );
};

export default VersionBannerCardM;

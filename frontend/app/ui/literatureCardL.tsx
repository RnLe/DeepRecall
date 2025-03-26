// literatureCardL.tsx
import React from 'react';
import { LiteratureType, LiteratureMetadata, Author } from '../helpers/literatureTypes';
import { prefixStrapiUrl } from '../helpers/getStrapiMedia';

// Helper function: compute difference in days (rounded down)
const daysAgo = (dateStr: string): number => {
  const now = new Date();
  const then = new Date(dateStr);
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 3600 * 24));
};

// Helper: get latest updatedAt among literature and its versions
// Since our version objects no longer carry updatedAt, we'll only use literatureUpdatedAt.
const getLatestUpdatedAt = (literatureUpdatedAt: string | undefined): string | undefined => {
  return literatureUpdatedAt;
};

// Helper: get thumbnail URL from the version with highest year
const getLatestThumbnail = (versions?: any[]): string | null => {
  if (!versions || versions.length === 0) return null;
  const sorted = versions.slice().sort((a, b) => b.year - a.year);
  // Now using the new thumbnail_url field from BaseVersion
  return sorted[0].thumbnail_url ? prefixStrapiUrl(sorted[0].thumbnail_url) : null;
};

// Helper: get editions display
const getEditionsDisplay = (type: LiteratureType, versions?: any[]): string => {
  if (!versions || versions.length === 0) return 'Unknown';
  if (type === 'Textbook') {
    const editionNumbers = versions
      .map(v => v.edition_number)
      .filter((num: number | undefined) => num !== undefined);
    if (editionNumbers.length === 0) return 'Unknown';
    const min = Math.min(...editionNumbers);
    const max = Math.max(...editionNumbers);
    return min === max ? String(min) : `${min} - ${max}`;
  } else if (type === 'Paper') {
    const versionsArr = versions
      .map(v => v.version_number)
      .filter((v: string | null | undefined) => !!v);
    return versionsArr.length > 0 ? versionsArr.join(', ') : 'Unknown';
  } else if (type === 'Script') {
    const versionsArr = versions
      .map(v => v.version)
      .filter((v: string | null | undefined) => !!v);
    return versionsArr.length > 0 ? versionsArr.join(', ') : 'Unknown';
  }
  return 'Unknown';
};

// Helper: get years range from versions
const getYearsRange = (versions?: any[]): string => {
  if (!versions || versions.length === 0) return 'Unknown';
  const years = versions.map(v => v.year);
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(min) : `${min} - ${max}`;
};

// Placeholder for author click
const handleAuthorClick = (author: Author) => {
  console.log('Author clicked:', author);
};

interface literatureCardLProps {
  documentId: string;
  title: string;
  subtitle?: string;
  type: LiteratureType;
  metadata: LiteratureMetadata; // Contains version info, etc.
  authors?: Author[];
  className?: string;
}

const LiteratureCardL: React.FC<literatureCardLProps> = ({
  documentId,
  title,
  subtitle,
  type,
  metadata,
  authors = [],
  className = '',
}) => {
  // Extract versions from metadata (our new structure)
  const versions = metadata.versions ?? [];

  const latestThumbnail = getLatestThumbnail(versions);
  // For created/updated dates, use literature's own dates instead of metadata fields.
  // Adjust these if your data model differs.
  const createdDays = documentId ? daysAgo(documentId) : null; // (Example usage; likely you'd use createdAt)
  const latestUpdatedAt = getLatestUpdatedAt(undefined);
  const updatedDays = latestUpdatedAt ? daysAgo(latestUpdatedAt) : null;

  const editionsDisplay = getEditionsDisplay(type, versions);
  const yearsRange = getYearsRange(versions);

  return (
    <div className={`flex items-center bg-gray-200 rounded-lg shadow-sm p-4 space-x-4 hover:shadow-lg ${className}`}>
      <div className="flex-1">
        <h3 className="text-lg font-semibold truncate">{title}</h3>
        {subtitle && (
          <h4 className="text-sm text-gray-500 truncate">{subtitle}</h4>
        )}
        <div className="flex flex-wrap gap-2 mt-1">
          {authors.length > 0 ? (
            authors.map(author => (
              <span
                key={author.id}
                className="px-2 py-1 bg-gray-400 rounded cursor-pointer hover:shadow-lg"
                onClick={() => handleAuthorClick(author)}
              >
                {author.first_name} {author.last_name}
              </span>
            ))
          ) : (
            <span className="text-gray-500">Unknown Authors</span>
          )}
        </div>
        <div className="mt-2 text-sm text-gray-500">
          <p>
            Created: {createdDays !== null ? (createdDays < 1 ? "less than 1 day ago" : `created ${createdDays} days ago`) : 'Unknown'}
          </p>
          <p>
            Updated: {updatedDays !== null ? (updatedDays < 1 ? "less than 1 day ago" : `updated ${updatedDays} days ago`) : 'Unknown'}
          </p>
          <p>Edition(s): {editionsDisplay}</p>
          <p>Year(s): {yearsRange}</p>
        </div>
      </div>

      {/* Thumbnail reserved space */}
      <div className="w-32 h-full flex-shrink-0 flex items-center justify-center bg-gray-200 rounded-lg">
        {latestThumbnail ? (
          <img
            src={latestThumbnail}
            alt={`${title} thumbnail`}
            className="object-cover w-full h-full rounded-lg"
          />
        ) : (
          <span className="text-black">No Thumbnail</span>
        )}
      </div>
    </div>
  );
};

export default LiteratureCardL;

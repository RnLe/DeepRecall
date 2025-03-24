import React from 'react';
import { MediaType, Version } from '../helpers/mediaTypes';
import { Author } from '../helpers/mediaTypes';
import { prefixStrapiUrl } from '../helpers/getStrapiMedia';

// Helper function: compute difference in days (rounded down)
const daysAgo = (dateStr: string): number => {
  const now = new Date();
  const then = new Date(dateStr);
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 3600 * 24));
};

// Helper: get latest updatedAt among literature and its versions
const getLatestUpdatedAt = (literatureUpdatedAt: string | undefined, versions?: Version[]): string | undefined => {
  const dates: number[] = [];
  if (literatureUpdatedAt) dates.push(new Date(literatureUpdatedAt).getTime());
  if (versions) {
    versions.forEach((v) => {
      if (v.updatedAt) dates.push(new Date(v.updatedAt).getTime());
    });
  }
  if (dates.length === 0) return undefined;
  return new Date(Math.max(...dates)).toISOString();
};

// Helper: get thumbnail URL from the version with highest year
const getLatestThumbnail = (versions?: Version[]): string | null => {
  if (!versions || versions.length === 0) return null;
  const sorted = versions.slice().sort((a, b) => b.year - a.year);
  // Assuming each version has a 'thumbnail' field of type MediaFile with a 'url' property.
  return prefixStrapiUrl(sorted[0].thumbnail?.url) ?? null;
};

// Helper: get editions display
const getEditionsDisplay = (type: MediaType, versions?: Version[]): string => {
  if (!versions || versions.length === 0) return 'Unknown';
  if (type === 'Textbook') {
    // Numeric editions
    const editionNumbers = versions
      .map(v => (v as any).edition_number)
      .filter((num: number | undefined) => num !== undefined);
    if (editionNumbers.length === 0) return 'Unknown';
    const min = Math.min(...editionNumbers);
    const max = Math.max(...editionNumbers);
    return min === max ? String(min) : `${min} - ${max}`;
  } else if (type === 'Paper') {
    // Paper: version_number (string)
    const versionsArr = versions
      .map(v => (v as any).version_number)
      .filter((v: string | null | undefined) => !!v);
    return versionsArr.length > 0 ? versionsArr.join(', ') : 'Unknown';
  } else if (type === 'Script') {
    const versionsArr = versions
      .map(v => (v as any).version)
      .filter((v: string | null | undefined) => !!v);
    return versionsArr.length > 0 ? versionsArr.join(', ') : 'Unknown';
  }
  return 'Unknown';
};

// Helper: get years range from versions
const getYearsRange = (versions?: Version[]): string => {
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

interface LiteratureCardLProps {
  id: number;
  title: string;
  subtitle?: string;
  type: MediaType;
  createdAt?: string;
  updatedAt?: string;
  versions?: Version[];
  authors?: Author[];
  className?: string;
}

const LiteratureCardM: React.FC<LiteratureCardLProps> = ({
  id,
  title,
  subtitle,
  type,
  createdAt,
  updatedAt,
  versions,
  authors = [],
  className = '',
}) => {
  const latestThumbnail = getLatestThumbnail(versions);
  const createdDays = createdAt ? daysAgo(createdAt) : null;
  const latestUpdatedAt = getLatestUpdatedAt(updatedAt, versions);
  const updatedDays = latestUpdatedAt ? daysAgo(latestUpdatedAt) : null;

  const editionsDisplay = getEditionsDisplay(type, versions);
  const yearsRange = getYearsRange(versions);

  return (
    <div className={`flex items-center bg-gray-200 rounded-lg shadow-sm p-4 space-x-4 hover:shadow-lg ${className}`}>
      <div className="flex-1">
        <h3 className="text-lg font-semibold truncate">{title}</h3>
        { subtitle ? (
          <h4 className="text-sm text-gray-500 truncate">{subtitle}</h4>
        ) : null }
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

export default LiteratureCardM;

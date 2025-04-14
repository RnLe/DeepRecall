// literatureCardL.tsx

import React from "react";
import { LiteratureExtended, LiteratureVersionExtended } from "../../helpers/literatureTypes";
import { prefixStrapiUrl } from "../../helpers/getStrapiMedia";

/**
 * Helper: Compute the difference in whole days between the supplied date and now.
 */
const daysAgo = (dateStr: string): number => {
  const now = new Date();
  const then = new Date(dateStr);
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 3600 * 24));
};

/**
 * Helper: Returns the thumbnail URL from the version with the most recent publishingDate.
 */
const getLatestThumbnail = (versions?: LiteratureVersionExtended[]): string | null => {
  if (!versions || versions.length === 0) return null;
  const sorted = versions.slice().sort((a, b) => {
    const timeA = a.publishingDate ? new Date(a.publishingDate).getTime() : 0;
    const timeB = b.publishingDate ? new Date(b.publishingDate).getTime() : 0;
    return timeB - timeA;
  });
  return sorted[0].thumbnailUrl ? prefixStrapiUrl(sorted[0].thumbnailUrl) : null;
};

/**
 * Helper: Build a display string for the edition/version information.
 * It checks whether each version has an editionNumber or versionNumber and
 * computes the range (or a single value) accordingly.
 */
const getEditionsDisplay = (versions?: LiteratureVersionExtended[]): string => {
  if (!versions || versions.length === 0) return "Unknown";

  // Check if any version has an editionNumber; otherwise, try versionNumber.
  if (versions[0].editionNumber !== undefined) {
    const editionNumbers = versions
      .map(v => v.editionNumber)
      .filter((num): num is number => num !== undefined);
    if (editionNumbers.length === 0) return "Unknown";
    const min = Math.min(...editionNumbers);
    const max = Math.max(...editionNumbers);
    return min === max ? String(min) : `${min} - ${max}`;
  } else if (versions[0].versionNumber !== undefined) {
    const versionNumbers = versions
      .map(v => v.versionNumber)
      .filter((num): num is number => num !== undefined);
    if (versionNumbers.length === 0) return "Unknown";
    const min = Math.min(...versionNumbers);
    const max = Math.max(...versionNumbers);
    return min === max ? String(min) : `${min} - ${max}`;
  }
  return "Unknown";
};

/**
 * Helper: Extracts a range of years from the versions, based on publishingDate.
 */
const getYearsRange = (versions?: LiteratureVersionExtended[]): string => {
  if (!versions || versions.length === 0) return "Unknown";
  const years = versions
    .map(v => v.publishingDate ? new Date(v.publishingDate).getFullYear() : undefined)
    .filter((y): y is number => y !== undefined);
  if (years.length === 0) return "Unknown";
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(min) : `${min} - ${max}`;
};

/**
 * Placeholder for handling an author click.
 */
const handleAuthorClick = (author: any) => {
  console.log("Author clicked:", author);
};

interface LiteratureCardLProps {
  literature: LiteratureExtended;
  className?: string;
}

/**
 * The LiteratureCardL component shows key literature details,
 * including title, subtitle, authors, creation/update dates,
 * edition/version display, and the thumbnail.
 */
const LiteratureCardL: React.FC<LiteratureCardLProps> = ({
  literature,
  className = "",
}) => {
  const {
    documentId,
    title,
    subtitle,
    authors = [],
    createdAt,
    updatedAt,
    versions,
  } = literature;

  const latestThumbnail = getLatestThumbnail(versions);
  const createdDays = createdAt ? daysAgo(createdAt) : null;
  const updatedDays = updatedAt ? daysAgo(updatedAt) : null;
  const editionsDisplay = getEditionsDisplay(versions);
  const yearsRange = getYearsRange(versions);

  return (
    <div
      className={`flex items-center bg-gray-800 rounded-lg shadow-sm p-4 space-x-4 hover:shadow-lg ${className}`}
    >
      <div className="flex-1">
        <h3 className="text-lg font-semibold truncate text-white">{title}</h3>
        {subtitle && (
          <h4 className="text-sm text-gray-400 truncate">{subtitle}</h4>
        )}
        <div className="flex flex-wrap gap-2 mt-1">
          {authors.length > 0 ? (
            authors.map((author: any) => (
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
            Created:{" "}
            {createdDays !== null
              ? createdDays < 1
                ? "less than 1 day ago"
                : `created ${createdDays} days ago`
              : "Unknown"}
          </p>
          <p>
            Updated:{" "}
            {updatedDays !== null
              ? updatedDays < 1
                ? "less than 1 day ago"
                : `updated ${updatedDays} days ago`
              : "Unknown"}
          </p>
          <p>Edition/Version: {editionsDisplay}</p>
          <p>Year(s): {yearsRange}</p>
        </div>
      </div>

      {/* Thumbnail reserved space */}
      <div className="w-32 h-full flex-shrink-0 flex items-center justify-center bg-gray-700 rounded-lg">
        {latestThumbnail ? (
          <img
            src={latestThumbnail}
            alt={`${title} thumbnail`}
            className="object-cover w-full h-full rounded-lg"
          />
        ) : (
          <span className="text-gray-400">No Thumbnail</span>
        )}
      </div>
    </div>
  );
};

export default LiteratureCardL;

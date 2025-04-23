// literatureCardL.tsx

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteLiterature, updateLiterature } from "../../api/literatureService";
import { LiteratureExtended, Literature } from "../../types/deepRecall/strapi/literatureTypes";
import { VersionExtended } from "../../types/deepRecall/strapi/versionTypes";
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
const getLatestThumbnail = (versions?: VersionExtended[]): string | null => {
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
const getEditionsDisplay = (versions?: VersionExtended[]): string => {
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
const getYearsRange = (versions?: VersionExtended[]): string => {
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
  const queryClient = useQueryClient();

  const delLitMutation = useMutation<void, Error, string>({
    mutationFn: deleteLiterature,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["literature"] }),
  });

  const updateLitMutation = useMutation<Literature, Error, { documentId: string; data: Partial<Literature> }>({
    mutationFn: ({ documentId, data }) => updateLiterature(documentId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["literature"] }),
  });

  const {
    documentId,
    metadata,
    title,
    subtitle,
    authors = "",
    createdAt,
    updatedAt,
    versions,
    publisher,
    journal,
    doi,
  } = literature;
  const latestThumbnail = getLatestThumbnail(versions);
  const createdDays = createdAt ? daysAgo(createdAt) : null;
  const updatedDays = updatedAt ? daysAgo(updatedAt) : null;
  const editionsDisplay = getEditionsDisplay(versions);
  const yearsRange = getYearsRange(versions);

  const handleRemoveLiterature = () => {
    if (documentId && confirm(`Delete literature "${title}"? This cannot be undone.`)) {
      delLitMutation.mutate(documentId);
    }
  };

  const handleRemoveVersion = (toRemove: VersionExtended) => {
    if (!documentId) return;
    if (!confirm(`Remove version from "${title}"?`)) return;
    // parse existing metadata
    let current: any = {};
    try {
      current = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
    } catch {
      current = {};
    }
    const raw = Array.isArray(current.versions) ? current.versions : [];
    // The current metadata has an array with versionMetadata objects which need to be stringified first
    const rawParsed = raw.map((v: any) => {
        const parsed = { ...v };
        if (parsed.versionMetadata) {
          try {
            parsed.versionMetadata = JSON.parse(parsed.versionMetadata);
          } catch {
            parsed.versionMetadata = {};
          }
        }
        return parsed;
      }
    );
    console.log("rawParsed", rawParsed);
    // keep all except the one with matching fileHash
    const filtered = rawParsed.filter((v: any) => v.versionMetadata.fileHash !== toRemove.fileHash);
    const updatedMeta = { ...current, versions: filtered };
    updateLitMutation.mutate({
      documentId,
      data: { metadata: JSON.stringify(updatedMeta) },
    });
  };

  return (
    <div className={`bg-gray-700 rounded-lg shadow-sm p-4 hover:bg-gray-600 hover:shadow-lg transition-colors ${className}`}>
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-semibold text-white whitespace-normal break-words">
          {title}
        </h3>
        <button
          className="text-red-500 hover:text-red-700 text-sm"
          onClick={handleRemoveLiterature}
        >
          Remove Literature
        </button>
      </div>
      {subtitle && <h4 className="text-sm text-gray-400 truncate">{subtitle}</h4>}
      {/* single-string authors */}
      {authors && (
        <p className="mt-1 text-sm text-gray-400 truncate">{authors}</p>
      )}
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
        {editionsDisplay !== "Unknown" && (
          <p>Edition/Version: {editionsDisplay}</p>
        )}
        <p>Year(s): {yearsRange}</p>
        {publisher && <p>Publisher: {publisher}</p>}
        {journal && <p>Journal: {journal}</p>}
        {doi && <p>DOI: {doi}</p>}
      </div>

      <div className="w-32 h-full flex-shrink-0 flex items-center justify-center bg-gray-600 rounded-lg">
        {latestThumbnail ? (
          <img
            src={latestThumbnail}
            alt={`${title} thumbnail`}
            className="object-cover w-full h-full rounded-lg"
          />
        ) : (
          <span className="text-gray-300">No Thumbnail</span>
        )}
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-semibold text-gray-300">
          Versions ({versions.length})
        </h4>
        <div className="flex flex-wrap gap-2 mt-2">
          {versions.map((v, idx) => (
            <div
              key={idx}
              className="relative px-2 py-1 bg-gray-600 rounded cursor-pointer hover:bg-gray-500"
            >
              <span>
                {v.publishingDate
                  ? new Date(v.publishingDate).toLocaleDateString()
                  : "Unknown"}
              </span>
              <span
                className="absolute top-0 right-0 mt-[-4px] mr-[-4px] text-red-400 hover:text-red-600 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveVersion(v);
                }}
              >
                ×
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiteratureCardL;

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
    type,
  } = literature;
  const latestThumbnail = getLatestThumbnail(versions);
  const createdDays = createdAt ? daysAgo(createdAt) : null;
  const updatedDays = updatedAt ? daysAgo(updatedAt) : null;
  const editionsDisplay = getEditionsDisplay(versions);
  const yearsRange = getYearsRange(versions);

  // Type color mapping (same as compact card)
  const getTypeColor = (type: string) => {
    const colors = {
      'paper': 'from-blue-500 to-cyan-500',
      'book': 'from-emerald-500 to-teal-500',
      'article': 'from-purple-500 to-indigo-500',
      'thesis': 'from-orange-500 to-red-500',
      'report': 'from-pink-500 to-rose-500',
      'conference': 'from-yellow-500 to-amber-500',
    };
    return colors[type?.toLowerCase() as keyof typeof colors] || 'from-slate-500 to-slate-600';
  };

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
    <div className={`group relative bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600/50 transition-all duration-300 hover:shadow-lg hover:shadow-black/10 ${className}`}>
      {/* Type indicator */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r opacity-60 rounded-t-xl ${getTypeColor(type || '')}`}></div>
      
      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${getTypeColor(type || '')} shadow-sm`}></div>
              {type && (
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider px-2 py-1 bg-slate-700/30 rounded">
                  {type}
                </span>
              )}
            </div>
            <button
              className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
              onClick={handleRemoveLiterature}
            >
              Remove Literature
            </button>
          </div>

          <h3 className="text-xl font-bold text-slate-100 leading-tight mb-2 group-hover:text-white transition-colors">
            {title}
          </h3>
          
          {subtitle && (
            <h4 className="text-sm text-slate-400 mb-3 leading-relaxed">{subtitle}</h4>
          )}
          
          {authors && (
            <p className="text-sm text-slate-300 mb-4">{authors}</p>
          )}

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-400">
            <p>
              <span className="text-slate-500">Created:</span>{" "}
              {createdDays !== null
                ? createdDays < 1
                  ? "less than 1 day ago"
                  : `${createdDays} days ago`
                : "Unknown"}
            </p>
            <p>
              <span className="text-slate-500">Updated:</span>{" "}
              {updatedDays !== null
                ? updatedDays < 1
                  ? "less than 1 day ago"
                  : `${updatedDays} days ago`
                : "Unknown"}
            </p>
            {editionsDisplay !== "Unknown" && (
              <p><span className="text-slate-500">Edition/Version:</span> {editionsDisplay}</p>
            )}
            <p><span className="text-slate-500">Year(s):</span> {yearsRange}</p>
            {publisher && <p><span className="text-slate-500">Publisher:</span> {publisher}</p>}
            {journal && <p><span className="text-slate-500">Journal:</span> {journal}</p>}
            {doi && <p className="col-span-2"><span className="text-slate-500">DOI:</span> {doi}</p>}
          </div>
        </div>

        {/* Thumbnail - right side with square-like shape */}
        <div className="w-32 h-40 flex-shrink-0 flex items-center justify-center rounded-xl overflow-hidden">
          {latestThumbnail ? (
            <img
              src={latestThumbnail}
              alt={`${title} thumbnail`}
              className="object-cover w-full h-full rounded-xl"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${getTypeColor(type || '')} opacity-20 rounded-xl flex items-center justify-center`}>
              <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Versions section */}
      <div className="mt-6 pt-4 border-t border-slate-700/30">
        <h4 className="text-sm font-semibold text-slate-300 mb-3">
          Versions ({versions.length})
        </h4>
        <div className="flex flex-wrap gap-2">
          {versions.map((v, idx) => (
            <div
              key={idx}
              className="relative px-3 py-2 bg-slate-700/40 backdrop-blur-sm border border-slate-600/30 rounded-lg cursor-pointer hover:bg-slate-600/40 hover:border-slate-500/50 transition-all duration-200 group/version"
            >
              <span className="text-sm text-slate-300">
                {v.publishingDate
                  ? new Date(v.publishingDate).toLocaleDateString()
                  : "Unknown"}
              </span>
              <span
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500/80 hover:bg-red-400 rounded-full flex items-center justify-center text-white text-xs cursor-pointer opacity-0 group-hover/version:opacity-100 transition-opacity"
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

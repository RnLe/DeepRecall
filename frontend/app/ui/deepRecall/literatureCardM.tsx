// literatureCardM.tsx
import React from 'react';
import { LiteratureExtended, getDisplayYear } from '../../types/deepRecall/strapi/literatureTypes';
import { VersionExtended } from '../../types/deepRecall/strapi/versionTypes';
import { prefixStrapiUrl } from '../../helpers/getStrapiMedia';

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

interface LiteratureCardProps {
  literature: LiteratureExtended;
  showThumbnail?: boolean;
  onClick?: () => void;
  onPdfPreview?: () => void;
}

const LiteratureCardM: React.FC<LiteratureCardProps> = ({ literature, showThumbnail = true, onClick, onPdfPreview }) => {
  // Destructure known and custom metadata from the literature
  const { 
    title, 
    subtitle, 
    authors: rawAuthors, 
    journal, 
    doi, 
    publisher, 
    type, 
    versions, 
    customMetadata 
  } = literature;

  // Ensure authors is always an array (handle cases where it might be a string or undefined)
  const authors = Array.isArray(rawAuthors) ? rawAuthors : rawAuthors ? [String(rawAuthors)] : [];

  // Ensure customMetadata is always an object (defensive programming)
  const safeCustomMetadata = customMetadata && typeof customMetadata === 'object' ? customMetadata : {};

  const displayYear = getDisplayYear(literature);

  // Type color mapping
  const getTypeColor = (type: string) => {
    const colors = {
      'paper': 'from-blue-500 to-cyan-500',
      'book': 'from-emerald-500 to-teal-500',
      'article': 'from-purple-500 to-indigo-500',
      'thesis': 'from-orange-500 to-red-500',
      'report': 'from-pink-500 to-rose-500',
      'conference': 'from-yellow-500 to-amber-500',
    };
    return colors[type.toLowerCase() as keyof typeof colors] || 'from-slate-500 to-slate-600';
  };

  const latestThumbnail = getLatestThumbnail(versions);

  return (
    <div 
      className="group relative bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5 hover:border-slate-600/50 transition-all duration-300 hover:shadow-xl hover:shadow-black/20 cursor-pointer"
      onClick={onClick}
    >
      {/* Type indicator */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r opacity-60 rounded-t-xl ${getTypeColor(type)}`}></div>
      
      {/* Main content with thumbnail on right */}
      <div className="flex gap-5">
        {/* Left content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-2">
                <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${getTypeColor(type)} shadow-sm`}></div>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{type}</span>
              </div>
              {title && (
                <h3 className="text-lg font-bold text-slate-100 leading-tight mb-1 group-hover:text-white transition-colors">
                  {displayYear && <span className="text-slate-400 mr-2">({displayYear})</span>}
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Authors */}
          {authors.length > 0 && (
            <div className="flex items-start space-x-2 mb-3">
              <svg className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 line-clamp-2">
                  {authors.slice(0, 6).join(', ')}{authors.length > 6 ? ` +${authors.length - 6}` : ''}
                </p>
              </div>
            </div>
          )}

          {/* Core metadata fields (journal, publisher, DOI) - treated as core fields */}
          {(journal || publisher || doi) && (
            <div className="space-y-2 mb-3">
              {/* Journal */}
              {journal && (
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span className="text-sm text-slate-300">{journal}</span>
                </div>
              )}

              {/* Publisher */}
              {publisher && (
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0h3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="text-sm text-slate-300">{publisher}</span>
                </div>
              )}

              {/* DOI */}
              {doi && (
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <a
                    href={`https://doi.org/${doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {doi}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Custom literature metadata (non-version, non-core fields) */}
          {Object.keys(safeCustomMetadata).length > 0 && (
            <div className="border-t border-slate-700/30 pt-3">
              <div className="space-y-2">
                <span className="text-sm text-slate-400">Custom Fields:</span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(safeCustomMetadata).map(([key, value]) => (
                    <div
                      key={key}
                      className="px-2 py-1 bg-slate-700/30 border border-slate-600/30 rounded text-xs text-slate-300"
                    >
                      <span className="text-slate-400">{key}:</span> {String(value)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right thumbnail */}
        {showThumbnail && (
          <div 
            className="w-32 h-40 flex-shrink-0 hover:scale-105 hover:shadow-lg transition-all duration-200 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              // Open PDF preview modal
              onPdfPreview?.();
            }}
          >
            {latestThumbnail ? (
              <div className="w-full h-full bg-slate-700/30 rounded-lg overflow-hidden border border-slate-600/30">
                <img
                  src={latestThumbnail}
                  alt={`${title} thumbnail`}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${getTypeColor(type)} opacity-20 rounded-lg flex items-center justify-center hover:opacity-30 transition-opacity border border-slate-600/30`}>
                <div className="text-center">
                  <svg className="w-8 h-8 text-slate-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span className="text-xs text-slate-500 font-medium">Preview</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiteratureCardM;

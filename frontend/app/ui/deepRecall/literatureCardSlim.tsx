// literatureCardSlim.tsx
import React from 'react';
import { LiteratureExtended, getDisplayYear } from '../../types/deepRecall/strapi/literatureTypes';
import { VersionExtended } from '../../types/deepRecall/strapi/versionTypes';
import { prefixStrapiUrl } from '../../helpers/getStrapiMedia';

interface LiteratureCardSlimProps {
  literature: LiteratureExtended;
  onClick?: () => void;
  onPdfPreview?: () => void;
}

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

const LiteratureCardSlim: React.FC<LiteratureCardSlimProps> = ({ literature, onClick, onPdfPreview }) => {
  const { 
    title, 
    authors: rawAuthors, 
    journal,
    type,
    versions,
  } = literature;

  // Ensure authors is always an array
  const authors = Array.isArray(rawAuthors) ? rawAuthors : rawAuthors ? [String(rawAuthors)] : [];
  const displayYear = getDisplayYear(literature);
  const latestThumbnail = getLatestThumbnail(versions);

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

  return (
    <div 
      className="group relative bg-slate-800/20 backdrop-blur-sm border border-slate-700/30 rounded-lg p-3 hover:border-slate-600/50 hover:bg-slate-800/40 transition-all duration-200 cursor-pointer"
      onClick={onClick}
    >
      {/* Type indicator */}
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b ${getTypeColor(type)} opacity-60 rounded-l-lg`}></div>
      
      <div className="flex items-center space-x-4 pl-3">
        {/* Clickable thumbnail */}
        <div 
          className="w-8 h-10 flex-shrink-0 rounded overflow-hidden hover:scale-105 hover:shadow-lg transition-all duration-200 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onPdfPreview?.();
          }}
        >
          {latestThumbnail ? (
            <img
              src={latestThumbnail}
              alt={`${title} thumbnail`}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${getTypeColor(type)} opacity-20 flex items-center justify-center hover:opacity-30 transition-opacity`}>
              <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3">
            {title && (
              <h3 className="text-sm font-semibold text-slate-100 truncate group-hover:text-white transition-colors">
                {displayYear && <span className="text-slate-400 mr-2">({displayYear})</span>}
                {title}
              </h3>
            )}
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider px-2 py-0.5 bg-slate-700/30 rounded">
              {type}
            </span>
          </div>
          
          {/* Secondary info */}
          <div className="flex items-center space-x-4 mt-1 text-xs text-slate-400">
            {authors.length > 0 && (
              <span className="truncate max-w-xs">
                {authors.slice(0, 3).join(', ')}{authors.length > 3 ? '...' : ''}
              </span>
            )}
            {journal && (
              <>
                <span>•</span>
                <span className="truncate max-w-xs">{journal}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-3 flex-shrink-0">
          <div className="w-2 h-2 bg-emerald-500 rounded-full opacity-60"></div>
        </div>
      </div>
    </div>
  );
};

export default LiteratureCardSlim;

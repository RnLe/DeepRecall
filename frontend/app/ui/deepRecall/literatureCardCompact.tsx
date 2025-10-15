// literatureCardCompact.tsx
import React from 'react';
import { LiteratureExtended, getDisplayYear, isLiteratureRead, isLiteratureFavorite } from '../../types/deepRecall/strapi/literatureTypes';
import { VersionExtended } from '../../types/deepRecall/strapi/versionTypes';
import { prefixStrapiUrl } from '../../helpers/getStrapiMedia';
import { Glasses, Star, CheckSquare, Square } from 'lucide-react';

interface LiteratureCardCompactProps {
  literature: LiteratureExtended;
  onClick?: () => void;
  onPdfPreview?: () => void;
  isSelectionMode?: boolean;
  isMultiSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
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

const LiteratureCardCompact: React.FC<LiteratureCardCompactProps> = ({ 
  literature, 
  onClick, 
  onPdfPreview, 
  isSelectionMode = false,
  isMultiSelectMode = false,
  isSelected = false,
  onToggleSelection
}) => {
  const { 
    title, 
    authors: rawAuthors, 
    type,
    versions,
  } = literature;

  // Ensure authors is always an array
  const authors = Array.isArray(rawAuthors) ? rawAuthors : rawAuthors ? [String(rawAuthors)] : [];
  const latestThumbnail = getLatestThumbnail(versions);
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

  return (
    <div 
      className={`group relative backdrop-blur-sm rounded-xl p-4 transition-all duration-300 aspect-[4/3] flex flex-col cursor-pointer ${
        isMultiSelectMode && isSelected
          ? 'bg-blue-800/30 border-2 border-blue-500/60 hover:border-blue-400 hover:bg-blue-800/40 shadow-lg shadow-blue-500/20'
          : isSelectionMode 
            ? 'bg-emerald-800/20 border-2 border-emerald-500/60 hover:border-emerald-400 hover:bg-emerald-800/30 shadow-lg shadow-emerald-500/20' 
            : 'bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 hover:shadow-lg hover:shadow-black/10'
      }`}
      onClick={onClick}
    >
      {/* Multi-select checkbox */}
      {isMultiSelectMode && (
        <div 
          className="absolute top-2 left-2 z-10 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelection?.();
          }}
        >
          {isSelected ? (
            <CheckSquare className="w-5 h-5 text-blue-500" />
          ) : (
            <Square className="w-5 h-5 text-slate-400 hover:text-slate-300" />
          )}
        </div>
      )}
      
      {/* Add to collection indicator */}
      {isSelectionMode && !isMultiSelectMode && (
        <div className="absolute top-2 left-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center z-10">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
      )}
      {/* Type indicator */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r opacity-60 rounded-t-xl ${getTypeColor(type)}`}></div>
      
      {/* Top section with type info and thumbnail */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center space-x-2 flex-1 min-w-0 mr-3">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider truncate">{type}</span>
        </div>
        
        {/* Top-right thumbnail with A4 ratio */}
        <div className="relative">
          <div 
            className="w-16 h-20 flex-shrink-0 rounded-md overflow-hidden hover:scale-105 hover:shadow-lg transition-all duration-200 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onPdfPreview?.();
            }}
          >
            {latestThumbnail ? (
              <img
                src={latestThumbnail}
                alt={`${title} thumbnail`}
                className="object-cover w-full h-full rounded-md"
              />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${getTypeColor(type)} opacity-20 rounded-md flex items-center justify-center hover:opacity-30 transition-opacity`}>
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            )}
          </div>
          
          {/* Status icons - positioned on top right of thumbnail */}
          <div className="absolute -top-1 -right-1 flex flex-col gap-0.5">
            {isLiteratureRead(literature) && (
              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                <Glasses className="w-2 h-2 text-white" />
              </div>
            )}
            {isLiteratureFavorite(literature) && (
              <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center shadow-sm">
                <Star className="w-2 h-2 text-white fill-current" />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Main content area - full width */}
      <div className="flex-1 flex flex-col">
        {title && (
          <h3 className="text-sm font-bold text-slate-100 leading-tight mb-2 group-hover:text-white transition-colors line-clamp-2">
            {displayYear && <span className="text-slate-400 mr-1">({displayYear})</span>}
            {title}
          </h3>
        )}

        {/* Authors - full width */}
        {authors.length > 0 && (
          <div className="mb-2">
            <p className="text-xs text-slate-400 line-clamp-1">
              {authors.slice(0, 2).join(', ')}{authors.length > 2 ? ` +${authors.length - 2}` : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiteratureCardCompact;

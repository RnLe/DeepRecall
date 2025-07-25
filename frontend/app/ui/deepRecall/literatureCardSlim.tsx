// literatureCardSlim.tsx
import React from 'react';
import { LiteratureExtended } from '../../types/deepRecall/strapi/literatureTypes';

interface LiteratureCardSlimProps {
  literature: LiteratureExtended;
}

const LiteratureCardSlim: React.FC<LiteratureCardSlimProps> = ({ literature }) => {
  const { 
    title, 
    authors: rawAuthors, 
    journal,
    type,
    versions,
  } = literature;

  // Ensure authors is always an array
  const authors = Array.isArray(rawAuthors) ? rawAuthors : rawAuthors ? [String(rawAuthors)] : [];
  const versionCount = versions?.length || 0;

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
    <div className="group relative bg-slate-800/20 backdrop-blur-sm border border-slate-700/30 rounded-lg p-3 hover:border-slate-600/50 hover:bg-slate-800/40 transition-all duration-200">
      {/* Type indicator */}
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b ${getTypeColor(type)} opacity-60 rounded-l-lg`}></div>
      
      <div className="flex items-center space-x-4 pl-3">
        {/* Type icon */}
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getTypeColor(type)} opacity-20 flex items-center justify-center flex-shrink-0`}>
          <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${getTypeColor(type)}`}></div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3">
            {title && (
              <h3 className="text-sm font-semibold text-slate-100 truncate group-hover:text-white transition-colors">
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
          <span className="text-xs text-slate-500">
            {versionCount} {versionCount === 1 ? 'version' : 'versions'}
          </span>
          <div className="w-2 h-2 bg-emerald-500 rounded-full opacity-60"></div>
        </div>
      </div>
    </div>
  );
};

export default LiteratureCardSlim;

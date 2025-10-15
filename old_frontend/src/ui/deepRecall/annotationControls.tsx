// src/components/deepRecall/annotationControls.tsx
import React from 'react';
import { 
  Search, 
  Filter, 
  SortAsc, 
  Grid, 
  List, 
  LayoutGrid, 
  RotateCcw 
} from 'lucide-react';
import { SortMode, ViewMode } from './literatureAnnotationList';
import { annotationTypes } from '../../types/deepRecall/strapi/annotationTypes';

interface AnnotationControlsProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
  sortBy: SortMode;
  onSortChange: (sort: SortMode) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  totalCount: number;
  filteredCount: number;
  availableTypes?: string[];
  onResetFilters?: () => void;
}

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'date', label: 'Creation Date' },
  { value: 'title', label: 'Title (A-Z)' },
  { value: 'type', label: 'Type' },
  { value: 'page', label: 'Page Number' },
];

const VIEW_MODE_OPTIONS: { value: ViewMode; icon: React.ReactNode; label: string }[] = [
  { value: 'grid', icon: <Grid size={16} />, label: 'Grid View' },
  { value: 'list', icon: <List size={16} />, label: 'List View' },
  { value: 'compact', icon: <LayoutGrid size={16} />, label: 'Compact View' },
];

const AnnotationControls: React.FC<AnnotationControlsProps> = ({
  searchTerm,
  onSearchChange,
  selectedType,
  onTypeChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  totalCount,
  filteredCount,
  availableTypes = ['all', ...annotationTypes],
  onResetFilters
}) => {
  const hasActiveFilters = searchTerm.length > 0 || selectedType !== 'all';
  const isFiltered = filteredCount !== totalCount;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search annotations by title, description, notes, or type..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
        />
        {searchTerm && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
            title="Clear search"
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      {/* Controls Row */}
      <div className="flex items-center justify-between">
        {/* Left side - Filters and Sort */}
        <div className="flex items-center space-x-4">
          {/* Type Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedType}
              onChange={(e) => onTypeChange(e.target.value)}
              className="px-3 py-1 bg-slate-800/50 border border-slate-700/50 rounded text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-w-32"
            >
              {availableTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Types' : type}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center space-x-2">
            <SortAsc className="w-4 h-4 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortMode)}
              className="px-3 py-1 bg-slate-800/50 border border-slate-700/50 rounded text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-w-36"
            >
              {SORT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              onClick={onResetFilters}
              className="flex items-center space-x-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded transition-colors"
              title="Reset all filters"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Right side - View modes and count */}
        <div className="flex items-center space-x-4">
          {/* Results count */}
          <div className="text-sm text-slate-400">
            {isFiltered ? (
              <span>
                Showing <span className="text-slate-200 font-medium">{filteredCount}</span> of{' '}
                <span className="text-slate-200 font-medium">{totalCount}</span> annotations
              </span>
            ) : (
              <span>
                <span className="text-slate-200 font-medium">{totalCount}</span> annotation{totalCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-800/50 border border-slate-700/50 rounded-lg p-1">
            {VIEW_MODE_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => onViewModeChange(option.value)}
                className={`p-1.5 rounded transition-all duration-200 ${
                  viewMode === option.value
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
                title={option.label}
              >
                {option.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-400">Active filters:</span>
          {searchTerm && (
            <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
              Search: "{searchTerm}"
            </span>
          )}
          {selectedType !== 'all' && (
            <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded border border-green-500/30">
              Type: {selectedType}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default AnnotationControls;

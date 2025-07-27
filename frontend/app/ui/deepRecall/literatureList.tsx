// literatureList.tsx

import React, { useState, useMemo } from 'react';
import { useLiterature, useLiteratureTypes } from '../../customHooks/useLiterature';
import LiteratureCardM from './literatureCardM';
import LiteratureCardCompact from './literatureCardCompact';
import LiteratureCardSlim from './literatureCardSlim';
import LiteratureDetailModal from './literatureDetailModal';
import EditLiteratureModal from './editLiteratureModal';
import AddVersionModal from './addVersionModal';
import CreateLiteratureModal from './createLiteratureModal';
import PdfPreviewModal from './pdfPreviewModal';
import { LiteratureType, LiteratureExtended } from '../../types/deepRecall/strapi/literatureTypes';
import { groupLiteraturesByType } from '@/app/helpers/groupLiterature';
import { LayoutGrid, List, Rows3, Search, X, Plus } from 'lucide-react';

interface LiteratureListProps {
  className?: string;
}

type ViewMode = 'rich' | 'compact' | 'slim';
type SortMode = 'title' | 'type' | 'date' | 'authors';
type GroupMode = 'none' | 'type';

// Utility function to capitalize the first letter of a string
const capitalizeFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export default function LiteratureList({ className }: LiteratureListProps) {
  const { data: literatures, isLoading, error } = useLiterature();
  const { data: literatureTypes, isLoading: isTypesLoading, error: typesError } = useLiteratureTypes();
  
  // View settings
  const [viewMode, setViewMode] = useState<ViewMode>('rich');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortMode>('title');
  const [groupBy, setGroupBy] = useState<GroupMode>('type');

  // Modal state
  const [selectedLiterature, setSelectedLiterature] = useState<LiteratureExtended | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddVersionModalOpen, setIsAddVersionModalOpen] = useState(false);
  const [isCreateLiteratureModalOpen, setIsCreateLiteratureModalOpen] = useState(false);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);

  // Handlers for modal
  const handleLiteratureClick = (literature: LiteratureExtended) => {
    setSelectedLiterature(literature);
    setIsDetailModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsDetailModalOpen(false);
    setSelectedLiterature(null);
  };

  const handleEditLiterature = () => {
    setIsDetailModalOpen(false);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedLiterature(null);
  };

  const handleSaveLiterature = (updatedData: Partial<LiteratureExtended>) => {
    // TODO: Implement save functionality
    console.log('Save literature:', updatedData);
    setIsEditModalOpen(false);
    setSelectedLiterature(null);
  };

  const handleAddVersion = (file?: File) => {
    setIsDetailModalOpen(false);
    setIsAddVersionModalOpen(true);
    setDroppedFile(file || null);
  };

  const handleCloseAddVersionModal = () => {
    setIsAddVersionModalOpen(false);
    setSelectedLiterature(null);
    setDroppedFile(null);
  };

  const handleCreateVersion = (versionData: any) => {
    // Version creation is handled by the VersionForm component via API calls
    // After success, this callback is triggered
    setIsAddVersionModalOpen(false);
    setDroppedFile(null);
  };

  const handleCreateLiterature = () => {
    // Literature creation is handled by the LiteratureForm component via API calls
    // The form will automatically update the literature query on success
    setIsCreateLiteratureModalOpen(false);
  };

  const handlePdfPreviewOpen = (literature: LiteratureExtended) => {
    setSelectedLiterature(literature);
    setIsPdfPreviewOpen(true);
  };

  const handlePdfPreviewClose = () => {
    setIsPdfPreviewOpen(false);
    setSelectedLiterature(null);
  };

  // Filter and sort literature
  const filteredAndSortedLiterature = useMemo(() => {
    if (!literatures) return [];
    
    let filtered = literatures.filter(lit => {
      const matchesSearch = !searchTerm || 
        lit.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lit.subtitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (Array.isArray(lit.authors) ? lit.authors : []).some(author => 
          author.toLowerCase().includes(searchTerm.toLowerCase())
        );
      
      const matchesType = !selectedType || lit.type === selectedType;
      
      return matchesSearch && matchesType;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'type':
          return a.type.localeCompare(b.type);
        case 'date':
          return new Date(b.updatedAt || '').getTime() - new Date(a.updatedAt || '').getTime();
        case 'authors':
          const aAuthors = Array.isArray(a.authors) ? a.authors[0] || '' : '';
          const bAuthors = Array.isArray(b.authors) ? b.authors[0] || '' : '';
          return aAuthors.localeCompare(bAuthors);
        default:
          return 0;
      }
    });

    return filtered;
  }, [literatures, searchTerm, selectedType, sortBy]);

  // Group literature if needed
  const groupedLiterature = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Literature': filteredAndSortedLiterature };
    }
    return groupLiteraturesByType(filteredAndSortedLiterature);
  }, [filteredAndSortedLiterature, groupBy]);

  if (isLoading || isTypesLoading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-6">
          <div className="space-y-3">
            <div className="h-6 bg-slate-700 rounded w-1/4"></div>
            <div className="h-16 bg-slate-700 rounded"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-slate-700 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || typesError) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="bg-red-950/20 border border-red-900/20 rounded-xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <h3 className="text-red-400 font-semibold">Error Loading Literature</h3>
          </div>
          <p className="text-red-300 mt-2">
            {(error as Error)?.message || (typesError as Error)?.message}
          </p>
        </div>
      </div>
    );
  }

  const totalCount = filteredAndSortedLiterature.length;
  const groupCount = Object.keys(groupedLiterature).length;

  // Get grid classes based on view mode
  const getGridClasses = () => {
    switch (viewMode) {
      case 'compact':
        return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4';
      case 'slim':
        return 'space-y-2';
      case 'rich':
      default:
        return 'grid grid-cols-1 lg:grid-cols-2 gap-4';
    }
  };

  const renderLiteratureCard = (item: any) => {
    switch (viewMode) {
      case 'compact':
        return <LiteratureCardCompact key={item.documentId} literature={item} onClick={() => handleLiteratureClick(item)} onPdfPreview={() => handlePdfPreviewOpen(item)} />;
      case 'slim':
        return <LiteratureCardSlim key={item.documentId} literature={item} onClick={() => handleLiteratureClick(item)} onPdfPreview={() => handlePdfPreviewOpen(item)} />;
      case 'rich':
      default:
        return <LiteratureCardM key={item.documentId} literature={item} showThumbnail={true} onClick={() => handleLiteratureClick(item)} onPdfPreview={() => handlePdfPreviewOpen(item)} />;
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Fixed Header with Controls */}
      <div className="flex-shrink-0 p-6 pb-0">
        {/* Title and stats */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-blue-600 rounded-full"></div>
          <h1 className="text-2xl font-bold text-slate-100">Literature Library</h1>
          <div className="flex-1 h-px bg-gradient-to-r from-slate-700 to-transparent"></div>
          <div className="flex items-center space-x-4 text-sm">
            <span className="text-slate-400">{totalCount} items</span>
            {groupBy !== 'none' && (
              <>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">{groupCount} {groupBy === 'type' ? 'types' : 'groups'}</span>
              </>
            )}
          </div>
          <button
            onClick={() => setIsCreateLiteratureModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">New Literature</span>
          </button>
        </div>

        {/* Search bar */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search literature by title, subtitle, or authors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <X className="h-5 w-5 text-slate-400 hover:text-slate-300" />
            </button>
          )}
        </div>

        {/* View and Filter Controls */}
        <div className="flex items-center gap-4 mb-6">
          {/* View Mode Section */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-slate-400 whitespace-nowrap">View:</span>
            <div className="flex bg-slate-800/50 rounded-lg p-0.5 border border-slate-700/50">
              <button
                onClick={() => setViewMode('rich')}
                className={`flex items-center justify-center p-1.5 rounded-md transition-all duration-200 ${
                  viewMode === 'rich'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
                title="Rich View"
              >
                <Rows3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('compact')}
                className={`flex items-center justify-center p-1.5 rounded-md transition-all duration-200 ${
                  viewMode === 'compact'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('slim')}
                className={`flex items-center justify-center p-1.5 rounded-md transition-all duration-200 ${
                  viewMode === 'slim'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Type Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-slate-400 whitespace-nowrap">Type:</span>
            <div className="flex bg-slate-800/30 border border-slate-700/50 rounded-lg p-0.5 gap-1">
              <button
                onClick={() => setSelectedType(null)}
                className={`px-2 py-1 rounded text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                  !selectedType
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-600/50'
                }`}
              >
                All
              </button>
              {literatureTypes?.slice(0, 4).map((type: LiteratureType) => (
                <button
                  key={type.documentId}
                  onClick={() => setSelectedType(type.name)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                    selectedType === type.name
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-600/50'
                  }`}
                >
                  {capitalizeFirstLetter(type.name)}
                </button>
              ))}
            </div>
          </div>

          {/* Sort Options */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-slate-400 whitespace-nowrap">Sort:</span>
            <div className="flex bg-slate-800/30 border border-slate-700/50 rounded-lg p-0.5 gap-1">
              {[
                { value: 'title', label: 'Title' },
                { value: 'type', label: 'Type' },
                { value: 'authors', label: 'Authors' },
                { value: 'date', label: 'Updated' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSortBy(option.value as SortMode)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                    sortBy === option.value
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-600/50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Group Options */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-slate-400 whitespace-nowrap">Group:</span>
            <div className="flex bg-slate-800/30 border border-slate-700/50 rounded-lg p-0.5 gap-1">
              <button
                onClick={() => setGroupBy('none')}
                className={`px-2 py-1 rounded text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                  groupBy === 'none'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-600/50'
                }`}
              >
                None
              </button>
              <button
                onClick={() => setGroupBy('type')}
                className={`px-2 py-1 rounded text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                  groupBy === 'type'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-600/50'
                }`}
              >
                By Type
              </button>
            </div>
          </div>

          {/* Clear Filters */}
          {(searchTerm || selectedType) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedType(null);
              }}
              className="ml-auto px-3 py-1.5 bg-slate-700/50 text-slate-300 text-xs font-medium rounded-lg hover:bg-slate-600/50 transition-colors border border-slate-600/50 whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Literature Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {totalCount === 0 ? (
          <div className="text-center py-12">
          <div className="w-16 h-16 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-300 mb-2">
            {searchTerm || selectedType ? 'No matching literature found' : 'No literature available'}
          </h3>
          <p className="text-slate-500">
            {searchTerm || selectedType 
              ? 'Try adjusting your search or filters to find what you\'re looking for.'
              : 'Start by adding your first literature entry to build your library.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedLiterature).map(([groupName, items]) => {
            if (items.length === 0) return null;

            return (
              <section key={groupName} className="space-y-4">
                {groupBy !== 'none' && (
                  <div className="flex items-center space-x-3">
                    <h2 className="text-lg font-semibold text-slate-200">
                      {groupName === 'All Literature' ? groupName : capitalizeFirstLetter(groupName)}
                    </h2>
                    <div className="flex-1 h-px bg-slate-700/50"></div>
                    <span className="text-sm text-slate-400 font-medium">
                      {items.length} {items.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                )}
                
                <div className={getGridClasses()}>
                  {items.map(renderLiteratureCard)}
                </div>
              </section>
            );
          })}
        </div>
      )}
      </div>

      {/* Literature Detail Modal */}
      {selectedLiterature && (
        <LiteratureDetailModal
          literature={selectedLiterature}
          isOpen={isDetailModalOpen}
          onClose={handleCloseModal}
          onEdit={handleEditLiterature}
          onAddVersion={handleAddVersion}
        />
      )}

      {/* Edit Literature Modal */}
      {selectedLiterature && (
        <EditLiteratureModal
          literature={selectedLiterature}
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          onSave={handleSaveLiterature}
        />
      )}

      {/* Add Version Modal */}
      {selectedLiterature && (
        <AddVersionModal
          literature={selectedLiterature}
          isOpen={isAddVersionModalOpen}
          onClose={handleCloseAddVersionModal}
          onAddVersion={handleCreateVersion}
          initialFile={droppedFile || undefined}
        />
      )}

      {/* Create Literature Modal */}
      <CreateLiteratureModal
        isOpen={isCreateLiteratureModalOpen}
        onClose={() => setIsCreateLiteratureModalOpen(false)}
        onCreateLiterature={handleCreateLiterature}
      />

      {/* PDF Preview Modal */}
      {selectedLiterature && (
        <PdfPreviewModal
          literature={selectedLiterature}
          isOpen={isPdfPreviewOpen}
          onClose={handlePdfPreviewClose}
        />
      )}
    </div>
  );
}

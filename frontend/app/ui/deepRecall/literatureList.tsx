// literatureList.tsx

import React, { useState, useMemo, useEffect } from 'react';
import { useLiterature, useLiteratureTypes, useUpdateLiterature } from '../../customHooks/useLiterature';
import { useCollections, useAddLiteratureToCollection, useRemoveLiteratureFromCollection } from '../../customHooks/useCollections';
import LiteratureCardM from './literatureCardM';
import LiteratureCardL from './literatureCardL';
import LiteratureCardCompact from './literatureCardCompact';
import LiteratureCardSlim from './literatureCardSlim';
import LiteratureDetailModal from './literatureDetailModal';
import EditLiteratureModal from './editLiteratureModal';
import AddVersionModal from './addVersionModal';
import CreateLiteratureModal from './createLiteratureModal';
import PdfPreviewModal from './pdfPreviewModal';
import { LiteratureType, LiteratureExtended, isLiteratureRead, isLiteratureFavorite } from '../../types/deepRecall/strapi/literatureTypes';
import { groupLiteraturesByType } from '@/app/helpers/groupLiterature';
import { LayoutGrid, List, Rows3, Search, X, Plus, Upload, BookOpen, Glasses, Star, CheckSquare, Square, Edit3, Check } from 'lucide-react';

interface LiteratureListProps {
  className?: string;
  selectedCollection?: string | null;
  collectionEditMode?: string | null; // Collection ID we're adding literature to
  onCollectionEditComplete?: () => void; // Called when edit mode is finished
}

type ViewMode = 'rich' | 'compact' | 'slim';
type SortMode = 'title' | 'type' | 'date' | 'authors';
type GroupMode = 'none' | 'type';
type BulkAction = 'favorite' | 'read' | 'collection' | 'unread' | 'unfavorite';

// Utility function to capitalize the first letter of a string
const capitalizeFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

// Utility function to format file size in a human-readable format
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

// Utility function to calculate total size of all PDFs in literature items
const calculateTotalSize = (literatures: LiteratureExtended[]): number => {
  return literatures.reduce((total, literature) => {
    if (!literature.versions) return total;
    
    const versionsSize = literature.versions.reduce((versionTotal, version) => {
      // Use cached file size from version metadata
      if (version.fileSize) {
        return versionTotal + version.fileSize;
      }
      
      // Legacy: Check custom metadata
      if (version.customMetadata?.fileSize) {
        return versionTotal + version.customMetadata.fileSize;
      }
      
      return versionTotal;
    }, 0);
    
    return total + versionsSize;
  }, 0);
};

// Utility function to calculate total annotation count
const calculateTotalAnnotations = (literatures: LiteratureExtended[]): number => {
  return literatures.reduce((total, literature) => {
    if (!literature.versions) return total;
    
    const annotationCount = literature.versions.reduce((versionTotal, version) => {
      return versionTotal + (typeof version.annotationCount === 'number' ? version.annotationCount : 0);
    }, 0);
    
    return total + annotationCount;
  }, 0);
};

export default function LiteratureList({ 
  className, 
  selectedCollection, 
  collectionEditMode,
  onCollectionEditComplete 
}: LiteratureListProps) {
  const { data: literatures, isLoading, error } = useLiterature();
  const { data: literatureTypes, isLoading: isTypesLoading, error: typesError } = useLiteratureTypes();
  const { data: collections } = useCollections();
  
  // Collection mutation hooks
  const addLiteratureToCollectionMutation = useAddLiteratureToCollection();
  const removeLiteratureFromCollectionMutation = useRemoveLiteratureFromCollection();
  
  // Literature mutation hooks
  const updateLiteratureMutation = useUpdateLiterature();
  
  // View settings
  const [viewMode, setViewMode] = useState<ViewMode>('slim');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortMode>('title');
  const [groupBy, setGroupBy] = useState<GroupMode>('type');
  const [showReadOnly, setShowReadOnly] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Multi-selection state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedLiteratureIds, setSelectedLiteratureIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [targetCollectionId, setTargetCollectionId] = useState<string | null>(null);

    // Modal state
  const [selectedLiterature, setSelectedLiterature] = useState<LiteratureExtended | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddVersionModalOpen, setIsAddVersionModalOpen] = useState(false);
  const [isCreateLiteratureModalOpen, setIsCreateLiteratureModalOpen] = useState(false);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);

  // PDF drag-and-drop state
  const [isDragOverList, setIsDragOverList] = useState(false);
  const [isPdfDropModalOpen, setIsPdfDropModalOpen] = useState(false);
  const [droppedPdfFile, setDroppedPdfFile] = useState<File | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Effect to handle collection edit mode
  useEffect(() => {
    if (collectionEditMode) {
      // Enter multi-select mode and set the target collection
      setIsMultiSelectMode(true);
      setTargetCollectionId(collectionEditMode);
      setBulkAction('collection');
    } else {
      // Exit multi-select mode if it was triggered by collection edit
      if (targetCollectionId && isMultiSelectMode) {
        setIsMultiSelectMode(false);
        setTargetCollectionId(null);
        setBulkAction(null);
        setSelectedLiteratureIds(new Set());
      }
    }
  }, [collectionEditMode]);

  // Handlers for modal
  const handleLiteratureClick = (literature: LiteratureExtended) => {
    if (isMultiSelectMode) {
      // In multi-select mode, toggle selection
      toggleLiteratureSelection(literature.documentId!);
      return;
    }
    
    if (isSelectionMode && droppedPdfFile) {
      // In selection mode, clicking a literature entry means adding the PDF as a version
      setSelectedLiterature(literature);
      setIsSelectionMode(false);
      setIsPdfDropModalOpen(false);
      setIsAddVersionModalOpen(true);
      setDroppedFile(droppedPdfFile);
    } else {
      // Normal mode - open detail modal
      setSelectedLiterature(literature);
      setIsDetailModalOpen(true);
    }
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
    // Also reset the dropped PDF file when closing version modal
    if (droppedPdfFile) {
      setDroppedPdfFile(null);
    }
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
    setDroppedPdfFile(null);
  };

  const handlePdfPreviewOpen = (literature: LiteratureExtended) => {
    setSelectedLiterature(literature);
    setIsPdfPreviewOpen(true);
  };

  const handlePdfPreviewClose = () => {
    setIsPdfPreviewOpen(false);
    setSelectedLiterature(null);
  };

  // PDF drag-and-drop handlers
  const handlePdfDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverList(false);
    
    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === 'application/pdf');
    
    if (pdfFile) {
      setDroppedPdfFile(pdfFile);
      setIsPdfDropModalOpen(true);
    }
  };

  const handlePdfDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files || []);
    const hasPdf = files.some(file => file.type === 'application/pdf');
    if (hasPdf) {
      setIsDragOverList(true);
    }
  };

  const handlePdfDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOverList(false);
    }
  };

  const handlePdfDropModalClose = () => {
    setIsPdfDropModalOpen(false);
    setDroppedPdfFile(null);
    setIsSelectionMode(false);
  };

  const handleAddToExisting = () => {
    setIsSelectionMode(true);
    setIsPdfDropModalOpen(false);
  };

  const handleCreateNew = () => {
    setIsSelectionMode(false);
    setIsPdfDropModalOpen(false);
    setIsCreateLiteratureModalOpen(true);
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setDroppedPdfFile(null);
  };

  // Multi-selection handlers
  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    if (isMultiSelectMode) {
      setSelectedLiteratureIds(new Set());
      setBulkAction(null);
      setTargetCollectionId(null);
    }
  };

  const toggleLiteratureSelection = (literatureId: string) => {
    const newSelection = new Set(selectedLiteratureIds);
    if (newSelection.has(literatureId)) {
      newSelection.delete(literatureId);
    } else {
      newSelection.add(literatureId);
    }
    setSelectedLiteratureIds(newSelection);
  };

  const selectAllLiterature = () => {
    const allIds = new Set(filteredAndSortedLiterature.map(lit => lit.documentId!));
    setSelectedLiteratureIds(allIds);
  };

  const clearSelection = () => {
    setSelectedLiteratureIds(new Set());
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedLiteratureIds.size === 0) return;

    console.log('Applying bulk action:', bulkAction, 'to', selectedLiteratureIds.size, 'items');
    
    try {
      const selectedIds = Array.from(selectedLiteratureIds);
      
      if (bulkAction === 'collection' && targetCollectionId) {
        // Add literature to collection
        for (const literatureId of selectedIds) {
          await addLiteratureToCollectionMutation.mutateAsync({
            collectionId: targetCollectionId,
            literatureId: literatureId
          });
        }
        console.log(`Added ${selectedIds.length} literature items to collection ${targetCollectionId}`);
        
      } else if (bulkAction === 'read' || bulkAction === 'unread') {
        // Update read status in literature metadata
        for (const literatureId of selectedIds) {
          const currentLiterature = literatures?.find(lit => lit.documentId === literatureId);
          if (currentLiterature) {
            // Parse current metadata safely
            let currentMetadata = {};
            if (currentLiterature.metadata) {
              try {
                currentMetadata = typeof currentLiterature.metadata === 'string' 
                  ? JSON.parse(currentLiterature.metadata)
                  : currentLiterature.metadata;
              } catch (e) {
                console.warn('Failed to parse metadata for literature:', literatureId);
                currentMetadata = {};
              }
            }
            
            // Update the read status
            const updatedMetadata = {
              ...currentMetadata,
              read: bulkAction === 'read'
            };
            
            await updateLiteratureMutation.mutateAsync({
              id: literatureId,
              data: { metadata: JSON.stringify(updatedMetadata) }
            });
          }
        }
        console.log(`Marked ${selectedIds.length} literature items as ${bulkAction}`);
        
      } else if (bulkAction === 'favorite' || bulkAction === 'unfavorite') {
        // Update favorite status in literature metadata
        for (const literatureId of selectedIds) {
          const currentLiterature = literatures?.find(lit => lit.documentId === literatureId);
          if (currentLiterature) {
            // Parse current metadata safely
            let currentMetadata = {};
            if (currentLiterature.metadata) {
              try {
                currentMetadata = typeof currentLiterature.metadata === 'string' 
                  ? JSON.parse(currentLiterature.metadata)
                  : currentLiterature.metadata;
              } catch (e) {
                console.warn('Failed to parse metadata for literature:', literatureId);
                currentMetadata = {};
              }
            }
            
            // Update the favorite status
            const updatedMetadata = {
              ...currentMetadata,
              favorite: bulkAction === 'favorite'
            };
            
            await updateLiteratureMutation.mutateAsync({
              id: literatureId,
              data: { metadata: JSON.stringify(updatedMetadata) }
            });
          }
        }
        console.log(`Marked ${selectedIds.length} literature items as ${bulkAction}`);
      }
      
    } catch (error) {
      console.error('Failed to execute bulk action:', error);
      // TODO: Show error notification to user
    }
    
    // If this was a collection edit operation, exit edit mode
    if (collectionEditMode && onCollectionEditComplete) {
      onCollectionEditComplete();
    }
    
    // Reset after action
    setSelectedLiteratureIds(new Set());
    setBulkAction(null);
    setTargetCollectionId(null);
  };

  // Get collection title by ID
  const getCollectionTitle = (collectionId: string): string => {
    if (collectionId === '__uncategorized__') return 'Uncategorized';
    const collection = collections?.find(c => c.documentId === collectionId);
    return collection?.title || collectionId;
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
      
      const matchesReadFilter = !showReadOnly || isLiteratureRead(lit);
      
      const matchesFavoriteFilter = !showFavoritesOnly || isLiteratureFavorite(lit);
      
      // In collection edit mode, show ALL literature regardless of collection filter
      const matchesCollection = collectionEditMode || !selectedCollection || 
        selectedCollection === '__uncategorized__' 
          ? (!lit.collections || lit.collections.length === 0)
          : (lit.collections && lit.collections.includes(selectedCollection));
      
      return matchesSearch && matchesType && matchesReadFilter && matchesFavoriteFilter && matchesCollection;
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
  }, [literatures, searchTerm, selectedType, sortBy, showReadOnly, showFavoritesOnly, selectedCollection, collectionEditMode]);

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
  const totalSize = calculateTotalSize(filteredAndSortedLiterature);
  const totalAnnotations = calculateTotalAnnotations(filteredAndSortedLiterature);

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
    const componentProps = {
      literature: item,
      onClick: () => handleLiteratureClick(item),
      onPdfPreview: () => handlePdfPreviewOpen(item),
      isSelectionMode: isSelectionMode,
      isMultiSelectMode: isMultiSelectMode,
      isSelected: selectedLiteratureIds.has(item.documentId),
      onToggleSelection: () => toggleLiteratureSelection(item.documentId)
    };
    
    switch (viewMode) {
      case 'compact':
        return <LiteratureCardCompact key={item.documentId} {...componentProps} />;
      case 'slim':
        return <LiteratureCardSlim key={item.documentId} {...componentProps} />;
      case 'rich':
      default:
        return <LiteratureCardL key={item.documentId} {...componentProps} />;
    }
  };

  return (
    <div 
      className={`flex flex-col h-full ${className} relative`}
      onDrop={handlePdfDrop}
      onDragOver={handlePdfDragOver}
      onDragLeave={handlePdfDragLeave}
    >
      {/* PDF Drag Overlay */}
      {isDragOverList && !isSelectionMode && (
        <div className="absolute inset-0 bg-blue-500/20 border-2 border-blue-500 border-dashed rounded-lg z-50 flex items-center justify-center">
          <div className="text-center">
            <Upload className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-blue-300 mb-2">Drop PDF File</h3>
            <p className="text-blue-200">Drop your PDF here to add to library or create new literature entry</p>
          </div>
        </div>
      )}


      {/* Fixed Header with Controls */}
      <div className="flex-shrink-0 p-6 pb-0">
        {/* Title and stats */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-blue-600 rounded-full"></div>
          <h1 className="text-2xl font-bold text-slate-100">
            {collectionEditMode
              ? `Add Literature to: ${getCollectionTitle(collectionEditMode)}`
              : selectedCollection === null 
                ? 'Literature Library'
                : selectedCollection === '__uncategorized__'
                  ? 'Uncategorized Literature'
                  : `Collection: ${getCollectionTitle(selectedCollection || '')}`
            }
          </h1>
          <div className="flex-1 h-px bg-gradient-to-r from-slate-700 to-transparent"></div>
          <div className="flex items-center space-x-4 text-sm">
            <span className="text-slate-400">{totalCount} items</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">{formatFileSize(totalSize)}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">{totalAnnotations} annotations</span>
            {groupBy !== 'none' && (
              <>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">{groupCount} {groupBy === 'type' ? 'types' : 'groups'}</span>
              </>
            )}
            {isMultiSelectMode && (
              <>
                <span className="text-slate-500">•</span>
                <span className="text-blue-400 font-medium">{selectedLiteratureIds.size} selected</span>
              </>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {/* Cancel collection edit mode button */}
            {collectionEditMode && (
              <button
                onClick={() => onCollectionEditComplete?.()}
                className="flex items-center space-x-2 px-3 py-2 bg-slate-600 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-all duration-200 text-sm"
                title="Cancel adding to collection"
              >
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            )}
            
            {/* Multi-select toggle - only show if not in collection edit mode */}
            {!collectionEditMode && (
              <button
                onClick={toggleMultiSelectMode}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-all duration-200 text-sm ${
                  isMultiSelectMode
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-slate-200'
                }`}
                title={isMultiSelectMode ? 'Exit selection mode' : 'Enter selection mode'}
              >
                {isMultiSelectMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                <span>{isMultiSelectMode ? 'Exit Selection' : 'Select'}</span>
              </button>
            )}

            {/* Add to Collection button - only show when a collection is selected and not in collection edit mode */}
            {selectedCollection && selectedCollection !== '__uncategorized__' && !isMultiSelectMode && !collectionEditMode && (
              <button
                onClick={() => {
                  setIsMultiSelectMode(true);
                  setBulkAction('collection');
                  setTargetCollectionId(selectedCollection);
                }}
                className="flex items-center space-x-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all duration-200 text-sm shadow-lg hover:shadow-xl"
                title="Add literature to this collection"
              >
                <Plus className="w-4 h-4" />
                <span>Add to Collection</span>
              </button>
            )}

            <button
              onClick={() => setIsCreateLiteratureModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">New Literature</span>
            </button>
          </div>
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

          {/* Filter Options */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-slate-400 whitespace-nowrap">Filter:</span>
            <div className="flex bg-slate-800/30 border border-slate-700/50 rounded-lg p-0.5 gap-1">
              <button
                onClick={() => setShowReadOnly(!showReadOnly)}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                  showReadOnly
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-600/50'
                }`}
                title="Show only read literature"
              >
                <Glasses className="w-3 h-3" />
                <span>Read</span>
              </button>
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                  showFavoritesOnly
                    ? 'bg-yellow-600 text-white shadow-sm'
                    : 'bg-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-600/50'
                }`}
                title="Show only favorite literature"
              >
                <Star className="w-3 h-3" />
                <span>Favorites</span>
              </button>
            </div>
          </div>

          {/* Clear Filters */}
          {(searchTerm || selectedType || showReadOnly || showFavoritesOnly) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedType(null);
                setShowReadOnly(false);
                setShowFavoritesOnly(false);
              }}
              className="ml-auto px-3 py-1.5 bg-slate-700/50 text-slate-300 text-xs font-medium rounded-lg hover:bg-slate-600/50 transition-colors border border-slate-600/50 whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>

        {/* Multi-select Action Bar */}
        {isMultiSelectMode && (
          <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <CheckSquare className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-blue-300 font-medium">Selection Mode</h4>
                    <p className="text-blue-200/80 text-sm">
                      {selectedLiteratureIds.size === 0 
                        ? 'Click on literature entries to select them'
                        : `${selectedLiteratureIds.size} item${selectedLiteratureIds.size !== 1 ? 's' : ''} selected`
                      }
                    </p>
                  </div>
                </div>

                {/* Quick selection controls */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={selectAllLiterature}
                    className="px-3 py-1.5 bg-blue-600/50 hover:bg-blue-600 text-blue-200 rounded-lg text-xs font-medium transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1.5 bg-slate-600/50 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              {selectedLiteratureIds.size > 0 && (
                <div className="flex items-center space-x-2">
                  {/* Read/Unread actions */}
                  <button
                    onClick={() => setBulkAction('read')}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      bulkAction === 'read'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-600/50 hover:bg-slate-600 text-slate-200'
                    }`}
                  >
                    <Glasses className="w-3 h-3" />
                    <span>Mark Read</span>
                  </button>
                  <button
                    onClick={() => setBulkAction('unread')}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      bulkAction === 'unread'
                        ? 'bg-slate-600 text-white'
                        : 'bg-slate-600/50 hover:bg-slate-600 text-slate-200'
                    }`}
                  >
                    <X className="w-3 h-3" />
                    <span>Unread</span>
                  </button>

                  {/* Favorite/Unfavorite actions */}
                  <button
                    onClick={() => setBulkAction('favorite')}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      bulkAction === 'favorite'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-slate-600/50 hover:bg-slate-600 text-slate-200'
                    }`}
                  >
                    <Star className="w-3 h-3" />
                    <span>Favorite</span>
                  </button>
                  <button
                    onClick={() => setBulkAction('unfavorite')}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      bulkAction === 'unfavorite'
                        ? 'bg-slate-600 text-white'
                        : 'bg-slate-600/50 hover:bg-slate-600 text-slate-200'
                    }`}
                  >
                    <X className="w-3 h-3" />
                    <span>Unfavorite</span>
                  </button>

                  {/* Collection picker */}
                  {collections && collections.length > 0 && (
                    <select
                      value={targetCollectionId || ''}
                      onChange={(e) => {
                        setTargetCollectionId(e.target.value || null);
                        setBulkAction('collection');
                      }}
                      className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-xs"
                    >
                      <option value="">Add to Collection...</option>
                      {collections.map(collection => (
                        <option key={collection.documentId} value={collection.documentId}>
                          {collection.title}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Apply button */}
                  <button
                    onClick={handleBulkAction}
                    disabled={!bulkAction || (bulkAction === 'collection' && !targetCollectionId)}
                    className="flex items-center space-x-2 px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <Check className="w-3 h-3" />
                    <span>{collectionEditMode ? 'Add to Collection' : 'Apply'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selection Mode Info Message */}
        {isSelectionMode && (
          <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-emerald-300 font-medium">Select Literature Entry</h4>
                  <p className="text-emerald-200/80 text-sm">Click on any literature entry below to add "{droppedPdfFile?.name}" as a new version</p>
                </div>
              </div>
              <button
                onClick={handleCancelSelection}
                className="px-3 py-1.5 bg-slate-600/50 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-500/50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
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
            
            const groupSize = calculateTotalSize(items);
            const groupAnnotations = calculateTotalAnnotations(items);

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
                    <span className="text-slate-500">•</span>
                    <span className="text-sm text-slate-400 font-medium">
                      {formatFileSize(groupSize)}
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-sm text-slate-400 font-medium">
                      {groupAnnotations} annotations
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
        onClose={() => {
          setIsCreateLiteratureModalOpen(false);
          setDroppedPdfFile(null);
        }}
        onCreateLiterature={handleCreateLiterature}
        initialPdfFile={droppedPdfFile}
      />

      {/* PDF Drop Selection Modal */}
      {droppedPdfFile && (
        <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center ${isPdfDropModalOpen ? '' : 'hidden'}`}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-100 mb-2">PDF File Dropped</h3>
              <p className="text-slate-400 mb-6">What would you like to do with "{droppedPdfFile.name}"?</p>
              
              <div className="space-y-3">
                <button
                  onClick={handleAddToExisting}
                  className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Add to Existing Literature</span>
                </button>
                
                <button
                  onClick={handleCreateNew}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Literature Entry</span>
                </button>
                
                <button
                  onClick={handlePdfDropModalClose}
                  className="w-full px-4 py-3 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

// literatureDetailModal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  FileText, 
  Calendar, 
  Users, 
  Building, 
  BookOpen, 
  Hash, 
  Link, 
  Download,
  Edit,
  Plus,
  Search,
  Filter,
  SortAsc,
  Grid,
  List,
  Tags,
  Eye,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { LiteratureExtended, getDisplayYear } from '../../types/deepRecall/strapi/literatureTypes';
import { VersionExtended } from '../../types/deepRecall/strapi/versionTypes';
import { prefixStrapiUrl } from '../../helpers/getStrapiMedia';
import { useAnnotations } from '../../customHooks/useAnnotations';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateLiterature } from '../../api/literatureService';
import { deleteAnnotation } from '../../api/annotationService';
import { deleteFile } from '../../api/uploadFile';

interface LiteratureDetailModalProps {
  literature: LiteratureExtended;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onAddVersion?: (file?: File) => void;
}

const LiteratureDetailModal: React.FC<LiteratureDetailModalProps> = ({
  literature,
  isOpen,
  onClose,
  onEdit,
  onAddVersion
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnnotationType, setSelectedAnnotationType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'type' | 'title'>('date');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isGlobalDrag, setIsGlobalDrag] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [versionToDelete, setVersionToDelete] = useState<VersionExtended | null>(null);

  const queryClient = useQueryClient();

  // Initialize with first version selected and reset when literature changes
  useEffect(() => {
    if (isOpen && literature.versions.length > 0) {
      // If current selection is no longer valid, reset to first version
      if (!selectedVersionId || !literature.versions.find(v => v.documentId === selectedVersionId)) {
        setSelectedVersionId(literature.versions[0].documentId || null);
      }
    } else if (isOpen && literature.versions.length === 0) {
      // No versions available
      setSelectedVersionId(null);
    }
  }, [isOpen, literature.versions, selectedVersionId]);

  // Reset modal state when closing
  useEffect(() => {
    if (!isOpen) {
      setSelectedVersionId(null);
      setVersionToDelete(null);
      setSearchTerm('');
      setSelectedAnnotationType('all');
    }
  }, [isOpen]);

  // Get annotations for the selected version
  const selectedVersion = selectedVersionId 
    ? literature.versions.find(v => v.documentId === selectedVersionId)
    : literature.versions[0]; // Default to first version if none selected

  const { 
    annotations = [], 
    isLoading: annotationsLoading 
  } = useAnnotations(
    literature.documentId || '', 
    selectedVersion?.documentId || ''
  );

  // Helper function to extract file ID from Strapi URL
  const extractFileId = (url: string): number | null => {
    if (!url) return null;
    // Strapi file URLs typically look like: /uploads/filename_abc123.pdf
    // The file ID is usually encoded in the filename or we need to match it
    // For now, we'll extract from URL patterns or use a different approach
    const match = url.match(/\/uploads\/.*_([a-f0-9]+)\./);
    if (match) {
      // This is a hash-based approach, but we need the actual file ID
      // We might need to store the file ID in the version metadata
      return null; // For now, return null and handle this differently
    }
    return null;
  };

  // Mutation to delete a version with proper file cleanup
  const deleteVersionMutation = useMutation({
    mutationFn: async (versionToDelete: VersionExtended) => {
      if (!literature.documentId) {
        throw new Error('Literature documentId is required');
      }

      try {
        // 1. Delete all annotations linked to this version
        const versionAnnotations = annotations.filter(ann => ann.pdfId === versionToDelete.documentId);
        for (const annotation of versionAnnotations) {
          if (annotation.documentId) {
            await deleteAnnotation(annotation.documentId);
          }
        }

        // 2. Delete the PDF file and thumbnail from Strapi media
        // Note: For proper file deletion, we need the actual Strapi file IDs
        // These are stored in the VersionExtended fields fileId and thumbnailId
        
        if (versionToDelete.fileId) {
          try {
            await deleteFile(versionToDelete.fileId);
            console.log('Successfully deleted PDF file');
          } catch (error) {
            console.warn('Failed to delete PDF file:', error);
            // Continue with deletion even if file deletion fails
          }
        } else {
          console.warn('No fileId found in version - PDF file may remain on server');
        }
        
        if (versionToDelete.thumbnailId) {
          try {
            await deleteFile(versionToDelete.thumbnailId);
            console.log('Successfully deleted thumbnail file');
          } catch (error) {
            console.warn('Failed to delete thumbnail file:', error);
            // Continue with deletion even if thumbnail deletion fails
          }
        } else {
          console.warn('No thumbnailId found in version - thumbnail may remain on server');
        }
        
        // 3. Remove the version from the literature metadata
        const updatedVersions = literature.versions.filter(v => v.documentId !== versionToDelete.documentId);
        
        // 4. Update the literature with new versions array
        const updatedMetadata = {
          ...literature.customMetadata,
          versions: updatedVersions.map(v => ({
            documentId: v.documentId,
            publishingDate: v.publishingDate,
            versionTitle: v.versionTitle,
            editionNumber: v.editionNumber,
            versionNumber: v.versionNumber,
            fileUrl: v.fileUrl,
            thumbnailUrl: v.thumbnailUrl,
            fileId: v.fileId, // Include file ID
            thumbnailId: v.thumbnailId, // Include thumbnail ID
            fileHash: v.fileHash,
            ...v.customMetadata
          }))
        };

        return updateLiterature(literature.documentId, {
          metadata: JSON.stringify(updatedMetadata)
        });
      } catch (error) {
        console.error('Error during version deletion:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate multiple queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ['literatures'] });
      queryClient.invalidateQueries({ queryKey: ['annotations'] });
      
      // Also trigger a refetch of the current literature to update the modal immediately
      queryClient.refetchQueries({ queryKey: ['literatures'] });
      
      setVersionToDelete(null);
      setSelectedVersionId(null);
      
      // If no versions left, close the modal or show appropriate message
      const remainingVersions = literature.versions.filter(v => v.documentId !== versionToDelete?.documentId);
      if (remainingVersions.length === 0) {
        onClose?.();
      } else {
        // Select the first remaining version
        setSelectedVersionId(remainingVersions[0].documentId || null);
      }
    },
    onError: (error) => {
      console.error('Failed to delete version:', error);
      // You might want to show a toast notification here
    }
  });

  // Helper function to get file size in a human-readable format
  const getFileSize = (version: VersionExtended): string => {
    // Check if file size is stored in custom metadata
    if (version.customMetadata?.fileSize) {
      const bytes = version.customMetadata.fileSize;
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    
    // Fallback: estimate based on file type or return unknown
    if (version.fileUrl?.toLowerCase().includes('.pdf')) {
      return "~2-5 MB"; // Typical PDF size estimate
    }
    
    return "Unknown size";
  };

  // Helper function to get annotation count for a version
  const getAnnotationCount = (versionId: string): number => {
    if (!selectedVersion || selectedVersion.documentId !== versionId) {
      // For non-selected versions, we don't have the data loaded
      // We could fetch it separately or show a placeholder
      return 0;
    }
    return annotations.length;
  };

  // Get annotation count for the version to be deleted
  const getAnnotationCountForVersion = (versionId: string): number => {
    // This is for the deletion modal - we need to show accurate count
    // If it's the selected version, use current annotations
    if (selectedVersion && selectedVersion.documentId === versionId) {
      return annotations.length;
    }
    // For other versions, we'd need to fetch separately or estimate
    // For now, return 0 as we don't have the data
    return 0;
  };

  // Global drag detection
  useEffect(() => {
    const handleGlobalDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        setIsGlobalDrag(true);
      }
    };

    const handleGlobalDragLeave = (e: DragEvent) => {
      // Only set to false if we're leaving the entire window
      if (!e.relatedTarget) {
        setIsGlobalDrag(false);
      }
    };

    const handleGlobalDrop = () => {
      setIsGlobalDrag(false);
    };

    if (isOpen) {
      document.addEventListener('dragenter', handleGlobalDragEnter);
      document.addEventListener('dragleave', handleGlobalDragLeave);
      document.addEventListener('drop', handleGlobalDrop);
    }

    return () => {
      document.removeEventListener('dragenter', handleGlobalDragEnter);
      document.removeEventListener('dragleave', handleGlobalDragLeave);
      document.removeEventListener('drop', handleGlobalDrop);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const {
    title,
    subtitle,
    authors,
    type,
    publisher,
    journal,
    doi,
    versions,
    createdAt,
    updatedAt,
    versionsAreEqual
  } = literature;

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
    return colors[type?.toLowerCase() as keyof typeof colors] || 'from-slate-500 to-slate-600';
  };

  // Get years range from versions
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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Real annotation types from the annotation system
  const annotationTypes = [
    'all',
    'Equation',
    'Plot', 
    'Illustration',
    'Theorem',
    'Statement',
    'Definition',
    'Figure',
    'Table',
    'Exercise',
    'Problem',
    'Abstract',
    'Calculation',
    'Other',
    'Recipe'
  ];

  // Drag and drop handlers for PDF files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragOver to false if we're leaving the container entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === 'application/pdf');
    
    if (pdfFile) {
      // Open the add version modal with the dropped file
      onAddVersion?.(pdfFile);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div className="flex items-start space-x-4 flex-1 min-w-0">
            <div className={`w-3 h-8 bg-gradient-to-b ${getTypeColor(type)} rounded-full flex-shrink-0 mt-1`}></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-3">
                {getDisplayYear(literature) && (
                  <span className="text-slate-400 text-lg font-medium">
                    ({getDisplayYear(literature)})
                  </span>
                )}
                <h1 className="text-2xl font-bold text-slate-100 leading-tight break-words flex-1">{title}</h1>
              </div>
              {subtitle && (
                <p className="text-lg text-slate-400 truncate mt-1">{subtitle}</p>
              )}
              {authors && Array.isArray(authors) && authors.length > 0 && (
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">{authors.join(', ')}</p>
              )}
              <div className="flex items-center space-x-4 mt-2">
                <span className={`px-3 py-1 text-sm font-medium rounded-full bg-gradient-to-r ${getTypeColor(type)} text-white`}>
                  {type}
                </span>
                <span className="text-sm text-slate-500">
                  {versions.length} version{versions.length !== 1 ? 's' : ''}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-sm text-slate-500">
                  added {formatDate(createdAt)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={onEdit}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all duration-200"
              title="Edit Literature"
            >
              <Edit className="w-5 h-5" />
            </button>
            <button
              onClick={() => onAddVersion?.()}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all duration-200"
              title="Add Version"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Panel - Literature Details */}
          <div className="w-1/3 border-r border-slate-700/50 p-6 overflow-y-auto">
            <div className="space-y-6">
              
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Details
                </h3>
                <div className="space-y-3">
                  {publisher && (
                    <div className="flex items-start space-x-3">
                      <Building className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-slate-400">Publisher</p>
                        <p className="text-slate-200">{publisher}</p>
                      </div>
                    </div>
                  )}
                  
                  {journal && (
                    <div className="flex items-start space-x-3">
                      <BookOpen className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-slate-400">Journal</p>
                        <p className="text-slate-200">{journal}</p>
                      </div>
                    </div>
                  )}
                  
                  {doi && (
                    <div className="flex items-start space-x-3">
                      <Link className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-slate-400">DOI</p>
                        <a 
                          href={`https://doi.org/${doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 transition-colors break-all"
                        >
                          {doi}
                        </a>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-start space-x-3">
                    <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-slate-400">Publication Years</p>
                      <p className="text-slate-200">{getYearsRange(versions)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Versions */}
              {versions.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center justify-between">
                    <span className="flex items-center">
                      <Hash className="w-5 h-5 mr-2" />
                      Versions ({versions.length})
                    </span>
                    <button
                      onClick={() => onAddVersion?.()}
                      className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded transition-all duration-200"
                      title="Add Version"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </h3>
                  <div className="space-y-3">
                    {versions.map((version, index) => {
                      const isSelected = selectedVersionId === version.documentId || (!selectedVersionId && index === 0);
                      const annotationCount = getAnnotationCount(version.documentId || '');
                      
                      return (
                        <div 
                          key={index} 
                          className={`border rounded-lg p-4 transition-all duration-200 cursor-pointer group ${
                            isSelected 
                              ? 'border-blue-500/50 bg-blue-500/10' 
                              : 'border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-800/30'
                          }`}
                          onClick={() => setSelectedVersionId(version.documentId || null)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-2">
                                {version.versionTitle && (
                                  <h4 className="text-sm font-medium text-slate-200 truncate">
                                    {version.versionTitle}
                                  </h4>
                                )}
                                {(version.editionNumber || version.versionNumber) && (
                                  <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">
                                    {version.editionNumber ? `Ed. ${version.editionNumber}` : `v${version.versionNumber}`}
                                  </span>
                                )}
                                {isSelected && (
                                  <span className="text-xs text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded">
                                    Selected
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-4 text-xs text-slate-400">
                                <span>
                                  {version.publishingDate ? formatDate(version.publishingDate) : 'No date'}
                                </span>
                                <span>•</span>
                                <span>{annotationCount} annotation{annotationCount !== 1 ? 's' : ''}</span>
                                <span>•</span>
                                <span>{getFileSize(version)}</span>
                              </div>
                            </div>
                            
                            {version.thumbnailUrl && (
                              <div className="w-12 h-16 bg-slate-700/30 rounded border overflow-hidden ml-3 flex-shrink-0">
                                <img 
                                  src={prefixStrapiUrl(version.thumbnailUrl)} 
                                  alt="Version thumbnail"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-700/30">
                            <div className="flex items-center space-x-3">
                              <button
                                className="flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                                title="View PDF"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Eye className="w-3 h-3" />
                                <span>View</span>
                              </button>
                              <button
                                className="flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                                title="Download PDF"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Download className="w-3 h-3" />
                                <span>Download</span>
                              </button>
                            </div>
                            
                            <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                className="flex items-center space-x-1 px-2 py-1 text-xs text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                                title="Edit Version"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // TODO: Implement edit functionality
                                  console.log('Edit version:', version);
                                }}
                              >
                                <Edit className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                className="flex items-center space-x-1 px-2 py-1 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                title="Delete Version"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVersionToDelete(version);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Annotations or Add PDF */}
          <div className="flex-1 flex flex-col">
            
            {versions.length > 0 ? (
              <>
                {/* Annotations Header & Controls */}
                <div className="p-6 border-b border-slate-700/50">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-200 flex items-center">
                        <Tags className="w-5 h-5 mr-2" />
                        Annotations
                      </h3>
                      {selectedVersion && (
                        <p className="text-sm text-slate-400 mt-1">
                          Showing annotations for: {selectedVersion.versionTitle || `Version ${selectedVersion.versionNumber || selectedVersion.editionNumber || '1'}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-slate-400">
                        {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                        className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all duration-200"
                        title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
                      >
                        {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  {/* Search and Filters */}
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search annotations..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
                      />
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <select
                          value={selectedAnnotationType}
                          onChange={(e) => setSelectedAnnotationType(e.target.value)}
                          className="px-3 py-1 bg-slate-800/50 border border-slate-700/50 rounded text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                          {annotationTypes.map(type => (
                            <option key={type} value={type}>
                              {type === 'all' ? 'All Types' : type}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <SortAsc className="w-4 h-4 text-slate-400" />
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as 'date' | 'type' | 'title')}
                          className="px-3 py-1 bg-slate-800/50 border border-slate-700/50 rounded text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                          <option value="date">Sort by Date</option>
                          <option value="type">Sort by Type</option>
                          <option value="title">Sort by Title</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Annotations Content */}
                <div className="flex-1 p-6 overflow-y-auto">
                  {annotationsLoading ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <Tags className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-300 mb-2">Loading Annotations...</h3>
                    </div>
                  ) : annotations.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Tags className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-300 mb-2">No Annotations Yet</h3>
                      <p className="text-slate-500 mb-4">
                        {selectedVersion 
                          ? `No annotations found for "${selectedVersion.versionTitle || 'this version'}". Start annotating to see them here.`
                          : 'Annotations will appear here once you start annotating the PDFs in this literature.'
                        }
                      </p>
                      <button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200">
                        Open PDF Viewer
                      </button>
                    </div>
                  ) : (
                    <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'space-y-4'}>
                      {annotations
                        .filter(annotation => {
                          // Filter by search term
                          const matchesSearch = !searchTerm || 
                            annotation.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            annotation.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            annotation.textContent?.toLowerCase().includes(searchTerm.toLowerCase());
                          
                          // Filter by annotation type
                          const matchesType = selectedAnnotationType === 'all' || annotation.type === selectedAnnotationType;
                          
                          return matchesSearch && matchesType;
                        })
                        .sort((a, b) => {
                          switch (sortBy) {
                            case 'title':
                              return (a.title || '').localeCompare(b.title || '');
                            case 'type':
                              return a.type.localeCompare(b.type);
                            case 'date':
                              return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
                            default:
                              return 0;
                          }
                        })
                        .map((annotation) => (
                          <div key={annotation.documentId} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600/50 transition-colors">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="text-xs font-medium text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                                    {annotation.type}
                                  </span>
                                  {annotation.page && (
                                    <span className="text-xs text-slate-400">
                                      Page {annotation.page}
                                    </span>
                                  )}
                                </div>
                                {annotation.title && (
                                  <h4 className="text-sm font-medium text-slate-200 truncate">
                                    {annotation.title}
                                  </h4>
                                )}
                              </div>
                              <div className="flex-shrink-0 ml-3">
                                <div 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: annotation.color || '#64748b' }}
                                  title="Annotation color"
                                />
                              </div>
                            </div>
                            
                            {annotation.description && (
                              <p className="text-sm text-slate-300 mb-2 max-h-10 overflow-hidden">
                                {annotation.description}
                              </p>
                            )}
                            
                            {annotation.textContent && (
                              <div className="text-xs text-slate-400 bg-slate-700/30 rounded p-2 mb-2 max-h-12 overflow-hidden">
                                "{annotation.textContent}"
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>
                                {annotation.createdAt ? new Date(annotation.createdAt).toLocaleDateString() : 'No date'}
                              </span>
                              <div className="flex items-center space-x-2">
                                {annotation.annotation_tags && annotation.annotation_tags.length > 0 && (
                                  <span className="flex items-center space-x-1">
                                    <Tags className="w-3 h-3" />
                                    <span>{annotation.annotation_tags.length}</span>
                                  </span>
                                )}
                                <button 
                                  className="text-slate-400 hover:text-slate-200 transition-colors"
                                  title="View annotation"
                                >
                                  <Eye className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* No Versions - Add PDF Panel */
              <div 
                className={`flex-1 flex flex-col items-center justify-center p-8 transition-all duration-200 ${
                  isDragOver 
                    ? 'bg-emerald-500/10 border-2 border-emerald-500/50 border-dashed' 
                    : isGlobalDrag 
                      ? 'bg-emerald-500/5 border-2 border-emerald-500/20 border-dashed animate-pulse'
                      : ''
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="text-center max-w-md">
                  <div className={`w-20 h-20 bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-full flex items-center justify-center mx-auto mb-6 transition-all duration-200 ${
                    isDragOver 
                      ? 'scale-110 border-emerald-500/50 from-emerald-500/20 to-teal-500/20' 
                      : isGlobalDrag
                        ? 'scale-105 border-emerald-500/30 from-emerald-500/10 to-teal-500/10'
                        : ''
                  }`}>
                    <FileText className={`w-10 h-10 transition-colors duration-200 ${
                      isDragOver 
                        ? 'text-emerald-400' 
                        : isGlobalDrag
                          ? 'text-emerald-300'
                          : 'text-orange-400'
                    }`} />
                  </div>
                  
                  <h3 className="text-xl font-semibold text-slate-200 mb-3">
                    {isDragOver 
                      ? 'Drop PDF to Add Document' 
                      : isGlobalDrag
                        ? 'Drag File Here to Add Document'
                        : 'No Documents Available'}
                  </h3>
                  <p className="text-slate-400 mb-6 leading-relaxed">
                    {isDragOver 
                      ? 'Release to add this PDF document to the literature entry.'
                      : isGlobalDrag
                        ? 'Drag your PDF file into this area to add it as a document.'
                        : 'This literature entry doesn\'t have any PDF documents yet. Add the first document to start reading and annotating.'
                    }
                  </p>
                  
                  {!isDragOver && (
                    <>
                      <button
                        onClick={() => onAddVersion?.()}
                        className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 shadow-lg hover:shadow-xl mx-auto mb-4"
                      >
                        <Plus className="w-5 h-5" />
                        <span className="font-medium">Add PDF Document</span>
                      </button>
                      
                      <p className="text-xs text-slate-500">
                        Or drag and drop a PDF file here • Annotations can only be made on PDF documents
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Version Deletion Confirmation Modal */}
      {versionToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-60 p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Delete Version</h3>
                <p className="text-sm text-slate-400">This action cannot be undone</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-slate-300">
                Are you sure you want to delete this version? This will permanently remove:
              </p>
              <ul className="text-sm text-slate-400 space-y-1 ml-4">
                <li>• The PDF file ({getFileSize(versionToDelete)})</li>
                <li>• {getAnnotationCountForVersion(versionToDelete.documentId || '')} annotation{getAnnotationCountForVersion(versionToDelete.documentId || '') !== 1 ? 's' : ''}</li>
                <li>• Thumbnail images</li>
                <li>• Version metadata</li>
              </ul>
              {versionToDelete.versionTitle && (
                <div className="bg-slate-800/50 rounded p-3 mt-3">
                  <p className="text-sm text-slate-300">
                    <span className="font-medium">Version:</span> {versionToDelete.versionTitle}
                  </p>
                  {versionToDelete.publishingDate && (
                    <p className="text-sm text-slate-400">
                      <span className="font-medium">Date:</span> {formatDate(versionToDelete.publishingDate)}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setVersionToDelete(null)}
                disabled={deleteVersionMutation.isPending}
                className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteVersionMutation.mutate(versionToDelete)}
                disabled={deleteVersionMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {deleteVersionMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Version</span>
                )}
              </button>
            </div>

            {deleteVersionMutation.error && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400">
                  Failed to delete version: {deleteVersionMutation.error.message}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiteratureDetailModal;

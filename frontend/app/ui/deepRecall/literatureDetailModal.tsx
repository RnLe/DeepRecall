// literatureDetailModal.tsx

import React, { useState, useEffect } from 'react';
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
  Eye
} from 'lucide-react';
import { LiteratureExtended } from '../../types/deepRecall/strapi/literatureTypes';
import { VersionExtended } from '../../types/deepRecall/strapi/versionTypes';
import { prefixStrapiUrl } from '../../helpers/getStrapiMedia';

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

  // Placeholder annotation types for the filter
  const annotationTypes = [
    'all',
    'Equation',
    'Figure',
    'Table',
    'Definition',
    'Theorem',
    'Problem',
    'Other'
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
              <h1 className="text-2xl font-bold text-slate-100 leading-tight break-words">{title}</h1>
              {subtitle && (
                <p className="text-lg text-slate-400 truncate mt-1">{subtitle}</p>
              )}
              {authors && (
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">{authors}</p>
              )}
              <div className="flex items-center space-x-4 mt-2">
                <span className={`px-3 py-1 text-sm font-medium rounded-full bg-gradient-to-r ${getTypeColor(type)} text-white`}>
                  {type}
                </span>
                <span className="text-sm text-slate-500">
                  {versions.length} version{versions.length !== 1 ? 's' : ''}
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
                  {authors && Array.isArray(authors) && authors.length > 0 && (
                    <div className="flex items-start space-x-3">
                      <Users className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-slate-400">Authors</p>
                        <p className="text-slate-200">{authors.join(', ')}</p>
                      </div>
                    </div>
                  )}
                  
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
                  
                  <div className="flex items-start space-x-3">
                    <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-slate-400">Added</p>
                      <p className="text-slate-200">{formatDate(createdAt)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-slate-400">Last Updated</p>
                      <p className="text-slate-200">{formatDate(updatedAt)}</p>
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
                    {versions.map((version, index) => (
                      <div key={index} className="border border-slate-700/50 rounded-lg p-4 hover:border-slate-600/50 transition-colors">
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
                            </div>
                            <p className="text-xs text-slate-400">
                              {version.publishingDate ? formatDate(version.publishingDate) : 'No date'}
                            </p>
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
                          <button
                            className="flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                            title="View PDF"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>
                          <button
                            className="flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                            title="Download PDF"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download</span>
                          </button>
                        </div>
                      </div>
                    ))}
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
                    <h3 className="text-lg font-semibold text-slate-200 flex items-center">
                      <Tags className="w-5 h-5 mr-2" />
                      Annotations
                    </h3>
                    <div className="flex items-center space-x-2">
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
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Tags className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-300 mb-2">No Annotations Yet</h3>
                    <p className="text-slate-500 mb-4">
                      Annotations will appear here once you start annotating the PDFs in this literature.
                    </p>
                    <button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200">
                      Open PDF Viewer
                    </button>
                  </div>
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
    </div>
  );
};

export default LiteratureDetailModal;

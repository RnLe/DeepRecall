// src/components/deepRecall/literatureAnnotationList.tsx
import React, { useState, useMemo } from 'react';
import { 
  Type, 
  Square, 
  Image as ImageIcon, 
  FileText, 
  StickyNote, 
  Tags, 
  Calendar, 
  MapPin, 
  Eye, 
  ChevronDown, 
  ChevronRight,
  Hash,
  Clock,
  BookOpen,
  Sigma,
  Grid,
  List,
  Search,
  Filter,
  SortAsc,
  ExternalLink
} from 'lucide-react';
import { Annotation, AnnotationType } from '../../types/deepRecall/strapi/annotationTypes';
import { prefixStrapiUrl } from '../../helpers/getStrapiMedia';
import { agoTimeToString } from '../../helpers/timesToString';
import PDFMiniPreview from './PDFMiniPreview';

export type SortMode = 'date' | 'type' | 'title' | 'page' | 'alphabetical';
export type ViewMode = 'grid' | 'list' | 'compact';

interface LiteratureAnnotationListProps {
  annotations: Annotation[];
  selectedVersion?: { fileUrl: string; [key: string]: any }; // Current selected version with PDF URL
  isLoading?: boolean;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
  sortBy: SortMode;
  onSortChange: (sort: SortMode) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onAnnotationClick?: (annotation: Annotation) => void;
  onImagePreview?: (imageUrl: string, annotation: Annotation) => void;
  onDescriptionPreview?: (description: string, annotation: Annotation) => void;
  onNotesPreview?: (notes: string, annotation: Annotation) => void;
  colorMap?: Record<string, string>;
  availableTypes?: string[];
}

const DEFAULT_COLOR = "#64748b";

// Color mapping for annotation types
const TYPE_COLORS: Record<AnnotationType, string> = {
  "Equation": "#f59e0b",
  "Plot": "#10b981", 
  "Illustration": "#8b5cf6",
  "Theorem": "#ef4444",
  "Statement": "#06b6d4",
  "Definition": "#84cc16",
  "Figure": "#f97316",
  "Table": "#6366f1",
  "Exercise": "#ec4899",
  "Abstract": "#14b8a6",
  "Problem": "#f87171",
  "Calculation": "#fbbf24",
  "Other": "#64748b",
  "Recipe": "#a855f7"
};

const LiteratureAnnotationList: React.FC<LiteratureAnnotationListProps> = ({
  annotations,
  selectedVersion,
  isLoading = false,
  searchTerm,
  onSearchChange,
  selectedType,
  onTypeChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  onAnnotationClick,
  onImagePreview,
  onDescriptionPreview,
  onNotesPreview,
  colorMap = {},
  availableTypes = ['all']
}) => {
  const [expandedAnnotations, setExpandedAnnotations] = useState<Set<string>>(new Set());

  // Filter and sort annotations
  const processedAnnotations = useMemo(() => {
    let filtered = annotations.filter(annotation => {
      // Filter by search term
      const matchesSearch = !searchTerm || 
        annotation.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        annotation.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        annotation.textContent?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        annotation.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        annotation.type?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filter by annotation type
      const matchesType = selectedType === 'all' || annotation.type === selectedType;
      
      return matchesSearch && matchesType;
    });

    // Sort annotations
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
        case 'alphabetical':
          // Put annotations without titles at the end
          if (!a.title && !b.title) return 0;
          if (!a.title) return 1;
          if (!b.title) return -1;
          return a.title.localeCompare(b.title);
        case 'type':
          return a.type.localeCompare(b.type);
        case 'page':
          return (a.page || 0) - (b.page || 0);
        case 'date':
        default:
          return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
      }
    });

    return filtered;
  }, [annotations, searchTerm, selectedType, sortBy]);

  const toggleExpanded = (annotationId: string) => {
    const newExpanded = new Set(expandedAnnotations);
    if (newExpanded.has(annotationId)) {
      newExpanded.delete(annotationId);
    } else {
      newExpanded.add(annotationId);
    }
    setExpandedAnnotations(newExpanded);
  };

  const getAnnotationColor = (annotation: Annotation): string => {
    return annotation.color || 
           colorMap[annotation.type] || 
           TYPE_COLORS[annotation.type as AnnotationType] || 
           DEFAULT_COLOR;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'No date';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return 'Unknown time';
    const timestamp = new Date(dateStr).getTime() / 1000;
    return agoTimeToString(timestamp);
  };

  const truncateText = (text: string, maxLength: number = 100): string => {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
  };

  const renderMarkdownPreview = (markdown: string, maxLength: number = 150): string => {
    // Simple markdown to text conversion for preview
    const text = markdown
      .replace(/#{1,6}\s+/g, '') // Remove headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/`(.*?)`/g, '$1') // Remove code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Extract link text
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim();
    
    return truncateText(text, maxLength);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Tags className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-300 mb-2">Loading Annotations...</h3>
          <p className="text-slate-500">Fetching annotation data...</p>
        </div>
      </div>
    );
  }

  if (processedAnnotations.length === 0) {
    const hasAnnotations = annotations.length > 0;
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Tags className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-300 mb-2">
            {hasAnnotations ? 'No Matching Annotations' : 'No Annotations Yet'}
          </h3>
          <p className="text-slate-500 mb-4">
            {hasAnnotations 
              ? 'Try adjusting your search terms or filters to find annotations.'
              : 'Annotations will appear here once you start annotating the PDF. Open the PDF viewer to begin.'
            }
          </p>
          {!hasAnnotations && (
            <button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200">
              Open PDF Viewer
            </button>
          )}
        </div>
      </div>
    );
  }

  // Grid view (detailed cards)
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {processedAnnotations.map((annotation) => {
          const isExpanded = expandedAnnotations.has(annotation.documentId!);
          const color = getAnnotationColor(annotation);
          
          return (
            <div 
              key={annotation.documentId} 
              className="bg-slate-800/50 border border-slate-700/50 rounded-lg hover:border-slate-600/50 transition-all duration-200 group"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-700/30">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="flex items-center space-x-2">
                        {annotation.mode === "text" ? (
                          <Type size={16} style={{ color }} />
                        ) : (
                          <Square size={16} style={{ color }} />
                        )}
                        <span 
                          className="text-xs font-medium px-2 py-1 rounded"
                          style={{ 
                            backgroundColor: `${color}20`, 
                            color: color,
                            border: `1px solid ${color}40`
                          }}
                        >
                          {annotation.type}
                        </span>
                      </div>
                      {annotation.page && (
                        <span className="text-xs text-slate-400 flex items-center space-x-1">
                          <BookOpen size={12} />
                          <span>Page {annotation.page}</span>
                        </span>
                      )}
                    </div>
                    
                    {annotation.title && (
                      <h4 className="text-sm font-medium text-slate-200 mb-1 line-clamp-2">
                        {annotation.title}
                      </h4>
                    )}
                    
                    <div className="flex items-center space-x-3 text-xs text-slate-400">
                      <span className="flex items-center space-x-1">
                        <Clock size={12} />
                        <span>{formatRelativeTime(annotation.createdAt)}</span>
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-3">
                    {/* Feature indicators */}
                    <div className="flex items-center space-x-1">
                      {annotation.description && (
                        <button
                          onClick={() => onDescriptionPreview?.(annotation.description!, annotation)}
                          className="p-1 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                          title="Has description"
                        >
                          <FileText size={14} />
                        </button>
                      )}
                      {annotation.notes && (
                        <button
                          onClick={() => onNotesPreview?.(annotation.notes!, annotation)}
                          className="p-1 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded transition-colors"
                          title="Has notes"
                        >
                          <StickyNote size={14} />
                        </button>
                      )}
                      {annotation.extra?.imageUrl && (
                        <button
                          onClick={() => onImagePreview?.(annotation.extra!.imageUrl!, annotation)}
                          className="p-1 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 rounded transition-colors"
                          title="Has image"
                        >
                          <ImageIcon size={14} />
                        </button>
                      )}
                      {annotation.solutions && annotation.solutions.length > 0 && (
                        <span
                          className="p-1 text-slate-400"
                          title={`${annotation.solutions.length} solution(s)`}
                        >
                          <Sigma size={14} />
                        </span>
                      )}
                      {annotation.annotation_tags && annotation.annotation_tags.length > 0 && (
                        <span
                          className="p-1 text-slate-400"
                          title={`${annotation.annotation_tags.length} tag(s)`}
                        >
                          <Tags size={14} />
                        </span>
                      )}
                    </div>
                    
                    <button
                      onClick={() => toggleExpanded(annotation.documentId!)}
                      className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Content preview */}
              <div className="p-4">
                {/* PDF/Image display */}
                {annotation.extra?.imageUrl && (
                  <div className="mb-3">
                    <PDFMiniPreview
                      imageUrl={annotation.extra.imageUrl}
                      pdfUrl={selectedVersion?.fileUrl}
                      page={annotation.page}
                      annotationBounds={
                        annotation.extra?.bounds && 
                        typeof annotation.extra.bounds === 'object' &&
                        'x' in annotation.extra.bounds &&
                        'y' in annotation.extra.bounds &&
                        'width' in annotation.extra.bounds &&
                        'height' in annotation.extra.bounds
                          ? {
                              x: annotation.extra.bounds.x as number,
                              y: annotation.extra.bounds.y as number,
                              width: annotation.extra.bounds.width as number,
                              height: annotation.extra.bounds.height as number
                            }
                          : undefined
                      }
                      className="w-full h-32"
                      title={annotation.title || 'Annotation preview'}
                      onImageClick={() => onImagePreview?.(annotation.extra!.imageUrl!, annotation)}
                    />
                  </div>
                )}

                {annotation.textContent && (
                  <div className="mb-3 p-2 bg-slate-700/30 rounded text-xs text-slate-300 italic">
                    "{truncateText(annotation.textContent, 120)}"
                  </div>
                )}
                
                {annotation.description && !isExpanded && (
                  <div className="mb-3">
                    <p className="text-sm text-slate-300 line-clamp-2">
                      {renderMarkdownPreview(annotation.description)}
                    </p>
                  </div>
                )}

                {isExpanded && (
                  <div className="space-y-3">
                    {annotation.description && (
                      <div>
                        <h5 className="text-xs font-medium text-slate-400 mb-1 flex items-center space-x-1">
                          <FileText size={12} />
                          <span>Description</span>
                        </h5>
                        <div className="text-sm text-slate-300 bg-slate-700/30 rounded p-2 max-h-32 overflow-y-auto">
                          {renderMarkdownPreview(annotation.description, 300)}
                        </div>
                      </div>
                    )}
                    
                    {annotation.notes && (
                      <div>
                        <h5 className="text-xs font-medium text-slate-400 mb-1 flex items-center space-x-1">
                          <StickyNote size={12} />
                          <span>Notes</span>
                        </h5>
                        <div className="text-sm text-slate-300 bg-slate-700/30 rounded p-2 max-h-32 overflow-y-auto">
                          {renderMarkdownPreview(annotation.notes, 300)}
                        </div>
                      </div>
                    )}
                    
                    {annotation.annotation_tags && annotation.annotation_tags.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium text-slate-400 mb-1 flex items-center space-x-1">
                          <Tags size={12} />
                          <span>Tags</span>
                        </h5>
                        <div className="flex flex-wrap gap-1">
                          {annotation.annotation_tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs bg-slate-700/50 text-slate-300 rounded"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action button */}
                <div className="flex items-center justify-end mt-3 pt-3 border-t border-slate-700/30">
                  <button
                    onClick={() => onAnnotationClick?.(annotation)}
                    className="flex items-center space-x-1 px-2 py-1 text-xs text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                  >
                    <Eye size={12} />
                    <span>View</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // List view (medium details)
  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        {processedAnnotations.map((annotation) => {
          const color = getAnnotationColor(annotation);
          
          return (
            <div 
              key={annotation.documentId}
              className="flex items-center space-x-4 p-3 bg-slate-800/30 border border-slate-700/30 rounded-lg hover:border-slate-600/50 hover:bg-slate-800/50 transition-all duration-200 group cursor-pointer"
              onClick={() => onAnnotationClick?.(annotation)}
            >
              {/* Type indicator */}
              <div className="flex-shrink-0">
                {annotation.mode === "text" ? (
                  <Type size={18} style={{ color }} />
                ) : (
                  <Square size={18} style={{ color }} />
                )}
              </div>

              {/* Main content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  {annotation.title ? (
                    <>
                      <h4 className="text-sm font-medium text-slate-200 truncate">
                        {annotation.title}
                      </h4>
                      <span 
                        className="text-xs px-2 py-0.5 rounded flex-shrink-0"
                        style={{ 
                          backgroundColor: `${color}20`, 
                          color: color,
                          border: `1px solid ${color}40`
                        }}
                      >
                        {annotation.type}
                      </span>
                    </>
                  ) : (
                    <span 
                      className="text-xs px-2 py-0.5 rounded flex-shrink-0 italic"
                      style={{ 
                        backgroundColor: `${color}20`, 
                        color: color,
                        border: `1px solid ${color}40`
                      }}
                    >
                      {annotation.type} annotation
                    </span>
                  )}
                </div>
                
                <div className="flex items-center space-x-3 text-xs text-slate-400">
                  {annotation.page && (
                    <span className="flex items-center space-x-1">
                      <BookOpen size={11} />
                      <span>Page {annotation.page}</span>
                    </span>
                  )}
                  <span className="flex items-center space-x-1">
                    <Clock size={11} />
                    <span>{formatRelativeTime(annotation.createdAt)}</span>
                  </span>
                  {annotation.description && (
                    <span className="truncate max-w-48">
                      {renderMarkdownPreview(annotation.description, 60)}
                    </span>
                  )}
                </div>
              </div>

              {/* Features */}
              <div className="flex items-center space-x-1 flex-shrink-0">
                {annotation.description && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDescriptionPreview?.(annotation.description!, annotation); }}
                    className="p-1 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                    title="Has description"
                  >
                    <FileText size={14} />
                  </button>
                )}
                {annotation.notes && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onNotesPreview?.(annotation.notes!, annotation); }}
                    className="p-1 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded transition-colors"
                    title="Has notes"
                  >
                    <StickyNote size={14} />
                  </button>
                )}
                {annotation.extra?.imageUrl && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onImagePreview?.(annotation.extra!.imageUrl!, annotation); }}
                    className="p-1 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 rounded transition-colors"
                    title="Has image"
                  >
                    <ImageIcon size={14} />
                  </button>
                )}
                {annotation.solutions && annotation.solutions.length > 0 && (
                  <span
                    className="p-1 text-slate-400"
                    title={`${annotation.solutions.length} solution(s)`}
                  >
                    <Sigma size={14} />
                  </span>
                )}
                {annotation.annotation_tags && annotation.annotation_tags.length > 0 && (
                  <div className="flex items-center space-x-1 p-1 text-slate-400" title={`${annotation.annotation_tags.length} tag(s)`}>
                    <Tags size={14} />
                    <span className="text-xs">{annotation.annotation_tags.length}</span>
                  </div>
                )}
              </div>

              {/* Action */}
              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Eye size={14} className="text-slate-400" />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Compact view (minimal details)
  return (
    <div className="space-y-1">
      {processedAnnotations.map((annotation) => {
        const color = getAnnotationColor(annotation);
        
        return (
          <div 
            key={annotation.documentId}
            className="flex items-center space-x-3 p-2 hover:bg-slate-800/30 rounded transition-colors cursor-pointer group"
            onClick={() => onAnnotationClick?.(annotation)}
          >
            {/* Type indicator */}
            <div className="flex-shrink-0">
              {annotation.mode === "text" ? (
                <Type size={14} style={{ color }} />
              ) : (
                <Square size={14} style={{ color }} />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex items-center space-x-3">
              {annotation.title ? (
                <>
                  <span className="text-sm text-slate-200 truncate">
                    {annotation.title}
                  </span>
                  <span className="text-xs text-slate-500 flex-shrink-0">
                    {annotation.type}
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-500 italic">
                  {annotation.type} annotation
                </span>
              )}
              {annotation.page && (
                <span className="text-xs text-slate-500 flex-shrink-0">
                  p.{annotation.page}
                </span>
              )}
            </div>

            {/* Features indicator */}
            <div className="flex items-center space-x-1 flex-shrink-0">
              {annotation.description && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDescriptionPreview?.(annotation.description!, annotation); }}
                  className="p-0.5 text-slate-500 hover:text-blue-400 transition-colors"
                  title="Has description"
                >
                  <FileText size={12} />
                </button>
              )}
              {annotation.notes && (
                <button
                  onClick={(e) => { e.stopPropagation(); onNotesPreview?.(annotation.notes!, annotation); }}
                  className="p-0.5 text-slate-500 hover:text-green-400 transition-colors"
                  title="Has notes"
                >
                  <StickyNote size={12} />
                </button>
              )}
              {annotation.extra?.imageUrl && (
                <button
                  onClick={(e) => { e.stopPropagation(); onImagePreview?.(annotation.extra!.imageUrl!, annotation); }}
                  className="p-0.5 text-slate-500 hover:text-purple-400 transition-colors"
                  title="Has image"
                >
                  <ImageIcon size={12} />
                </button>
              )}
              {annotation.solutions && annotation.solutions.length > 0 && (
                <span className="text-slate-500" title={`${annotation.solutions.length} solution(s)`}>
                  <Sigma size={12} />
                </span>
              )}
              {annotation.annotation_tags && annotation.annotation_tags.length > 0 && (
                <span className="text-slate-500" title={`${annotation.annotation_tags.length} tag(s)`}>
                  <Tags size={12} />
                </span>
              )}
            </div>

            {/* Date */}
            <span className="text-xs text-slate-500 flex-shrink-0">
              {formatRelativeTime(annotation.createdAt)}
            </span>

            {/* Action */}
            <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Eye size={12} className="text-slate-400" />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LiteratureAnnotationList;

// src/components/deepRecall/annotationViewModal.tsx
import React, { useState, useMemo, useRef } from 'react';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Type, 
  Square, 
  FileText, 
  StickyNote, 
  BookOpen,
  Clock,
  Tags, 
  Calendar, 
  Image as ImageIcon,
  Sigma,
  MapPin,
  Hash,
  ExternalLink,
  Download,
  Edit,
  Save,
  Palette
} from 'lucide-react';
import { Annotation, AnnotationType, annotationTypes } from '../../types/deepRecall/strapi/annotationTypes';
import { Literature } from '../../types/deepRecall/strapi/literatureTypes';
import { AnnotationTag } from "../../types/deepRecall/strapi/annotationTagTypes";
import { prefixStrapiUrl } from '../../helpers/getStrapiMedia';
import { agoTimeToString } from '../../helpers/timesToString';
import MarkdownEditorModal from './MarkdownEditorModal';
import TagInput from './TagInput';
import PDFMiniPreview from './PDFMiniPreview';

interface AnnotationViewModalProps {
  annotation: Annotation | null;
  isOpen: boolean;
  onClose: () => void;
  annotations?: Annotation[]; // All annotations for navigation
  colorMap?: Record<string, string>;
  literature?: Literature; // Full literature object for complete information
  selectedVersion?: { fileUrl: string; [key: string]: any }; // Current selected version with PDF URL
  updateAnnotation?: (annotation: Annotation) => Promise<void>; // Function to update annotation
}

const DEFAULT_COLOR = "#64748b";

const AnnotationViewModal: React.FC<AnnotationViewModalProps> = ({
  annotation,
  isOpen,
  onClose,
  annotations = [],
  colorMap = {},
  literature,
  selectedVersion,
  updateAnnotation
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Editing state
  const [draft, setDraft] = useState<Annotation | null>(annotation);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingType, setIsEditingType] = useState(false);
  const [isEditingColor, setIsEditingColor] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  
  // Modal states for markdown editing
  const [editDescription, setEditDescription] = useState(false);
  const [editNotes, setEditNotes] = useState(false);
  
  // Refs
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Get all images from current annotation and related annotations
  const availableImages = useMemo(() => {
    if (!annotation) return [];
    
    const images: { url: string; annotation: Annotation; title: string }[] = [];
    
    // Add current annotation's image
    if (annotation.extra?.imageUrl) {
      images.push({
        url: annotation.extra.imageUrl,
        annotation,
        title: annotation.title || `${annotation.type} annotation`
      });
    }
    
    // Add images from other annotations of the same type/page for navigation
    annotations
      .filter(ann => ann.documentId !== annotation.documentId && ann.extra?.imageUrl)
      .forEach(ann => {
        images.push({
          url: ann.extra!.imageUrl!,
          annotation: ann,
          title: ann.title || `${ann.type} annotation`
        });
      });
    
    return images;
  }, [annotation, annotations]);

  const currentImage = availableImages[currentImageIndex];

  const navigateImage = (direction: 'prev' | 'next') => {
    if (availableImages.length <= 1) return;
    
    if (direction === 'prev') {
      setCurrentImageIndex(prev => prev > 0 ? prev - 1 : availableImages.length - 1);
    } else {
      setCurrentImageIndex(prev => prev < availableImages.length - 1 ? prev + 1 : 0);
    }
  };

  const getAnnotationColor = (annotation: Annotation): string => {
    return annotation.color || 
           colorMap[annotation.type] || 
           DEFAULT_COLOR;
  };

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return 'Unknown time';
    const timestamp = new Date(dateStr).getTime() / 1000;
    return agoTimeToString(timestamp);
  };

  const formatFullDate = (dateStr?: string) => {
    if (!dateStr) return 'No date';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Reset image index when annotation changes
  React.useEffect(() => {
    setCurrentImageIndex(0);
    setDraft(annotation);
    setTitleValue(annotation?.title || '');
    setIsEditingTitle(false);
    setIsEditingType(false);
    setIsEditingColor(false);
    setIsEditingTags(false);
    setEditDescription(false);
    setEditNotes(false);
  }, [annotation?.documentId]);

  // Focus title input when editing starts
  React.useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Editing functions
  const handleTitleSave = async () => {
    if (!draft || !updateAnnotation) return;
    
    const updated = { ...draft, title: titleValue };
    setDraft(updated);
    await updateAnnotation(updated);
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setTitleValue(draft?.title || '');
      setIsEditingTitle(false);
    }
  };

  const handleTypeChange = async (newType: AnnotationType) => {
    if (!draft || !updateAnnotation) return;
    
    const updated = { ...draft, type: newType };
    setDraft(updated);
    await updateAnnotation(updated);
    setIsEditingType(false);
  };

  const handleColorChange = async (newColor: string) => {
    if (!draft || !updateAnnotation) return;
    
    const updated = { ...draft, color: newColor };
    setDraft(updated);
    await updateAnnotation(updated);
  };

  const handleColorReset = async () => {
    if (!draft || !updateAnnotation) return;
    
    const updated = { ...draft, color: undefined };
    setDraft(updated);
    await updateAnnotation(updated);
    setIsEditingColor(false);
  };

  const handleTagsChange = async (newTags: AnnotationTag[]) => {
    if (!draft || !updateAnnotation) return;
    
    const updated = { ...draft, annotation_tags: newTags };
    setDraft(updated);
    await updateAnnotation(updated);
  };

  const saveDescription = async (md: string) => {
    if (!draft || !updateAnnotation) return;
    
    const updated = { ...draft, description: md };
    setDraft(updated);
    await updateAnnotation(updated);
  };

  const saveNotes = async (md: string) => {
    if (!draft || !updateAnnotation) return;
    
    const updated = { ...draft, notes: md };
    setDraft(updated);
    await updateAnnotation(updated);
  };

  if (!isOpen || !annotation || !draft) return null;

  const color = getAnnotationColor(draft);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-700/50">
          <div className="flex-1 min-w-0">
            {/* First line: Annotation type and info (display only) */}
            <div className="flex items-center space-x-3 mb-3">
              {draft.mode === "text" ? (
                <Type size={20} style={{ color }} />
              ) : (
                <Square size={20} style={{ color }} />
              )}
              
              {/* Display-only annotation type */}
              <span 
                className="px-3 py-1 rounded-lg font-medium"
                style={{ 
                  backgroundColor: `${color}20`, 
                  color: color,
                  border: `1px solid ${color}40`
                }}
              >
                {draft.type}
              </span>

              {/* Page info */}
              {draft.page && (
                <span className="text-sm text-slate-400 flex items-center space-x-1">
                  <BookOpen size={14} />
                  <span>Page {draft.page}</span>
                </span>
              )}

              {/* Time info */}
              <span className="text-sm text-slate-400 flex items-center space-x-1">
                <Clock size={14} />
                <span>{formatRelativeTime(draft.createdAt)}</span>
              </span>
            </div>

            {/* Second line: Literature info and annotation title (display only) */}
            <div className="flex items-center space-x-3">
              {literature && (
                <div className="flex items-center space-x-2">
                  <span className="text-xs px-2 py-1 bg-slate-700/50 text-slate-400 rounded font-medium uppercase tracking-wide">
                    {literature.type?.toUpperCase() || 'DOCUMENT'}
                  </span>
                  {literature.title && (
                    <span className="text-lg font-bold text-slate-100 truncate max-w-96">
                      {literature.title}
                    </span>
                  )}
                </div>
              )}
              
              {/* Display-only annotation title */}
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                {(literature?.title || draft.title) && <span className="text-slate-400">•</span>}
                {draft.title ? (
                  <span className="text-lg font-bold text-slate-100 truncate">
                    {draft.title}
                  </span>
                ) : (
                  <span className="text-lg font-bold italic text-slate-400 truncate">
                    Untitled annotation
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 flex-shrink-0">
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
          
          {/* Left Panel - Image/PDF Preview */}
          <div className="w-1/2 border-r border-slate-700/50 flex flex-col">
            <div className="flex-1 flex items-center justify-center p-6 bg-slate-800/30">
              {availableImages.length > 0 ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <PDFMiniPreview
                    imageUrl={currentImage.url}
                    pdfUrl={selectedVersion?.fileUrl}
                    page={currentImage.annotation.page}
                    annotationBounds={
                      currentImage.annotation.extra?.bounds && 
                      typeof currentImage.annotation.extra.bounds === 'object' &&
                      'x' in currentImage.annotation.extra.bounds &&
                      'y' in currentImage.annotation.extra.bounds &&
                      'width' in currentImage.annotation.extra.bounds &&
                      'height' in currentImage.annotation.extra.bounds
                        ? {
                            x: currentImage.annotation.extra.bounds.x as number,
                            y: currentImage.annotation.extra.bounds.y as number,
                            width: currentImage.annotation.extra.bounds.width as number,
                            height: currentImage.annotation.extra.bounds.height as number
                          }
                        : undefined
                    }
                    className="w-full h-full"
                    title={currentImage.title}
                    onImageClick={() => window.open(prefixStrapiUrl(currentImage.url), '_blank')}
                  />
                  
                  {/* Image navigation */}
                  {availableImages.length > 1 && (
                    <>
                      <button
                        onClick={() => navigateImage('prev')}
                        className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200 z-10"
                        title="Previous image"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        onClick={() => navigateImage('next')}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200"
                        title="Next image"
                      >
                        <ChevronRight size={20} />
                      </button>
                      
                      {/* Image counter */}
                      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-black/70 text-white text-sm rounded-full">
                        {currentImageIndex + 1} of {availableImages.length}
                      </div>
                    </>
                  )}
                  
                  {/* Image actions */}
                  <div className="absolute top-4 right-4 flex space-x-2">
                    <button
                      onClick={() => window.open(prefixStrapiUrl(currentImage.url), '_blank')}
                      className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-all duration-200"
                      title="Open in new tab"
                    >
                      <ExternalLink size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                /* No image placeholder */
                <div className="text-center">
                  <div className="w-24 h-24 bg-slate-700/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <ImageIcon className="w-12 h-12 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-300 mb-2">No Image Available</h3>
                  <p className="text-slate-500">This annotation doesn't have an associated image.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Annotation Content */}
          <div className="w-1/2 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Editing Controls - Only show when updateAnnotation is provided */}
              {updateAnnotation && (
                <div className="space-y-4 pb-4 border-b border-slate-700/30">
                  {/* Title Editor */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center">
                      <Edit className="w-4 h-4 mr-2" />
                      Title
                    </h4>
                    {isEditingTitle ? (
                      <div className="flex items-center space-x-2">
                        <input
                          ref={titleInputRef}
                          value={titleValue}
                          onChange={(e) => setTitleValue(e.target.value)}
                          onKeyDown={handleTitleKeyDown}
                          onBlur={handleTitleSave}
                          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500"
                          placeholder="Enter annotation title..."
                        />
                        <button
                          onClick={handleTitleSave}
                          className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded transition-colors"
                          title="Save"
                        >
                          <Save size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsEditingTitle(true)}
                        className="w-full text-left px-3 py-2 bg-slate-800/50 border border-slate-700/30 rounded-lg text-slate-200 hover:bg-slate-800 hover:border-slate-600/50 transition-colors"
                      >
                        {draft.title || "Click to add title..."}
                      </button>
                    )}
                  </div>

                  {/* Type and Color Controls */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Type Editor */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-300 mb-2">Type</h4>
                      <select
                        value={draft.type}
                        onChange={(e) => handleTypeChange(e.target.value as AnnotationType)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:border-slate-500 focus:outline-none"
                        style={{
                          backgroundColor: '#1e293b',
                          borderColor: '#475569',
                          color: '#e2e8f0'
                        }}
                      >
                        {annotationTypes.map((type) => (
                          <option key={type} value={type} style={{
                            backgroundColor: '#1e293b',
                            color: '#e2e8f0'
                          }}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Color Editor */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-slate-300">Color</h4>
                        {isEditingColor && (
                          <button
                            onClick={handleColorReset}
                            className="text-xs text-slate-400 hover:text-slate-300"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-10 h-10 rounded border border-slate-600 cursor-pointer flex-shrink-0"
                          style={{ backgroundColor: color }}
                          onClick={() => setIsEditingColor(!isEditingColor)}
                        />
                        {isEditingColor && (
                          <input
                            type="color"
                            value={draft.color || "#64748b"}
                            onChange={(e) => handleColorChange(e.target.value)}
                            className="w-10 h-10 rounded border border-slate-600 cursor-pointer bg-slate-800"
                          />
                        )}
                        <span className="text-xs text-slate-400 font-mono">{color}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-slate-300 flex items-center">
                        <Tags className="w-4 h-4 mr-2" />
                        Tags
                      </h4>
                      <button
                        onClick={() => setIsEditingTags(!isEditingTags)}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        {isEditingTags ? 'Done' : 'Edit'}
                      </button>
                    </div>
                    {isEditingTags ? (
                      <TagInput
                        tags={draft.annotation_tags || []}
                        onChange={handleTagsChange}
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {draft.annotation_tags && draft.annotation_tags.length > 0 ? (
                          draft.annotation_tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-slate-700/50 text-slate-300 rounded-full text-sm border border-slate-600/50"
                            >
                              {tag.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500 italic">No tags</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Text Content */}
              {draft.textContent && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-200 mb-3 flex items-center">
                    <Type className="w-5 h-5 mr-2" />
                    Selected Text
                  </h3>
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
                    <p className="text-slate-300 italic leading-relaxed">
                      "{draft.textContent}"
                    </p>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-slate-200 flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Description
                  </h3>
                  {updateAnnotation && (
                    <button
                      onClick={() => setEditDescription(true)}
                      className="flex items-center space-x-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <Edit size={14} />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
                {draft.description ? (
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30 prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {draft.description}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30 border-dashed">
                    <p className="text-slate-500 italic text-center">
                      {updateAnnotation ? 'Click Edit to add a description' : 'No description'}
                    </p>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-slate-200 flex items-center">
                    <StickyNote className="w-5 h-5 mr-2" />
                    Notes
                  </h3>
                  {updateAnnotation && (
                    <button
                      onClick={() => setEditNotes(true)}
                      className="flex items-center space-x-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <Edit size={14} />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
                {draft.notes ? (
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30 prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {draft.notes}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30 border-dashed">
                    <p className="text-slate-500 italic text-center">
                      {updateAnnotation ? 'Click Edit to add notes' : 'No notes'}
                    </p>
                  </div>
                )}
              </div>

              {/* Groups */}
              {draft.annotation_groups && draft.annotation_groups.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-200 mb-3 flex items-center">
                    <Tags className="w-5 h-5 mr-2" />
                    Groups
                  </h3>
                  <div className="space-y-2">
                    {draft.annotation_groups.map((group, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-2 bg-slate-700/30 text-slate-300 rounded-lg text-sm border border-slate-600/30"
                      >
                        <p className="font-medium">{group.name}</p>
                        {group.annotations && group.annotations.length > 0 && (
                          <p className="text-xs text-slate-400 mt-1">
                            {group.annotations.length} annotation{group.annotations.length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Solutions */}
              {draft.solutions && draft.solutions.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-200 mb-3 flex items-center">
                    <Sigma className="w-5 h-5 mr-2" />
                    Solutions ({draft.solutions.length})
                  </h3>
                  <div className="space-y-3">
                    {draft.solutions.map((solution, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-slate-400">
                            Solution {idx + 1} • {new Date(solution.date).toLocaleDateString()}
                          </p>
                          {solution.fileUrl && (
                            <a
                              href={prefixStrapiUrl(solution.fileUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-sm"
                            >
                              <Download size={14} />
                              <span>Download</span>
                            </a>
                          )}
                        </div>
                        {solution.notes && (
                          <div className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[rehypeKatex]}
                            >
                              {solution.notes}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Responses */}
              {(annotation.exerciseExplanations?.length || 
                annotation.exerciseSolutions?.length || 
                annotation.figureExplanations?.length ||
                annotation.illustrationExplanations?.length ||
                annotation.tableExtractions?.length ||
                annotation.latexConversions?.length ||
                annotation.markdownConversions?.length ||
                annotation.tocExtractions?.length) && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-200 mb-3">
                    AI Analysis
                  </h3>
                  <div className="space-y-4">
                    {annotation.exerciseExplanations?.map((ai, idx) => (
                      <div key={`explanation-${idx}`} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
                        <h4 className="text-sm font-medium text-blue-400 mb-2">Exercise Explanation</h4>
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {ai.text}
                          </ReactMarkdown>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          Generated by {ai.model} • {new Date(ai.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                    
                    {annotation.exerciseSolutions?.map((ai, idx) => (
                      <div key={`solution-${idx}`} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
                        <h4 className="text-sm font-medium text-green-400 mb-2">Exercise Solution</h4>
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {ai.text}
                          </ReactMarkdown>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          Generated by {ai.model} • {new Date(ai.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                    
                    {annotation.figureExplanations?.map((ai, idx) => (
                      <div key={`figure-${idx}`} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
                        <h4 className="text-sm font-medium text-purple-400 mb-2">Figure Explanation</h4>
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {ai.text}
                          </ReactMarkdown>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          Generated by {ai.model} • {new Date(ai.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Markdown Editor Modals */}
      {editDescription && (
        <MarkdownEditorModal
          initial={draft?.description || ""}
          onSave={(md) => {
            saveDescription(md);
            setEditDescription(false);
          }}
          onClose={() => setEditDescription(false)}
          annotation={draft}
          objectName="Description"
          colorMap={colorMap}
        />
      )}

      {editNotes && (
        <MarkdownEditorModal
          initial={draft?.notes || ""}
          onSave={(md) => {
            saveNotes(md);
            setEditNotes(false);
          }}
          onClose={() => setEditNotes(false)}
          annotation={draft}
          objectName="Notes"
          colorMap={colorMap}
        />
      )}
    </div>
  );
};

export default AnnotationViewModal;

// src/components/deepRecall/annotationPreviewModals.tsx
import React from 'react';
import { X, FileText, StickyNote, Image as ImageIcon, Calendar, MapPin, Type, Square, Tags, Hash } from 'lucide-react';
import { Annotation } from '../../types/deepRecall/strapi/annotationTypes';
import { prefixStrapiUrl } from '../../helpers/getStrapiMedia';

interface BasePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  annotation: Annotation;
}

interface ImagePreviewModalProps extends BasePreviewModalProps {
  imageUrl: string;
}

interface TextPreviewModalProps extends BasePreviewModalProps {
  content: string;
  title: string;
  icon: React.ReactNode;
  contentType: 'description' | 'notes';
}

// Image Preview Modal
export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  isOpen,
  onClose,
  annotation,
  imageUrl
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl max-w-4xl max-h-[90vh] w-full flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Annotation Image</h3>
              <p className="text-sm text-slate-400">
                {annotation.title || 'Untitled Annotation'} • {annotation.type}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image Content */}
        <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
          <div className="max-w-full max-h-full flex items-center justify-center">
            <img
              src={prefixStrapiUrl(imageUrl)}
              alt={annotation.title || 'Annotation image'}
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              style={{ maxHeight: 'calc(90vh - 200px)' }}
            />
          </div>
        </div>

        {/* Footer with annotation details */}
        <div className="p-4 border-t border-slate-700/50 bg-slate-800/30">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4 text-slate-400">
              {annotation.page && (
                <span className="flex items-center space-x-1">
                  <MapPin className="w-4 h-4" />
                  <span>Page {annotation.page}</span>
                </span>
              )}
              <span className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>{new Date(annotation.createdAt || '').toLocaleDateString()}</span>
              </span>
              {annotation.documentId && (
                <span className="flex items-center space-x-1">
                  <Hash className="w-4 h-4" />
                  <span>ID: {annotation.documentId.slice(-8)}</span>
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => window.open(prefixStrapiUrl(imageUrl), '_blank')}
                className="px-3 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors text-sm"
              >
                Open in New Tab
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Text Content Preview Modal (for descriptions and notes)
export const TextPreviewModal: React.FC<TextPreviewModalProps> = ({
  isOpen,
  onClose,
  annotation,
  content,
  title,
  icon,
  contentType
}) => {
  if (!isOpen) return null;

  // Simple markdown rendering for preview
  const renderMarkdown = (markdown: string) => {
    // Basic markdown parsing - you might want to use a proper markdown library
    let html = markdown
      .replace(/#{3}\s*(.*?)$/gm, '<h3 class="text-lg font-semibold text-slate-200 mt-4 mb-2">$1</h3>')
      .replace(/#{2}\s*(.*?)$/gm, '<h2 class="text-xl font-semibold text-slate-200 mt-4 mb-2">$1</h2>')
      .replace(/#{1}\s*(.*?)$/gm, '<h1 class="text-2xl font-bold text-slate-100 mt-4 mb-3">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-100">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic text-slate-200">$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-slate-700/50 text-slate-200 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n\n/g, '</p><p class="text-slate-300 leading-relaxed mb-3">')
      .replace(/\n/g, '<br>');

    // Wrap in paragraph tags
    if (!html.startsWith('<h') && !html.startsWith('<p')) {
      html = `<p class="text-slate-300 leading-relaxed mb-3">${html}</p>`;
    }

    return html;
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl max-w-4xl max-h-[90vh] w-full flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              contentType === 'description' ? 'bg-blue-500/20' : 'bg-green-500/20'
            }`}>
              <div className={contentType === 'description' ? 'text-blue-400' : 'text-green-400'}>
                {icon}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
              <p className="text-sm text-slate-400">
                {annotation.title || 'Untitled Annotation'} • {annotation.type}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="prose prose-invert max-w-none">
            <div 
              className="text-slate-300 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          </div>
        </div>

        {/* Footer with annotation details */}
        <div className="p-4 border-t border-slate-700/50 bg-slate-800/30">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4 text-slate-400">
              <span className="flex items-center space-x-1">
                {annotation.mode === 'text' ? <Type className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                <span>{annotation.mode === 'text' ? 'Text Selection' : 'Rectangle Annotation'}</span>
              </span>
              {annotation.page && (
                <span className="flex items-center space-x-1">
                  <MapPin className="w-4 h-4" />
                  <span>Page {annotation.page}</span>
                </span>
              )}
              <span className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>{new Date(annotation.createdAt || '').toLocaleDateString()}</span>
              </span>
              {annotation.annotation_tags && annotation.annotation_tags.length > 0 && (
                <span className="flex items-center space-x-1">
                  <Tags className="w-4 h-4" />
                  <span>{annotation.annotation_tags.length} tag{annotation.annotation_tags.length !== 1 ? 's' : ''}</span>
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {annotation.documentId && (
                <span className="text-xs text-slate-500">
                  ID: {annotation.documentId.slice(-8)}
                </span>
              )}
              <button
                onClick={onClose}
                className="px-3 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Convenience components for specific content types
export const DescriptionPreviewModal: React.FC<Omit<TextPreviewModalProps, 'title' | 'icon' | 'contentType'>> = (props) => (
  <TextPreviewModal
    {...props}
    title="Annotation Description"
    icon={<FileText className="w-4 h-4" />}
    contentType="description"
  />
);

export const NotesPreviewModal: React.FC<Omit<TextPreviewModalProps, 'title' | 'icon' | 'contentType'>> = (props) => (
  <TextPreviewModal
    {...props}
    title="Annotation Notes"
    icon={<StickyNote className="w-4 h-4" />}
    contentType="notes"
  />
);

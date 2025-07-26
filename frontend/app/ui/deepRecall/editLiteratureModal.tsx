// editLiteratureModal.tsx

import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { LiteratureExtended } from '../../types/deepRecall/strapi/literatureTypes';

interface EditLiteratureModalProps {
  literature: LiteratureExtended;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (updatedLiterature: Partial<LiteratureExtended>) => void;
}

const EditLiteratureModal: React.FC<EditLiteratureModalProps> = ({
  literature,
  isOpen,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    title: literature.title || '',
    subtitle: literature.subtitle || '',
    authors: Array.isArray(literature.authors) ? literature.authors.join(', ') : '',
    publisher: literature.publisher || '',
    journal: literature.journal || '',
    doi: literature.doi || '',
    type: literature.type || '',
  });

  if (!isOpen) return null;

  const handleSave = () => {
    const updatedData = {
      ...formData,
      authors: formData.authors.split(',').map(author => author.trim()).filter(author => author),
    };
    onSave?.(updatedData);
    onClose();
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-2xl shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <h2 className="text-xl font-bold text-slate-100">Edit Literature</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
              placeholder="Enter title..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Subtitle</label>
            <input
              type="text"
              value={formData.subtitle}
              onChange={(e) => handleInputChange('subtitle', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
              placeholder="Enter subtitle..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Authors</label>
            <input
              type="text"
              value={formData.authors}
              onChange={(e) => handleInputChange('authors', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
              placeholder="Enter authors separated by commas..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Type</label>
              <select
                value={formData.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
              >
                <option value="">Select type...</option>
                <option value="paper">Paper</option>
                <option value="book">Book</option>
                <option value="article">Article</option>
                <option value="thesis">Thesis</option>
                <option value="report">Report</option>
                <option value="conference">Conference</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Publisher</label>
              <input
                type="text"
                value={formData.publisher}
                onChange={(e) => handleInputChange('publisher', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
                placeholder="Enter publisher..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Journal</label>
            <input
              type="text"
              value={formData.journal}
              onChange={(e) => handleInputChange('journal', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
              placeholder="Enter journal..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">DOI</label>
            <input
              type="text"
              value={formData.doi}
              onChange={(e) => handleInputChange('doi', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
              placeholder="Enter DOI..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-700/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
          >
            <Save className="w-4 h-4" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditLiteratureModal;

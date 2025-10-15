// createLiteratureModal.tsx

import React, { useState } from 'react';
import { X, Upload, Plus, BookOpen } from 'lucide-react';
import { LiteratureType } from '../../types/deepRecall/strapi/literatureTypes';
import { useLiteratureTypes } from '../../customHooks/useLiterature';
import LiteratureForm from './literatureForm';
import EnhancedLiteratureForm from './enhancedLiteratureForm';

interface CreateLiteratureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateLiterature?: () => void;
  initialPdfFile?: File | null;
}

const CreateLiteratureModal: React.FC<CreateLiteratureModalProps> = ({
  isOpen,
  onClose,
  onCreateLiterature,
  initialPdfFile
}) => {
  const [selectedLiteratureType, setSelectedLiteratureType] = useState<LiteratureType | null>(null);
  const [showLiteratureForm, setShowLiteratureForm] = useState(false);
  
  const { data: literatureTypes, isLoading: typesLoading, error: typesError } = useLiteratureTypes();

  if (!isOpen) return null;

  const handleLiteratureTypeSelect = (literatureType: LiteratureType) => {
    setSelectedLiteratureType(literatureType);
    setShowLiteratureForm(true);
  };

  const handleClose = () => {
    // Reset all state when closing
    setShowLiteratureForm(false);
    setSelectedLiteratureType(null);
    onClose();
  };

  const handleBack = () => {
    setShowLiteratureForm(false);
    setSelectedLiteratureType(null);
  };

  const handleLiteratureSuccess = () => {
    onCreateLiterature?.();
    handleClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-4xl max-h-[80vh] shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div className="flex items-center space-x-4">
            {showLiteratureForm && (
              <button
                onClick={handleBack}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all duration-200"
              >
                ←
              </button>
            )}
            <h2 className="text-xl font-bold text-slate-100">
              {showLiteratureForm ? `Create New ${selectedLiteratureType?.name}` : 'Create New Literature'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!showLiteratureForm ? (
            /* Literature Type Selection */
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-200 mb-2">Select Literature Type</h3>
                <p className="text-slate-400">Choose the type of literature you want to create</p>
              </div>

              {typesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : typesError ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <X className="w-8 h-8 text-red-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-300 mb-2">Error Loading Literature Types</h3>
                  <p className="text-slate-500">Please try again later.</p>
                </div>
              ) : literatureTypes && literatureTypes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {literatureTypes.map((literatureType) => (
                    <button
                      key={literatureType.documentId}
                      onClick={() => handleLiteratureTypeSelect(literatureType)}
                      className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-slate-600/50 hover:bg-slate-800/70 transition-all duration-200 text-left group"
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="font-medium text-slate-200 group-hover:text-white transition-colors">
                            {literatureType.name.charAt(0).toUpperCase() + literatureType.name.slice(1)}
                          </h4>
                        </div>
                      </div>
                      <p className="text-sm text-slate-400">
                        Create a new {literatureType.name.toLowerCase()} entry.
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-300 mb-2">No Literature Types Available</h3>
                  <p className="text-slate-500 mb-4">
                    You need to create literature types before you can add literature entries.
                  </p>
                </div>
              )}

              {literatureTypes && literatureTypes.length > 0 && (
                <div className="mt-6 p-4 bg-slate-800/30 border border-slate-700/30 rounded-lg">
                  <div className="flex items-center space-x-3 mb-2">
                    <Plus className="w-5 h-5 text-slate-400" />
                    <span className="text-slate-300 font-medium">Need a different literature type?</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    You can create custom literature types in the Upload Widget section.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Literature Form */
            <div className="p-6">
              {selectedLiteratureType && (
                <EnhancedLiteratureForm
                  literatureType={selectedLiteratureType}
                  onSuccess={handleLiteratureSuccess}
                  onCancel={handleBack}
                  initialPdfFile={initialPdfFile}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateLiteratureModal;

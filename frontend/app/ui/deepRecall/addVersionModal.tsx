// addVersionModal.tsx

import React, { useState, useEffect } from 'react';
import { X, Upload, AlertCircle } from 'lucide-react';
import { LiteratureExtended } from '../../types/deepRecall/strapi/literatureTypes';
import { VersionType } from '../../types/deepRecall/strapi/versionTypes';
import { useVersionTypes } from '../../customHooks/useLiterature';
import VersionForm from './versionForm';

interface AddVersionModalProps {
  literature: LiteratureExtended;
  isOpen: boolean;
  onClose: () => void;
  onAddVersion?: (versionData: any) => void;
  initialFile?: File; // Add support for pre-selected file
}

const AddVersionModal: React.FC<AddVersionModalProps> = ({
  literature,
  isOpen,
  onClose,
  onAddVersion,
  initialFile
}) => {
  const [matchingVersionType, setMatchingVersionType] = useState<VersionType | null>(null);
  const [showVersionForm, setShowVersionForm] = useState(false);
  
  const { data: versionTypes, isLoading: versionLoading, error: versionError } = useVersionTypes();

  // Automatically find the matching version type based on literature type
  useEffect(() => {
    if (versionTypes && literature.type) {
      const matchingType = versionTypes.find(vt => vt.name.toLowerCase() === literature.type.toLowerCase());
      if (matchingType) {
        setMatchingVersionType(matchingType);
        setShowVersionForm(true);
      } else {
        setMatchingVersionType(null);
        setShowVersionForm(false);
      }
    }
  }, [versionTypes, literature.type]);

  if (!isOpen) return null;

  const handleVersionSuccess = () => {
    onClose();
    setShowVersionForm(false);
    setMatchingVersionType(null);
  };

  const handleBack = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-4xl max-h-[80vh] shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold text-slate-100">
              {matchingVersionType ? `Add ${matchingVersionType.name} Version` : 'Add New Version'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {versionLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : versionError ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-300 mb-2">Error Loading Version Types</h3>
              <p className="text-slate-500">Please try again later.</p>
            </div>
          ) : !matchingVersionType ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-yellow-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-300 mb-2">No Matching Version Type Found</h3>
              <p className="text-slate-500 mb-4">
                No version type found for literature type "{literature.type}". 
              </p>
              <p className="text-slate-400 text-sm">
                You may need to create a version type with the name "{literature.type}" first.
              </p>
            </div>
          ) : (
            /* Version Form */
            <div className="p-6">
              <VersionForm
                versionType={matchingVersionType}
                entry={literature}
                onSuccess={handleVersionSuccess}
                onCancel={handleBack}
                initialFile={initialFile}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddVersionModal;

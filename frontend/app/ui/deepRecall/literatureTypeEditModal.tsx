// literatureTypeEditModal.tsx

import React, { useState, useEffect } from "react";
import { LiteratureType, LiteratureExtended } from "../../types/deepRecall/strapi/literatureTypes";
import { useLiterature } from "../../customHooks/useLiterature";
import LiteratureTypeCreationForm from "./literatureTypeCreationForm";
import { updateLiteratureType, deleteLiteratureType } from "../../api/literatureService";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, AlertTriangle, Trash2, Edit3, FileText } from 'lucide-react';

interface LiteratureTypeEditModalProps {
  literatureType: LiteratureType;
  isOpen: boolean;
  onClose: () => void;
}

interface WarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
  type: 'warning' | 'danger';
}

const WarningModal: React.FC<WarningModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  type
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]">
      <div className="bg-slate-900 rounded-xl p-6 max-w-md w-full mx-4 border border-slate-700">
        <div className="flex items-center space-x-3 mb-4">
          <div className={`p-2 rounded-lg ${type === 'danger' ? 'bg-red-900/20' : 'bg-yellow-900/20'}`}>
            <AlertTriangle className={`w-6 h-6 ${type === 'danger' ? 'text-red-400' : 'text-yellow-400'}`} />
          </div>
          <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
        </div>
        <p className="text-slate-300 mb-6">{message}</p>
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              type === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-yellow-600 text-white hover:bg-yellow-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const LiteratureTypeEditModal: React.FC<LiteratureTypeEditModalProps> = ({
  literatureType,
  isOpen,
  onClose,
}) => {
  const { data: literatures } = useLiterature();
  const queryClient = useQueryClient();
  
  const [showWarning, setShowWarning] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{ name: string; typeMetadata: string } | null>(null);

  // Get literature entries that use this type
  const linkedLiteratures = literatures?.filter(lit => lit.type === literatureType.name) || [];
  const hasLinkedEntries = linkedLiteratures.length > 0;

  // Parse current metadata to check if we're only adding fields
  const currentMetadata = React.useMemo(() => {
    try {
      return JSON.parse(literatureType.typeMetadata);
    } catch {
      return {};
    }
  }, [literatureType.typeMetadata]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LiteratureType> }) =>
      updateLiteratureType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["literatureTypes"] });
      queryClient.invalidateQueries({ queryKey: ["literatures"] });
      onClose();
    },
    onError: (error: Error) => {
      console.error("Failed to update literature type:", error);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLiteratureType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["literatureTypes"] });
      queryClient.invalidateQueries({ queryKey: ["literatures"] });
      onClose();
    },
    onError: (error: Error) => {
      console.error("Failed to delete literature type:", error);
    },
  });

  const isOnlyAddingFields = (newMetadata: any) => {
    const currentFields = Object.keys(currentMetadata);
    const newFields = Object.keys(newMetadata);
    
    // Check if all current fields are still present
    return currentFields.every(field => newFields.includes(field));
  };

  const handleSubmit = (payload: { name: string; typeMetadata: string }) => {
    if (!hasLinkedEntries) {
      // No linked entries, safe to update
      updateMutation.mutate({
        id: literatureType.documentId || '',
        data: payload
      });
      return;
    }

    // Check if we're only adding fields
    const newMetadata = JSON.parse(payload.typeMetadata);
    const nameChanged = payload.name !== literatureType.name;
    const onlyAddingFields = !nameChanged && isOnlyAddingFields(newMetadata);

    if (onlyAddingFields) {
      // Safe to update without warning
      updateMutation.mutate({
        id: literatureType.documentId || '',
        data: payload
      });
    } else {
      // Show warning
      setPendingUpdate(payload);
      setShowWarning(true);
    }
  };

  const handleConfirmUpdate = () => {
    if (pendingUpdate) {
      updateMutation.mutate({
        id: literatureType.documentId || '',
        data: pendingUpdate
      });
    }
    setShowWarning(false);
    setPendingUpdate(null);
  };

  const handleDelete = () => {
    if (hasLinkedEntries) {
      setShowDeleteWarning(true);
    } else {
      deleteMutation.mutate(literatureType.documentId || '');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-slate-900 rounded-xl w-full max-w-[95vw] h-[90vh] mx-4 flex overflow-hidden">
          {/* Main Content - Form */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <Edit3 className="w-6 h-6 text-emerald-500" />
                <h2 className="text-xl font-semibold text-slate-100">
                  Edit Literature Type: {literatureType.name}
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-all duration-200 disabled:opacity-50"
                  title="Delete Literature Type"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Warning Banner */}
            {hasLinkedEntries && (
              <div className="p-4 bg-yellow-900/20 border-b border-yellow-600/30">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  <p className="text-yellow-200 text-sm">
                    <strong>{linkedLiteratures.length}</strong> literature {linkedLiteratures.length === 1 ? 'entry uses' : 'entries use'} this type. 
                    Only adding new fields is safe. Other changes may affect existing data.
                  </p>
                </div>
              </div>
            )}

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto">
              <LiteratureTypeCreationForm
                onSubmit={handleSubmit}
                onCancel={onClose}
                initialData={{
                  name: literatureType.name,
                  typeMetadata: literatureType.typeMetadata
                }}
                className="p-6"
                isEditing={true}
              />
            </div>
          </div>

          {/* Sidebar - Linked Literature */}
          <div className="w-80 border-l border-slate-700 bg-slate-800/50 flex flex-col">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-lg font-medium text-slate-200 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-slate-400" />
                <span>Linked Literature</span>
                <span className="text-sm text-slate-400">({linkedLiteratures.length})</span>
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {linkedLiteratures.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-slate-500" />
                  </div>
                  <p className="text-slate-400 text-sm">No literature entries use this type</p>
                  <p className="text-slate-500 text-xs mt-1">This type can be safely deleted</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {linkedLiteratures.map((literature) => (
                    <div
                      key={literature.documentId}
                      className="p-3 bg-slate-700/30 border border-slate-600/30 rounded-lg hover:bg-slate-700/50 transition-colors"
                    >
                      <h4 className="text-slate-200 text-sm font-medium mb-1 line-clamp-2">
                        {literature.title}
                      </h4>
                      {literature.subtitle && (
                        <p className="text-slate-400 text-xs mb-1 line-clamp-1">
                          {literature.subtitle}
                        </p>
                      )}
                      {literature.authors && Array.isArray(literature.authors) && literature.authors.length > 0 && (
                        <p className="text-slate-500 text-xs">
                          {literature.authors.slice(0, 2).join(", ")}
                          {literature.authors.length > 2 && ` +${literature.authors.length - 2} more`}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-500">
                          {literature.versions?.length || 0} version{literature.versions?.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-slate-500">
                          {literature.updatedAt ? new Date(literature.updatedAt).toLocaleDateString() : 'Unknown'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Update Warning Modal */}
      <WarningModal
        isOpen={showWarning}
        onClose={() => {
          setShowWarning(false);
          setPendingUpdate(null);
        }}
        onConfirm={handleConfirmUpdate}
        title="Confirm Changes"
        message={`This literature type is used by ${linkedLiteratures.length} literature ${linkedLiteratures.length === 1 ? 'entry' : 'entries'}. Making these changes may affect existing data. Are you sure you want to continue?`}
        confirmText="Update Anyway"
        type="warning"
      />

      {/* Delete Warning Modal */}
      <WarningModal
        isOpen={showDeleteWarning}
        onClose={() => setShowDeleteWarning(false)}
        onConfirm={() => setShowDeleteWarning(false)}
        title="Cannot Delete Literature Type"
        message={`This literature type cannot be deleted because it's used by ${linkedLiteratures.length} literature ${linkedLiteratures.length === 1 ? 'entry' : 'entries'}. Please delete all associated literature entries manually in the Literature Library before deleting this type.`}
        confirmText="Got It"
        type="danger"
      />
    </>
  );
};

export default LiteratureTypeEditModal;

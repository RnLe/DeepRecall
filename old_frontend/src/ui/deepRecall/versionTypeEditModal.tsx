// versionTypeEditModal.tsx

import React, { useState, useEffect } from "react";
import { VersionType } from "../../types/deepRecall/strapi/versionTypes";
import { useLiterature } from "../../customHooks/useLiterature";
import VersionTypeCreationForm from "./versionTypeCreationForm";
import { updateVersionType, deleteVersionType } from "../../api/literatureService";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, AlertTriangle, Trash2, Edit3, FileText } from 'lucide-react';

interface VersionTypeEditModalProps {
  versionType: VersionType;
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

const VersionTypeEditModal: React.FC<VersionTypeEditModalProps> = ({
  versionType,
  isOpen,
  onClose,
}) => {
  const { data: literatures } = useLiterature();
  const queryClient = useQueryClient();
  
  const [showWarning, setShowWarning] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{ 
    name: string; 
    versionMetadata: string; 
  } | null>(null);

  // Get all versions that use this type
  const linkedVersions = React.useMemo(() => {
    if (!literatures) return [];
    
    type VersionWithMeta = {
      versionTitle?: string;
      versionNumber?: number;
      editionNumber?: number;
      publishingDate?: string;
      literatureTitle: string;
      literatureId: string;
    };
    
    const versions: VersionWithMeta[] = [];
    for (const literature of literatures) {
      if (literature.versions) {
        for (const version of literature.versions) {
          // Check if this version uses this version type by looking at the type field
          // Since versions don't have a direct type field, we need to check metadata
          const versionMeta = version.customMetadata || {};
          const versionTypeName = versionMeta.versionType || version.versionTitle?.split(' ')[0];
          
          if (versionTypeName === versionType.name) {
            versions.push({
              versionTitle: version.versionTitle,
              versionNumber: version.versionNumber,
              editionNumber: version.editionNumber,
              publishingDate: version.publishingDate,
              literatureTitle: literature.title,
              literatureId: literature.documentId || '',
            });
          }
        }
      }
    }
    return versions;
  }, [literatures, versionType.name]);

  const hasLinkedEntries = linkedVersions.length > 0;

  // Parse current metadata to check if we're only adding fields
  const currentMetadata = React.useMemo(() => {
    try {
      return JSON.parse(versionType.versionMetadata);
    } catch {
      return {};
    }
  }, [versionType.versionMetadata]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VersionType> }) =>
      updateVersionType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["versionTypes"] });
      queryClient.invalidateQueries({ queryKey: ["literatures"] });
      onClose();
    },
    onError: (error: Error) => {
      console.error("Failed to update version type:", error);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVersionType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["versionTypes"] });
      queryClient.invalidateQueries({ queryKey: ["literatures"] });
      onClose();
    },
    onError: (error: Error) => {
      console.error("Failed to delete version type:", error);
    },
  });

  const isOnlyAddingFields = (newMetadata: any) => {
    const currentFields = Object.keys(currentMetadata);
    const newFields = Object.keys(newMetadata);
    
    // Check if all current fields are still present
    return currentFields.every(field => newFields.includes(field));
  };

  const handleSubmit = (payload: { 
    name: string; 
    versionMetadata: string; 
  }) => {
    if (!hasLinkedEntries) {
      // No linked entries, safe to update
      updateMutation.mutate({
        id: versionType.documentId || '',
        data: payload
      });
      return;
    }

    // Check if we're only adding fields
    const newMetadata = JSON.parse(payload.versionMetadata);
    const nameChanged = payload.name !== versionType.name;
    const onlyAddingFields = !nameChanged && isOnlyAddingFields(newMetadata);

    if (onlyAddingFields) {
      // Safe to update without warning
      updateMutation.mutate({
        id: versionType.documentId || '',
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
        id: versionType.documentId || '',
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
      deleteMutation.mutate(versionType.documentId || '');
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
                  Edit Version Type: {versionType.name}
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-all duration-200 disabled:opacity-50"
                  title="Delete Version Type"
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
                    <strong>{linkedVersions.length}</strong> version {linkedVersions.length === 1 ? 'entry uses' : 'entries use'} this type. 
                    Only adding new fields is safe. Other changes may affect existing data.
                  </p>
                </div>
              </div>
            )}

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto">
              <VersionTypeCreationForm
                onSubmit={handleSubmit}
                onCancel={onClose}
                initialData={{
                  name: versionType.name,
                  versionMetadata: versionType.versionMetadata
                }}
                className="p-6"
                isEditing={true}
              />
            </div>
          </div>

          {/* Sidebar - Linked Versions */}
          <div className="w-80 border-l border-slate-700 bg-slate-800/50 flex flex-col">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-lg font-medium text-slate-200 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-slate-400" />
                <span>Linked Versions</span>
                <span className="text-sm text-slate-400">({linkedVersions.length})</span>
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {linkedVersions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-slate-500" />
                  </div>
                  <p className="text-slate-400 text-sm">No versions use this type</p>
                  <p className="text-slate-500 text-xs mt-1">This type can be safely deleted</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {linkedVersions.map((version, index) => (
                    <div
                      key={`${version.literatureId}-${index}`}
                      className="p-3 bg-slate-700/30 border border-slate-600/30 rounded-lg hover:bg-slate-700/50 transition-colors"
                    >
                      <h4 className="text-slate-200 text-sm font-medium mb-1 line-clamp-2">
                        {version.literatureTitle}
                      </h4>
                      <div className="space-y-1 text-xs">
                        {version.versionTitle && (
                          <p className="text-slate-400 line-clamp-1">
                            Version: {version.versionTitle}
                          </p>
                        )}
                        {version.versionNumber && (
                          <p className="text-slate-500">
                            v{version.versionNumber}
                          </p>
                        )}
                        {version.editionNumber && (
                          <p className="text-slate-500">
                            Edition {version.editionNumber}
                          </p>
                        )}
                        {version.publishingDate && (
                          <p className="text-slate-500">
                            {new Date(version.publishingDate).getFullYear()}
                          </p>
                        )}
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
        message={`This version type is used by ${linkedVersions.length} version ${linkedVersions.length === 1 ? 'entry' : 'entries'}. Making these changes may affect existing data. Are you sure you want to continue?`}
        confirmText="Update Anyway"
        type="warning"
      />

      {/* Delete Warning Modal */}
      <WarningModal
        isOpen={showDeleteWarning}
        onClose={() => setShowDeleteWarning(false)}
        onConfirm={() => setShowDeleteWarning(false)}
        title="Cannot Delete Version Type"
        message={`This version type cannot be deleted because it's used by ${linkedVersions.length} version ${linkedVersions.length === 1 ? 'entry' : 'entries'}. Please delete all associated versions manually in the Literature Library before deleting this type.`}
        confirmText="Got It"
        type="danger"
      />
    </>
  );
};

export default VersionTypeEditModal;

// uploadWidgetModal.tsx

import React, { useState, useMemo } from "react";
import Modal from "./Modal";
import VersionForm from "./versionForm";
import LiteratureForm from "./literatureForm";
import LiteratureTypeCreationForm from "./literatureTypeCreationForm";
import VersionTypeCreationForm from "./versionTypeCreationForm";
import VersionTypeList from "./versionTypeList";
import { LiteratureExtended, LiteratureType } from "../../types/deepRecall/strapi/literatureTypes";
import { useLiterature, useLiteratureTypes, useVersionTypes } from "../../customHooks/useLiterature";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLiteratureType, createVersionType } from "../../api/literatureService";

interface UploadWidgetModalProps {
  className?: string;
}

type ModalType = 'none' | 'createVersionType' | 'createLiterature' | 'createVersion';

interface ModalState {
  type: ModalType;
  data?: {
    literatureType?: LiteratureType;
    literatureEntry?: LiteratureExtended;
    typeName?: string;
  };
}

const UploadWidgetModal: React.FC<UploadWidgetModalProps> = ({ className }) => {
  const {
    data: literatureTypes,
    isLoading: typesLoading,
    error: typesError,
  } = useLiteratureTypes();

  const {
    data: literatureData,
    isLoading: litLoading,
    error: litError,
  } = useLiterature();

  const {
    data: versionTypes,
    isLoading: versionLoading,
    error: versionError,
  } = useVersionTypes();

  const queryClient = useQueryClient();

  // Modal state
  const [modalState, setModalState] = useState<ModalState>({ type: 'none' });

  // Mutations
  const createTypeMutation = useMutation<
    LiteratureType,
    Error,
    Omit<LiteratureType, "documentId">
  >({
    mutationFn: createLiteratureType,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["literatureTypes"] }),
    onError: (error: Error) => {
      console.error("Failed to create literature type:", error);
    },
  });

  const createVersionTypeMutation = useMutation<
    any,
    Error,
    Omit<any, "documentId">
  >({
    mutationFn: createVersionType,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["versionTypes"] }),
    onError: (error: Error) => {
      console.error("Failed to create version type:", error);
    },
  });

  // Modal handlers
  const closeModal = () => setModalState({ type: 'none' });

  const handleCreateVersionType = () => {
    setModalState({ type: 'createVersionType' });
  };

  const handleCreateEntry = (typeName: string) => {
    const literatureType = literatureTypes?.find(type => type.name === typeName);
    if (literatureType) {
      setModalState({ 
        type: 'createLiterature', 
        data: { literatureType } 
      });
    }
  };

  // Form submission handlers
  const handleVersionTypeSubmit = (payload: { versionMetadata: string }) => {
    if (!modalState.data?.typeName) return;
    
    createVersionTypeMutation.mutate(
      { name: modalState.data.typeName, versionMetadata: payload.versionMetadata },
      {
        onSuccess: () => {
          closeModal();
        },
      }
    );
  };

  const handleLiteratureTypeSubmit = (payload: { name: string; typeMetadata: string }) => {
    createTypeMutation.mutate(payload, {
      onSuccess: () => {
        closeModal();
      },
    });
  };

  const handleLiteratureSubmit = () => {
    closeModal();
  };

  const handleVersionSubmit = () => {
    closeModal();
  };

  // Filter literature entries by type for version creation
  const getEntriesForType = (typeName: string) => {
    if (!literatureData) return [];
    return literatureData.filter(
      (lit: LiteratureExtended) => lit.type === typeName
    );
  };

  if (typesLoading || litLoading || versionLoading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-6">
          <div className="space-y-3">
            <div className="h-6 bg-slate-700 rounded w-1/4"></div>
            <div className="h-16 bg-slate-700 rounded"></div>
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-700 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (typesError || litError || versionError) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="bg-red-950/20 border border-red-900/20 rounded-xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <h3 className="text-red-400 font-semibold">Error Loading Data</h3>
          </div>
          <p className="text-red-300 mt-2">
            {(typesError as Error)?.message || 
             (litError as Error)?.message || 
             (versionError as Error)?.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`flex flex-col h-full ${className}`}>
        <VersionTypeList 
          onCreateVersionType={handleCreateVersionType}
          onCreateEntry={handleCreateEntry}
        />
      </div>

      {/* Version Type Creation Modal */}
      <Modal
        isOpen={modalState.type === 'createVersionType'}
        onClose={closeModal}
        title="Create New Version Type"
        size="md"
      >
        <LiteratureTypeCreationForm
          onSubmit={handleLiteratureTypeSubmit}
          onCancel={closeModal}
        />
      </Modal>

      {/* Literature Creation Modal */}
      <Modal
        isOpen={modalState.type === 'createLiterature'}
        onClose={closeModal}
        title={`Create New ${modalState.data?.literatureType?.name?.charAt(0).toUpperCase()}${modalState.data?.literatureType?.name?.slice(1)}`}
        size="lg"
      >
        {modalState.data?.literatureType && (
          <LiteratureForm
            literatureType={modalState.data.literatureType}
            onSuccess={handleLiteratureSubmit}
            onCancel={closeModal}
          />
        )}
      </Modal>

      {/* Version Creation Modal */}
      <Modal
        isOpen={modalState.type === 'createVersion'}
        onClose={closeModal}
        title={`Add Version to ${modalState.data?.literatureEntry?.title}`}
        size="xl"
      >
        {modalState.data?.literatureEntry && versionTypes && (
          <VersionForm
            versionType={versionTypes.find(vt => vt.name === modalState.data?.literatureEntry?.type)!}
            entry={modalState.data.literatureEntry}
            onSuccess={handleVersionSubmit}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </>
  );
};

export default UploadWidgetModal;

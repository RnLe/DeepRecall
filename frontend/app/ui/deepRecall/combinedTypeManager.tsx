import React, { useState } from "react";
import LiteratureTypeList from "./literatureTypeList";
import Modal from "./Modal";
import MergedLiteratureTypeCreationForm from "./mergedLiteratureTypeCreationForm";
import MergedLiteratureTypeEditModal from "./mergedLiteratureTypeEditModal";
import LiteratureForm from "./literatureForm";
import VersionForm from "./versionForm";
import { LiteratureExtended, LiteratureType } from "../../types/deepRecall/strapi/literatureTypes";
import { VersionType } from "../../types/deepRecall/strapi/versionTypes";
import { useLiterature, useLiteratureTypes, useVersionTypes } from "../../customHooks/useLiterature";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createMergedLiteratureType } from "../../api/literatureService";

interface CombinedTypeManagerProps {
  className?: string;
}

type ModalType = 'none' | 'createLiteratureType' | 'createLiterature' | 'createVersion';

interface ModalState {
  type: ModalType;
  data?: {
    literatureType?: LiteratureType;
    literatureEntry?: LiteratureExtended;
    versionType?: VersionType;
    typeName?: string;
  };
}

const CombinedTypeManager: React.FC<CombinedTypeManagerProps> = ({ className }) => {
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
  
  // Edit modals state
  const [editingLiteratureType, setEditingLiteratureType] = useState<LiteratureType | null>(null);

  // Mutations
  const createMergedLiteratureTypeMutation = useMutation<
    { literatureType: LiteratureType; versionType: VersionType },
    Error,
    {
      literatureType: Omit<LiteratureType, "documentId">;
      versionType: Omit<VersionType, "documentId">;
    }
  >({
    mutationFn: createMergedLiteratureType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["literatureTypes"] });
      queryClient.invalidateQueries({ queryKey: ["versionTypes"] });
    },
    onError: (error: Error) => {
      console.error("Failed to create merged literature type:", error);
    },
  });

  // Modal handlers
  const closeModal = () => {
    setModalState({ type: 'none' });
  };

  const handleCreateLiteratureType = () => {
    setModalState({ type: 'createLiteratureType' });
  };

  const handleCreateLiterature = (literatureType: LiteratureType) => {
    setModalState({
      type: 'createLiterature',
      data: { literatureType }
    });
  };

  const handleCreateVersion = (typeName: string) => {
    // Find a literature entry of this type to create a version for
    const literatureEntry = literatureData?.find(lit => lit.type === typeName);
    if (literatureEntry) {
      setModalState({
        type: 'createVersion',
        data: { literatureEntry }
      });
    }
  };

  // Form submission handlers
  const handleMergedLiteratureTypeSubmit = (payload: { 
    literatureType: { name: string; typeMetadata: string };
    versionType: { name: string; versionMetadata: string };
  }) => {
    createMergedLiteratureTypeMutation.mutate({
      literatureType: payload.literatureType,
      versionType: payload.versionType,
    }, {
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

  if (typesLoading || litLoading || versionLoading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-6">
          <div className="space-y-3">
            <div className="h-6 bg-slate-700 rounded w-1/3"></div>
            <div className="h-32 bg-slate-700 rounded-xl"></div>
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
            <h3 className="text-red-400 font-medium">Error Loading Data</h3>
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
        {/* Literature Types Section - Now the only section */}
        <div className="flex-1 min-h-0">
          <LiteratureTypeList 
            onCreateLiteratureType={handleCreateLiteratureType}
            onCreateLiterature={handleCreateLiterature}
            onEditLiteratureType={setEditingLiteratureType}
          />
        </div>
      </div>

      {/* Merged Literature Type Creation Modal */}
      <Modal
        isOpen={modalState.type === 'createLiteratureType'}
        onClose={closeModal}
        title="Create New Literature Type"
        size="xl"
      >
        <MergedLiteratureTypeCreationForm
          onSubmit={handleMergedLiteratureTypeSubmit}
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

      {/* Merged Literature Type Edit Modal */}
      {editingLiteratureType && (
        <MergedLiteratureTypeEditModal
          literatureType={editingLiteratureType}
          isOpen={true}
          onClose={() => setEditingLiteratureType(null)}
        />
      )}
    </>
  );
};

export default CombinedTypeManager;

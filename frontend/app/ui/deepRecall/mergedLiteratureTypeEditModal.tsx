// mergedLiteratureTypeEditModal.tsx

import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateLiteratureType, updateVersionType } from "../../api/literatureService";
import { LiteratureType } from "../../types/deepRecall/strapi/literatureTypes";
import { VersionType } from "../../types/deepRecall/strapi/versionTypes";
import { useVersionTypes } from "../../customHooks/useLiterature";
import Modal from "./Modal";
import MergedLiteratureTypeCreationForm from "./mergedLiteratureTypeCreationForm";

interface MergedLiteratureTypeEditModalProps {
  literatureType: LiteratureType;
  isOpen: boolean;
  onClose: () => void;
}

const MergedLiteratureTypeEditModal: React.FC<MergedLiteratureTypeEditModalProps> = ({
  literatureType,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const { data: versionTypes } = useVersionTypes();

  // Find the corresponding version type
  const correspondingVersionType = versionTypes?.find(vt => vt.name === literatureType.name);

  const updateLiteratureTypeMutation = useMutation<
    LiteratureType,
    Error,
    { id: string; data: Partial<LiteratureType> }
  >({
    mutationFn: ({ id, data }) => updateLiteratureType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["literatureTypes"] });
    },
  });

  const updateVersionTypeMutation = useMutation<
    VersionType,
    Error,
    { id: string; data: Partial<VersionType> }
  >({
    mutationFn: ({ id, data }) => updateVersionType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["versionTypes"] });
    },
  });

  const handleSubmit = async (payload: { 
    literatureType: { name: string; typeMetadata: string };
    versionType: { name: string; versionMetadata: string };
  }) => {
    try {
      // Update literature type
      await updateLiteratureTypeMutation.mutateAsync({
        id: literatureType.documentId!,
        data: {
          name: payload.literatureType.name,
          typeMetadata: payload.literatureType.typeMetadata,
        },
      });

      // Update or create version type
      if (correspondingVersionType) {
        await updateVersionTypeMutation.mutateAsync({
          id: correspondingVersionType.documentId!,
          data: {
            name: payload.versionType.name,
            versionMetadata: payload.versionType.versionMetadata,
          },
        });
      }

      onClose();
    } catch (error) {
      console.error("Failed to update types:", error);
    }
  };

  const initialData = {
    literatureType: {
      name: literatureType.name,
      typeMetadata: literatureType.typeMetadata,
    },
    versionType: correspondingVersionType ? {
      name: correspondingVersionType.name,
      versionMetadata: correspondingVersionType.versionMetadata,
    } : undefined,
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit ${literatureType.name?.charAt(0).toUpperCase()}${literatureType.name?.slice(1)} Type`}
      size="xl"
    >
      <MergedLiteratureTypeCreationForm
        onSubmit={handleSubmit}
        onCancel={onClose}
        initialData={initialData}
        isEditing={true}
      />
    </Modal>
  );
};

export default MergedLiteratureTypeEditModal;

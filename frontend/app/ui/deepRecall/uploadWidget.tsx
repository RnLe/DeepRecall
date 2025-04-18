// uploadWidget.tsx

import React, { useState, useMemo } from "react";
import VersionForm from "./versionForm";
import LiteratureForm from "./literatureForm";
import LiteratureTypeCreationForm from "./literatureTypeCreationForm";
import VersionTypeCreationForm from "./versionTypeCreationForm";
import { LiteratureExtended, LiteratureType } from "../../types/literatureTypes";
import { useLiterature, useLiteratureTypes, useVersionTypes } from "../../customHooks/useLiterature";
import LiteratureCardL from "./literatureCardL";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLiteratureType, createVersionType, updateLiteratureType } from "../../api/literatureService";
import VersionTypeList from "./versionTypeList";

interface UploadWidgetProps {
  className?: string;
}

const UploadWidget: React.FC<UploadWidgetProps> = ({ className }) => {
  // Fetch literature types, literature and version types items from API.
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

  // Mutation for creating a new literature type.
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

  // Mutation for creating a new version type.
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

  const [selectedType, setSelectedType] = useState<LiteratureType | null>(null);
  const [pendingVersionType, setPendingVersionType] = useState<LiteratureType | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<LiteratureExtended | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [formsVisible, setFormsVisible] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  
  const [showTypeCreationModal, setShowTypeCreationModal] = useState<boolean>(false);
  // New state for version type creation modal.
  const [showVersionTypeCreationModal, setShowVersionTypeCreationModal] = useState<boolean>(false);

  // When a literature type card is clicked, select if it has versionType
  const handleTypeClick = (type: LiteratureType) => {
    // Iterate through versionTypes to check if the type has a versionType
    const hasVersion = versionTypes?.some((vt) => vt.name === type.name);
    if (!hasVersion) return;
    setSelectedType(type);
    setFormsVisible(false);
    setSelectedEntry(null);
  };

  // Filter literature entries by selected literature type.
  const entries = useMemo(() => {
    if (!literatureData || !selectedType) return [];
    return literatureData.filter(
      (lit: LiteratureExtended) => lit.type === selectedType.name
    );
  }, [literatureData, selectedType]);

  const handleEntryClick = (entry: LiteratureExtended) => {
    setSelectedEntry(entry);
    setIsCreatingNew(false);
    setFormsVisible(true);
  };

  const handleCreateNewClick = () => {
    setSelectedEntry(null);
    setIsCreatingNew(true);
    setFormsVisible(true);
  };

  const handleCreateType = (payload: { name: string; typeMetadata: string }) => {
    createTypeMutation.mutate(payload, {
      onSuccess: () => {
        setShowTypeCreationModal(false);
      },
    });
  };

  // Handler for creating a new version type.
  const handleCreateVersionType = (payload: { versionMetadata: string }) => {
    if (!pendingVersionType) return;
    createVersionTypeMutation.mutate(
      { name: pendingVersionType.name, versionMetadata: payload.versionMetadata },
      {
        onSuccess: async () => {
          // Select this type and clear pending
          setSelectedType(pendingVersionType);
          setPendingVersionType(null);
          setShowVersionTypeCreationModal(false);
        },
      }
    );
  };

  return (
    <div className={`p-4 bg-gray-800 text-white ${className}`}>
      {/* Literature Types Grid */}
      {typesLoading ? (
        <p>Loading literature types...</p>
      ) : typesError ? (
        <p className="text-red-500">Error loading literature types.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {literatureTypes?.map((type: LiteratureType) => {
            const hasVersion = versionTypes?.some(vt => vt.name === type.name);
            return (
              <div
                key={type.documentId}
                className={`cursor-pointer border text-3xl rounded-lg p-4 text-center hover:shadow-md transition-shadow bg-gray-700 text-white ${
                  selectedType?.documentId === type.documentId ? "ring-4 ring-blue-500" : ""
                }`}
                onClick={() => {
                  if (!hasVersion) {
                    setPendingVersionType(type);
                    setShowVersionTypeCreationModal(true);
                  } else {
                    handleTypeClick(type);
                  }
                }}
              >
                {type.name.charAt(0).toUpperCase() + type.name.slice(1)}
                {!hasVersion && (
                  <p className="text-orange-300 mt-2 text-sm">Version type missing. Click to add.</p>
                )}
              </div>
            );
          })}
          {/* Extra card: Plus sign for creating new literature type */}
          <div
            className="cursor-pointer border-2 border-dashed border-gray-400 rounded-lg p-4 text-center hover:shadow-md transition-shadow bg-gray-700 text-white flex items-center justify-center"
            onClick={() => setShowTypeCreationModal(true)}
          >
            <span className="text-4xl">+</span>
          </div>
        </div>
      )}

      {error && <p className="text-red-500">{error}</p>}

      {selectedType && (
        <div className="flex gap-4 mt-4">
          <div className="w-1/2 border-r border-gray-600 pr-2">
            <h3 className="text-lg font-semibold mb-2">
              Existing{" "}
              {selectedType.name.charAt(0).toUpperCase() + selectedType.name.slice(1) + ` (${entries.length})`}
            </h3>
            {litLoading ? (
              <p>Loading entries...</p>
            ) : litError ? (
              <p className="text-red-500">Error loading literature entries.</p>
            ) : (
              <div className="space-y-4">
                {entries.length > 0 ? (
                  entries.map((entry: LiteratureExtended) => (
                    <div key={entry.documentId} onClick={() => handleEntryClick(entry)} className="cursor-pointer">
                      <LiteratureCardL
                        literature={entry}
                        className={selectedEntry && selectedEntry.documentId === entry.documentId ? "bg-gray-700" : ""}
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400">No entries available.</p>
                )}
                <button onClick={handleCreateNewClick} className="mt-4 w-full bg-blue-500 text-white py-2 rounded">
                  Create New {selectedType.name}
                </button>
              </div>
            )}
          </div>
          <div className="w-1/2 pl-2">
            {formsVisible &&
              (selectedEntry ? (
                <VersionForm
                  versionType={
                    versionTypes?.find(vt => vt.name === selectedType.name)!
                  }
                  entry={selectedEntry!}
                  onSuccess={() => setFormsVisible(false)}
                />
              ) : (
                <LiteratureForm literatureType={selectedType} onSuccess={() => setFormsVisible(false)} />
              ))}
          </div>
        </div>
      )}

      {/* Modal for creating a new literature type */}
      {showTypeCreationModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowTypeCreationModal(false)}
        >
          <div className="bg-gray-800 p-6 rounded shadow-lg max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <LiteratureTypeCreationForm onSubmit={handleCreateType} className="mb-4" />
            <button onClick={() => setShowTypeCreationModal(false)} className="mt-4 bg-red-500 text-white px-4 py-2 rounded w-full">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Modal for creating a new version type */}
      {showVersionTypeCreationModal && pendingVersionType && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowVersionTypeCreationModal(false)}
        >
          <div className="bg-gray-800 p-6 rounded shadow-lg max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <VersionTypeCreationForm literatureTypeName={pendingVersionType.name} onSubmit={handleCreateVersionType} className="mb-4" />
            <button onClick={() => setShowVersionTypeCreationModal(false)} className="mt-4 bg-red-500 text-white px-4 py-2 rounded w-full">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadWidget;

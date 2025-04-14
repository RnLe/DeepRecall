// uploadWidget.tsx

import React, { useState, useMemo } from "react";
import VersionForm from "./versionForm";
import LiteratureForm from "./literatureForm";
import LiteratureTypeCreationForm from "./literatureTypeCreationForm";
import { LiteratureExtended, LiteratureType } from "../../helpers/literatureTypes";
import { useLiterature, useLiteratureTypes } from "../../customHooks/useLiterature";
import LiteratureCardL from "./literatureCardL";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLiteratureType } from "../../api/literatureService";

interface UploadWidgetProps {
  className?: string;
}

const UploadWidget: React.FC<UploadWidgetProps> = ({ className }) => {
  // Fetch literature types and literature items from API.
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

  const queryClient = useQueryClient();

  // Mutation for creating a new literature type.
  const createTypeMutation = useMutation<
  LiteratureType,                   // The type returned on success.
  Error,                            // The error type.
  Omit<LiteratureType, "documentId">, // The variables (payload) type.
  unknown                           // Optional context type.
  >({
    mutationFn: createLiteratureType,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["literatureTypes"] }),
    onError: (error: Error) => {
      console.error("Failed to create literature type:", error);
    },
  });

  

  // Selected literature type (from dynamic API data).
  const [selectedType, setSelectedType] = useState<LiteratureType | null>(null);
  // Selected literature entry (when a user wants to add a new version).
  const [selectedEntry, setSelectedEntry] = useState<LiteratureExtended | null>(null);
  // Flag for new literature creation (no entry selected in that case).
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  // Toggle for showing/hiding the form area.
  const [formsVisible, setFormsVisible] = useState<boolean>(false);
  // Local error state (if needed).
  const [error, setError] = useState<string>("");

  // State for showing the literature type creation modal.
  const [showTypeCreationModal, setShowTypeCreationModal] = useState<boolean>(false);

  // Helper functions to show or hide the main form area.
  const handleFormVisibility = () => setFormsVisible(true);
  const handleFormInvisibility = () => setFormsVisible(false);

  // When a literature type card is clicked, update the selected type and clear any previous selection.
  const handleTypeClick = (type: LiteratureType) => {
    setSelectedType(type);
    setFormsVisible(false);
    setSelectedEntry(null);
  };

  // Filter literature entries by comparing their "type" property to the selected type's name.
  const entries = useMemo(() => {
    if (!literatureData || !selectedType) return [];
    return literatureData.filter(
      (lit: LiteratureExtended) => lit.type === selectedType.name
    );
  }, [literatureData, selectedType]);

  // When a literature entry is clicked, set it for creating a new version and show the VersionForm.
  const handleEntryClick = (entry: LiteratureExtended) => {
    setSelectedEntry(entry);
    setIsCreatingNew(false);
    setFormsVisible(true);
  };

  // When "Create New" is clicked, clear selection and show the LiteratureForm.
  const handleCreateNewClick = () => {
    setSelectedEntry(null);
    setIsCreatingNew(true);
    setFormsVisible(true);
  };

  // Handler for creating a new literature type from the modal form.
  const handleCreateType = (payload: { name: string; typeMetadata: string }) => {
    createTypeMutation.mutate(payload, {
      onSuccess: () => {
        setShowTypeCreationModal(false);
      },
    });
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
          {literatureTypes?.map((type: LiteratureType) => (
            <div
              key={type.documentId}
              className={`cursor-pointer border rounded-lg p-4 text-center hover:shadow-md transition-shadow ${
                selectedType && selectedType.documentId === type.documentId ? "ring-4 ring-blue-500" : ""
              } bg-gray-700 text-white`}
              onClick={() => handleTypeClick(type)}
            >
              {type.name.charAt(0).toUpperCase() + type.name.slice(1)}
            </div>
          ))}
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

      {/* Show literature entries and corresponding forms when a type is selected */}
      {selectedType && (
        <div className="flex gap-4 mt-4">
          {/* Left: List of existing literature entries and a "Create New" button */}
          <div className="w-1/2 border-r border-gray-600 pr-2">
            <h3 className="text-lg font-semibold mb-2">
              Existing{" "}
              {selectedType.name.charAt(0).toUpperCase() +
                selectedType.name.slice(1) +
                ` (${entries.length})`}
            </h3>
            {litLoading ? (
              <p>Loading entries...</p>
            ) : litError ? (
              <p className="text-red-500">Error loading literature entries.</p>
            ) : (
              <div className="space-y-4">
                {entries.length > 0 ? (
                  entries.map((entry: LiteratureExtended) => (
                    <div
                      key={entry.documentId}
                      onClick={() => handleEntryClick(entry)}
                      className="cursor-pointer"
                    >
                      <LiteratureCardL
                        literature={entry}
                        className={
                          selectedEntry && selectedEntry.documentId === entry.documentId
                            ? "bg-gray-700"
                            : ""
                        }
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400">No entries available.</p>
                )}
                <button
                  onClick={handleCreateNewClick}
                  className="mt-4 w-full bg-blue-500 text-white py-2 rounded"
                >
                  Create New {selectedType.name}
                </button>
              </div>
            )}
          </div>

          {/* Right: Form area; either for new literature or new version */}
          <div className="w-1/2 pl-2">
            {formsVisible &&
              (selectedEntry ? (
                <VersionForm
                  literatureType={selectedType}
                  entry={selectedEntry}
                  onSuccess={handleFormInvisibility}
                />
              ) : (
                <LiteratureForm
                  literatureType={selectedType}
                  onSuccess={handleFormInvisibility}
                />
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
          <div
            className="bg-gray-800 p-6 rounded shadow-lg max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <LiteratureTypeCreationForm
              onSubmit={handleCreateType}
              className="mb-4"
            />
            <button
              onClick={() => setShowTypeCreationModal(false)}
              className="mt-4 bg-red-500 text-white px-4 py-2 rounded w-full"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadWidget;

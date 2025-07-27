// uploadWidget.tsx

import React, { useState, useMemo } from "react";
import VersionForm from "./versionForm";
import LiteratureForm from "./literatureForm";
import LiteratureTypeCreationForm from "./literatureTypeCreationForm";
import VersionTypeCreationForm from "./versionTypeCreationForm";
import LiteratureTypeEditModal from "./literatureTypeEditModal";
import VersionTypeEditModal from "./versionTypeEditModal";
import { LiteratureExtended, LiteratureType } from "../../types/deepRecall/strapi/literatureTypes";
import { VersionType } from "../../types/deepRecall/strapi/versionTypes";
import { useLiterature, useLiteratureTypes, useVersionTypes } from "../../customHooks/useLiterature";
import LiteratureCardL from "./literatureCardL";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLiteratureType, createVersionType, updateLiteratureType } from "../../api/literatureService";
import VersionTypeList from "./versionTypeList";
import { 
  BookOpen, 
  FileText, 
  Microscope, 
  GraduationCap, 
  Presentation, 
  FileSearch, 
  Bookmark 
} from 'lucide-react';

interface UploadWidgetProps {
  className?: string;
}

// Helper function to get icon component from icon name
const getIconComponent = (iconName: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    'book-open': <BookOpen className="w-8 h-8" />,
    'file-text': <FileText className="w-8 h-8" />,
    'microscope': <Microscope className="w-8 h-8" />,
    'graduation-cap': <GraduationCap className="w-8 h-8" />,
    'presentation': <Presentation className="w-8 h-8" />,
    'file-search': <FileSearch className="w-8 h-8" />,
    'bookmark': <Bookmark className="w-8 h-8" />,
  };
  return iconMap[iconName] || <BookOpen className="w-8 h-8" />;
};

// Helper function to parse literature type metadata
const parseLiteratureTypeMetadata = (typeMetadata: string) => {
  try {
    return JSON.parse(typeMetadata);
  } catch {
    return { icon: 'book-open' };
  }
};

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
  
  // Edit modals state
  const [editingLiteratureType, setEditingLiteratureType] = useState<LiteratureType | null>(null);
  const [editingVersionType, setEditingVersionType] = useState<VersionType | null>(null);

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
  const handleCreateVersionType = (payload: { name: string; versionMetadata: string }) => {
    createVersionTypeMutation.mutate(
      { name: payload.name, versionMetadata: payload.versionMetadata },
      {
        onSuccess: async () => {
          // Select this type and clear pending
          setShowVersionTypeCreationModal(false);
          setPendingVersionType(null);
        },
      }
    );
  };

  return (
    <div className={`p-4 bg-slate-800 text-white ${className}`}>
      {/* Literature Types Grid */}
      {typesLoading ? (
        <p>Loading literature types...</p>
      ) : typesError ? (
        <p className="text-red-500">Error loading literature types.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {literatureTypes?.map((type: LiteratureType) => {
            const hasVersion = versionTypes?.some(vt => vt.name === type.name);
            const metadata = parseLiteratureTypeMetadata(type.typeMetadata);
            const iconComponent = getIconComponent(metadata.icon || 'book-open');
            
            return (
              <div
                key={type.documentId}
                className={`relative border rounded-lg p-4 text-center hover:shadow-md transition-shadow bg-slate-700 text-white hover:bg-slate-600 ${
                  selectedType?.documentId === type.documentId ? "ring-4 ring-blue-500" : ""
                }`}
              >
                {/* Edit button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingLiteratureType(type);
                  }}
                  className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-600 rounded transition-colors"
                  title="Edit Literature Type"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                
                {/* Main card content */}
                <div
                  className="cursor-pointer"
                  onClick={() => {
                    if (!hasVersion) {
                      setPendingVersionType(type);
                      setShowVersionTypeCreationModal(true);
                    } else {
                      handleTypeClick(type);
                    }
                  }}
                >
                  <div className="flex flex-col items-center space-y-2">
                    {iconComponent}
                    <span className="text-lg font-medium">
                      {type.name.charAt(0).toUpperCase() + type.name.slice(1)}
                    </span>
                    {!hasVersion && (
                      <p className="text-orange-300 text-sm">Version type missing. Click to add.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {/* Extra card: Plus sign for creating new literature type */}
          <div
            className="cursor-pointer border-2 border-dashed border-slate-400 rounded-lg p-4 text-center hover:shadow-md transition-shadow bg-slate-700 text-white hover:bg-slate-600 flex items-center justify-center"
            onClick={() => setShowTypeCreationModal(true)}
          >
            <span className="text-4xl">+</span>
          </div>
        </div>
      )}

      {error && <p className="text-red-500">{error}</p>}

      {selectedType && (
        <div className="flex gap-4 mt-4">
          <div className="w-1/2 border-r border-slate-600 pr-2">
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
                    <div 
                      key={entry.documentId} 
                      className="relative group"
                    >
                      {/* Edit button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // For now, we'll handle editing in the forms section
                          setSelectedEntry(entry);
                          setIsCreatingNew(false);
                          setFormsVisible(true);
                        }}
                        className="absolute top-2 right-2 z-10 p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-600 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Edit Literature Entry"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      
                      {/* Literature card */}
                      <div onClick={() => handleEntryClick(entry)} className="cursor-pointer">
                        <LiteratureCardL
                          literature={entry}
                          className={selectedEntry && selectedEntry.documentId === entry.documentId ? "bg-slate-700" : ""}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400">No entries available.</p>
                )}
                <button onClick={handleCreateNewClick} className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded transition-colors">
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
          <div className="bg-slate-800 p-6 rounded shadow-lg max-w-6xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <LiteratureTypeCreationForm 
              onSubmit={handleCreateType} 
              onCancel={() => setShowTypeCreationModal(false)}
              className="mb-4" 
            />
          </div>
        </div>
      )}

      {/* Modal for creating a new version type */}
      {showVersionTypeCreationModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowVersionTypeCreationModal(false)}
        >
          <div className="bg-slate-800 p-6 rounded shadow-lg max-w-7xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <VersionTypeCreationForm 
              onSubmit={handleCreateVersionType} 
              onCancel={() => setShowVersionTypeCreationModal(false)}
              className="mb-4" 
            />
          </div>
        </div>
      )}

      {/* Version Types Management Section */}
      {versionTypes && versionTypes.length > 0 && (
        <div className="mt-8 border-t border-slate-600 pt-6">
          <h3 className="text-lg font-semibold mb-4 text-white">Version Types</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {versionTypes.map((versionType: VersionType) => (
              <div
                key={versionType.documentId}
                className="relative border rounded-lg p-4 text-center bg-slate-700 text-white hover:bg-slate-600 transition-colors"
              >
                {/* Edit button */}
                <button
                  onClick={() => setEditingVersionType(versionType)}
                  className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-600 rounded transition-colors"
                  title="Edit Version Type"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-8 h-8 bg-slate-500 rounded flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-lg font-medium">
                    {versionType.name.charAt(0).toUpperCase() + versionType.name.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Literature Type Edit Modal */}
      {editingLiteratureType && (
        <LiteratureTypeEditModal
          literatureType={editingLiteratureType}
          isOpen={!!editingLiteratureType}
          onClose={() => setEditingLiteratureType(null)}
        />
      )}

      {/* Version Type Edit Modal */}
      {editingVersionType && (
        <VersionTypeEditModal
          versionType={editingVersionType}
          isOpen={!!editingVersionType}
          onClose={() => setEditingVersionType(null)}
        />
      )}
    </div>
  );
};

export default UploadWidget;

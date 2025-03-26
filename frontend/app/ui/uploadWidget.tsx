// uploadWidget.tsx
import React, { useState, useRef, useMemo } from "react";
import VersionForm from "./versionForm";
import LiteratureForm from "./literatureForm";
import { LITERATURE_TYPES, LiteratureType, MediaFile } from "../helpers/literatureTypes";
import { useLiterature } from "../customHooks/useLiterature";
import LiteratureCardL from "./literatureCardL";
import LiteratureBannerCard from "./literatureBannerCard";

export interface LiteratureItem {
  documentId: string;
  title: string;
  subtitle?: string;
  type: LiteratureType;
  createdAt?: string;
  updatedAt?: string;
  metadata: any; // Unified metadata containing version info
  authors?: any[];  // Array of Author objects
  // Removed files field since media is now stored in versions.
}

interface UploadWidgetProps {
  className?: string;
}

const UploadWidget: React.FC<UploadWidgetProps> = ({ className }) => {
  // State for the selected literature type (set via banners)
  const [selectedType, setSelectedType] = useState<LiteratureType | "">("");
  // State for file validation errors
  const [error, setError] = useState<string>("");
  // State for selected literature entry (if adding a new version)
  const [selectedEntry, setSelectedEntry] = useState<LiteratureItem | null>(null);
  // State to toggle new literature creation form
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  // Reference to the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);
  // State for form visibility
  const [formsVisible, setFormVisibility] = useState<boolean>(false);

  // Fetch existing literature data
  const { data, isLoading, error: fetchError } = useLiterature();

  // Show or hide the form
  const handleFormVisibility = () => setFormVisibility(true);
  const handleFormInvisibility = () => setFormVisibility(false);

  // Map fetched data into unified LiteratureItem objects
  const entries: LiteratureItem[] = useMemo(() => {
    if (!data || !selectedType) return [];
    switch (selectedType) {
      case "Textbook": {
        const textbooks = Array.isArray(data.textbooks) ? data.textbooks : [];
        return textbooks.map((tb: any) => ({
          documentId: tb.documentId,
          title: tb.title || "Untitled Textbook",
          subtitle: tb.type_metadata?.subtitle,
          type: "Textbook" as LiteratureType,
          createdAt: tb.createdAt,
          updatedAt: tb.updatedAt,
          metadata: tb.type_metadata,
          authors: tb.authors,
        }));
      }
      case "Paper": {
        const papers = Array.isArray(data.papers) ? data.papers : [];
        return papers.map((p: any) => ({
          documentId: p.documentId,
          title: p.title || "Untitled Paper",
          subtitle: p.type_metadata?.subtitle,
          type: "Paper" as LiteratureType,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          metadata: p.type_metadata,
          authors: p.authors,
        }));
      }
      case "Script": {
        const scripts = Array.isArray(data.scripts) ? data.scripts : [];
        return scripts.map((s: any) => ({
          documentId: s.documentId,
          title: s.title || "Untitled Script",
          subtitle: s.type_metadata?.subtitle,
          type: "Script" as LiteratureType,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          metadata: s.type_metadata,
          authors: s.authors,
        }));
      }
      case "Thesis": {
        const theses = Array.isArray(data.theses) ? data.theses : [];
        return theses.map((t: any) => ({
          documentId: t.documentId,
          title: t.title || "Untitled Thesis",
          subtitle: t.type_metadata?.subtitle,
          type: "Thesis" as LiteratureType,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          metadata: t.type_metadata,
          authors: t.authors,
        }));
      }
      default:
        return [];
    }
  }, [data, selectedType]);

  // Handle clicking on an existing literature entry
  const handleEntryClick = (entry: LiteratureItem) => {
    setSelectedEntry(entry);
    setIsCreatingNew(false);
    setFormVisibility(true);
  };

  // Handle clicking the "Create New" button
  const handleCreateNewClick = () => {
    setSelectedEntry(null);
    setIsCreatingNew(true);
    setFormVisibility(true);
  };

  return (
    <div className={`p-4 ${className}`}>
      <h2 className="text-xl font-semibold mb-4">Upload New PDF</h2>

      {/* Banner container replacing the dropdown */}
      <div className="flex gap-4 mb-4">
        {LITERATURE_TYPES.map((type) => (
          <LiteratureBannerCard 
            key={type}
            type={type}
            className={`flex-1 ${selectedType === type ? 'ring-4 ring-blue-500' : ''}`}
            onClick={() => {
              setSelectedType(type);
              setFormVisibility(false);
            }}
          />
        ))}
      </div>

      {error && <p className="text-red-500">{error}</p>}

      {/* Literature entries and forms */}
      {selectedType && (
        <div className="flex gap-4 mt-4">
          {/* Left side: List of existing entries and "Create New" button */}
          <div className="w-1/2 border-r border-gray-300 pr-2">
            <h3 className="text-lg font-semibold mb-2">Existing {selectedType}s</h3>
            {isLoading ? (
              <p>Loading...</p>
            ) : fetchError ? (
              <p className="text-red-500">Error loading entries</p>
            ) : (
              <div className="space-y-4">
                {entries.length > 0 ? (
                  entries.map((entry) => (
                    <div 
                      key={entry.documentId} 
                      onClick={() => handleEntryClick(entry)} 
                      className="cursor-pointer"
                    >
                      <LiteratureCardL
                        {...entry}
                        className={selectedEntry?.documentId === entry.documentId ? 'bg-gray-300' : ''}
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No entries available.</p>
                )}
                <button 
                  onClick={handleCreateNewClick} 
                  className="mt-4 w-full bg-blue-500 text-white py-2 rounded"
                >
                  Create New {selectedType}
                </button>
              </div>
            )}
          </div>
          
          {/* Right side: Form area */}
          <div className="w-1/2 pl-2">
            {formsVisible && (
              selectedEntry ? (
                <VersionForm 
                  mediaType={selectedType as LiteratureType} 
                  entry={selectedEntry}
                />
              ) : (
                <LiteratureForm 
                  mediaType={selectedType as LiteratureType} 
                  onSuccess={handleFormInvisibility} 
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadWidget;

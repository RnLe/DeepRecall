// uploadWidget.tsx
import React, { useState, useRef, useMemo, useEffect } from "react";
import VersionForm from "./versionForm";
import LiteratureForm from "./literatureForm";
import { MEDIA_TYPES, MediaType } from "../helpers/mediaTypes";
import { useLiterature } from "../customHooks/useLiterature";
import LiteratureCardL from "./literatureCardL";

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface UploadWidgetProps {
  className?: string;
}

const getPDFPageCount = async (file: File): Promise<number> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return pdf.numPages;
};


const UploadWidget: React.FC<UploadWidgetProps> = ({ className }) => {
  // State for selected media type
  const [selectedType, setSelectedType] = useState<MediaType | "">("");
  // State for selected file
  const [file, setFile] = useState<File | null>(null);
  // State for file errors
  const [error, setError] = useState<string>("");
  // State for selected existing entry for new version
  const [selectedEntry, setSelectedEntry] = useState<{ id: number; title: string; type: MediaType } | null>(null);
  // State for toggling new literature creation form
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Additional state: page count of the PDF
  const [pageCount, setPageCount] = useState<number | null>(null);

  // Fetch existing literature data
  const { data, isLoading, error: fetchError } = useLiterature();

  // Memoized list of entries for the selected media type
  const entries = useMemo(() => {
    if (!data || !selectedType) return [];
    switch (selectedType) {
      case "Textbook":
        return data.textbooks.map(tb => ({ id: tb.id, title: tb.title || "Untitled Textbook", type: "Textbook" as MediaType }));
      case "Paper":
        return data.papers.map(p => ({ id: p.id, title: p.title || "Untitled Paper", type: "Paper" as MediaType }));
      case "Script":
        return data.scripts.map(s => ({ id: s.id, title: s.title || "Untitled Script", type: "Script" as MediaType }));
      default:
        return [];
    }
  }, [data, selectedType]);

  // Validate file type (only PDF allowed)
  const validateFile = (f: File) => {
    if (f.type !== "application/pdf") {
      setError("Only PDF files allowed");
      setFile(null);
    } else {
      setError("");
      setFile(f);
    }
  };

  // Handle file drop event
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    validateFile(e.dataTransfer.files[0]);
  };

  // Handle file selection from input
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      validateFile(e.target.files[0]);
    }
  };

   // When a file is selected, extract its page count
   useEffect(() => {
    if (file) {
      const getPDFPageCount = async (file: File): Promise<number> => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        return pdf.numPages;
      };
      getPDFPageCount(file)
        .then((count) => setPageCount(count))
        .catch((err) => {
          console.error("Error getting page count", err);
          setPageCount(null);
        });
    } else {
      setPageCount(null);
    }
  }, [file]);

  // Handle clicking an existing entry from the list
  const handleEntryClick = (entry: { id: number; title: string; type: MediaType }) => {
    setSelectedEntry(entry);
    setIsCreatingNew(false);
  };

  // Handle clicking the "Create New" button
  const handleCreateNewClick = () => {
    setSelectedEntry(null);
    setIsCreatingNew(true);
  };

  return (
    <div className={`p-4 ${className}`}>
      <h2 className="text-xl font-semibold mb-4">Upload New PDF</h2>
      <div 
        className="border-2 border-dashed border-gray-400 p-8 text-center cursor-pointer mb-4" 
        onDragOver={e => e.preventDefault()} 
        onDrop={handleDrop} 
        onClick={() => fileInputRef.current?.click()}
      >
        {file 
          ? `${file.name} (${(file.size / 1024).toFixed(2)} KB${pageCount ? `, ${pageCount} pages` : ""})`
          : "Drag & drop a PDF here or click to select"
        }
        <input type="file" accept=".pdf" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
      </div>
      {error && <p className="text-red-500">{error}</p>}
      {file && (
        <label className="block mb-2">
          Select Type:
          <select 
            value={selectedType} 
            onChange={e => {
              setSelectedType(e.target.value as MediaType);
              setSelectedEntry(null);
              setIsCreatingNew(false);
            }} 
            className="ml-2 border border-gray-300 p-1 w-40"
          >
            <option value="">— choose —</option>
            {MEDIA_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
      )}

      {selectedType && (
        <div className="flex gap-4 mt-4">
          {/* Left side: list of existing entries and "Create New" button */}
          <div className="w-1/2 border-r border-gray-300 pr-2">
            <h3 className="text-lg font-semibold mb-2">Existing {selectedType}s</h3>
            {isLoading ? (
              <p>Loading...</p>
            ) : fetchError ? (
              <p className="text-red-500">Error loading entries</p>
            ) : (
              <div className="space-y-4">
                {entries.length > 0 ? (
                  entries.map(entry => (
                    <div 
                      key={entry.id} 
                      onClick={() => handleEntryClick(entry)} 
                      className="cursor-pointer"
                    >
                      <LiteratureCardL
                        title={entry.title}
                        authors={[]}
                        editionOrVersion={undefined}
                        year={undefined}
                        uploadedDate={new Date().toISOString()}
                        className={selectedEntry?.id === entry.id ? 'bg-gray-300' : ''}
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No entries available.</p>
                )}
                {/* "Create New" button to open LiteratureForm */}
                <button 
                  onClick={handleCreateNewClick} 
                  className="mt-4 w-full bg-blue-500 text-white py-2 rounded"
                >
                  Create New {selectedType}
                </button>
              </div>
            )}
          </div>
          {/* Right side: form area */}
          <div className="w-1/2 pl-2">
            {isCreatingNew ? (
              // Render LiteratureForm for new literature creation
              <LiteratureForm mediaType={selectedType as MediaType} />
            ) : selectedEntry && file ? (
              // Render VersionForm to add a new version to an existing entry
              <VersionForm mediaType={selectedType as MediaType} entry={selectedEntry} file={file} />
            ) : (
              <p>Select an entry to create a new version or click "Create New" to add a new {selectedType}.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadWidget;

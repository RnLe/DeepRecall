// uploadWidget.tsx
import React, { useState, useRef, useMemo, useEffect } from "react";
import VersionForm from "./versionForm";
import LiteratureForm from "./literatureForm";
import { MEDIA_TYPES, MediaType } from "../helpers/mediaTypes";
import { useLiterature } from "../customHooks/useLiterature";
import LiteratureCardL from "./literatureCardL";
import { renderPdfPageToImage, dataURLtoFile } from "../helpers/pdfThumbnail";
import LiteratureBannerCard from "./literatureBannerCard";

import * as pdfjsLib from 'pdfjs-dist/webpack.mjs';

interface UploadWidgetProps {
  className?: string;
}

const UploadWidget: React.FC<UploadWidgetProps> = ({ className }) => {
  // State for the selected literature type (set via banners)
  const [selectedType, setSelectedType] = useState<MediaType | "">("");
  // State for the selected PDF file
  const [file, setFile] = useState<File | null>(null);
  // State for file validation errors
  const [error, setError] = useState<string>("");
  // State for selected literature entry (if adding a new version)
  const [selectedEntry, setSelectedEntry] = useState<{ id: number; title: string; type: MediaType } | null>(null);
  // State to toggle new literature creation form
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  // Reference to the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Additional state: PDF page count
  const [pageCount, setPageCount] = useState<number | null>(null);
  // State for generated thumbnail URL
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  // State for the thumbnail file
  const [thumbnail, setThumbnail] = useState<File | null>(null);

  // Fetch existing literature data
  const { data, isLoading, error: fetchError } = useLiterature();

  // Memoized list of literature entries for the selected type
  const entries = useMemo(() => {
    if (!data || !selectedType) return [];
    switch (selectedType) {
      case "Textbook":
        return data.textbooks.map(tb => ({
          id: tb.id,
          title: tb.title || "Untitled Textbook",
          type: "Textbook" as MediaType
        }));
      case "Paper":
        return data.papers.map(p => ({
          id: p.id,
          title: p.title || "Untitled Paper",
          type: "Paper" as MediaType
        }));
      case "Script":
        return data.scripts.map(s => ({
          id: s.id,
          title: s.title || "Untitled Script",
          type: "Script" as MediaType
        }));
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
    if (!file) { // Only allow file selection if not already selected
      validateFile(e.dataTransfer.files[0]);
    }
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

  // Generate a thumbnail from the first page when a file is selected
  // and convert it to a File object
  useEffect(() => {
    if (file) {
      // Render the first page as a thumbnail at a smaller scale (0.5)
      renderPdfPageToImage(file, 1, 0.5)
        .then(url => {
          setThumbnailUrl(url);
          // Convert the URL (data URL) to a File object
          const thumbFile = dataURLtoFile(url, "thumbnail.png");
          setThumbnail(thumbFile);
        })
        .catch(err => {
          console.error("Error generating thumbnail", err);
          setThumbnailUrl(null);
          setThumbnail(null);
        });
    } else {
      setThumbnailUrl(null);
      setThumbnail(null);
    }
  }, [file]);

  // Handle clicking on an existing literature entry
  const handleEntryClick = (entry: { id: number; title: string; type: MediaType }) => {
    setSelectedEntry(entry);
    setIsCreatingNew(false);
  };

  // Handle clicking the "Create New" button
  const handleCreateNewClick = () => {
    setSelectedEntry(null);
    setIsCreatingNew(true);
  };

  // Allow the user to change the selected file
  const handleChangeFile = () => {
    setFile(null);
    setThumbnailUrl(null);
    setPageCount(null);
  };

  return (
    <div className={`p-4 ${className}`}>
      <h2 className="text-xl font-semibold mb-4">Upload New PDF</h2>
      
      {/* Drop area */}
      <div 
        className="relative flex justify-center items-center border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-blue-400 transition-colors mb-4 cursor-pointer"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => {
          // Always open the file picker on click
          fileInputRef.current?.click();
        }}
      >
        {file ? (
          <div className="flex items-center space-x-4">
            {thumbnailUrl && (
              <img 
                src={thumbnailUrl} 
                alt="PDF Thumbnail" 
                className="w-24 h-auto mr-4 rounded-md shadow-md" 
              />
            )}
            <div className="flex-1 text-left">
              <div className="font-bold text-lg">{file.name}</div>
              <div className="text-sm text-gray-600">
                {(file.size / 1024 / 1024).toFixed(2)} MB {pageCount ? `, ${pageCount} pages` : ""}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4a1 1 0 011-1h8a1 1 0 011 1v12m-4 4h.01M5 20h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500">Drag & drop a PDF here or click to select</p>
          </div>
        )}
        <input 
          type="file" 
          accept=".pdf" 
          ref={fileInputRef} 
          className="absolute inset-0 opacity-0" 
          onChange={handleFileSelect} 
        />
      </div>

      {/* "Change File" button */}
      {file && (
        <div className="flex justify-end mb-4">
          <button 
            onClick={handleChangeFile}
            className="bg-red-500 text-white px-4 py-1 rounded"
          >
            Change File
          </button>
        </div>
      )}

      {/* Banner container replacing the dropdown.
          The banners are displayed side by side and clicking one sets the literature type. */}
      <div className="flex gap-4 mb-4">
        {MEDIA_TYPES.map((type) => (
          <LiteratureBannerCard 
            key={type}
            type={type}
            className={`flex-1 ${selectedType === type ? 'ring-4 ring-blue-500' : ''}`}
            onClick={() => setSelectedType(type)}
          />
        ))}
      </div>

      {error && <p className="text-red-500">{error}</p>}

      {/* Literature entries and forms are displayed once a literature type is selected.
          Note: We no longer require a file to be selected for these elements to show. */}
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
            {selectedEntry ? (
              <VersionForm mediaType={selectedType as MediaType} entry={selectedEntry} file={file} thumbnail={thumbnail} />
            ) : (
              <LiteratureForm mediaType={selectedType as MediaType} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadWidget;

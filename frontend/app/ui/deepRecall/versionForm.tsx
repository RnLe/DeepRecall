// versionForm.tsx

import React, { useState, useEffect, useRef } from "react";
import SparkMD5 from "spark-md5";
import { X } from "lucide-react";
import { Literature, LiteratureExtended } from "../../types/deepRecall/strapi/literatureTypes";
import { VersionType } from "../../types/deepRecall/strapi/versionTypes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateLiterature } from "../../api/literatureService";
import { uploadFile } from "../../api/uploadFile";
import { renderPdfPageToImage, dataURLtoFile } from "../../helpers/pdfThumbnail";
import { useLiterature } from "../../customHooks/useLiterature";

// Compute MD5 hash of a file
function computeMD5(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const binaryStr = e.target?.result as string;
      const hash = SparkMD5.hashBinary(binaryStr);
      resolve(hash);
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

interface VersionFormProps {
  versionType: VersionType;
  entry: LiteratureExtended;
  className?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  initialFile?: File; // Add support for pre-selected file
}

const VersionForm: React.FC<VersionFormProps> = ({ versionType, entry, className, onSuccess, onCancel, initialFile }) => {
  // File upload state
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isGlobalDrag, setIsGlobalDrag] = useState(false);

  // Get all literature for duplicate checking
  const { data: allLiterature } = useLiterature();

  // Global drag detection
  useEffect(() => {
    const handleGlobalDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        setIsGlobalDrag(true);
      }
    };

    const handleGlobalDragLeave = (e: DragEvent) => {
      // Only set to false if we're leaving the entire window
      if (!e.relatedTarget) {
        setIsGlobalDrag(false);
      }
    };

    const handleGlobalDrop = () => {
      setIsGlobalDrag(false);
    };

    document.addEventListener('dragenter', handleGlobalDragEnter);
    document.addEventListener('dragleave', handleGlobalDragLeave);
    document.addEventListener('drop', handleGlobalDrop);

    return () => {
      document.removeEventListener('dragenter', handleGlobalDragEnter);
      document.removeEventListener('dragleave', handleGlobalDragLeave);
      document.removeEventListener('drop', handleGlobalDrop);
    };
  }, []);

  // Compute file hash and display as text
  const [fileHash, setFileHash] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<{
    exists: boolean;
    literatureTitle: string;
  } | null>(null);
  useEffect(() => {
    if (file) {
      computeMD5(file).then((hash) => {
        setFileHash(hash);
        checkForDuplicateHash(hash);
      });
    } else {
      setFileHash("");
      setDuplicateWarning(null);
    }
  }, [file, allLiterature]);

  // Function to check for duplicate file hashes across all literature
  const checkForDuplicateHash = (hash: string) => {
    if (!allLiterature || !hash) {
      setDuplicateWarning(null);
      return;
    }

    for (const literature of allLiterature) {
      // Skip the current literature entry
      if (literature.documentId === entry.documentId) continue;

      let metadata: any = {};
      if (typeof literature.metadata === "string") {
        try {
          metadata = JSON.parse(literature.metadata);
        } catch {
          continue;
        }
      } else if (typeof literature.metadata === "object" && literature.metadata !== null) {
        metadata = literature.metadata;
      }

      const versions = Array.isArray(metadata.versions) ? metadata.versions : [];
      
      for (const version of versions) {
        try {
          const versionData = typeof version.versionMetadata === "string" 
            ? JSON.parse(version.versionMetadata)
            : version.versionMetadata;
          
          if (versionData.fileHash === hash) {
            setDuplicateWarning({
              exists: true,
              literatureTitle: literature.title || "Unknown Title"
            });
            return;
          }
        } catch {
          continue;
        }
      }
    }

    setDuplicateWarning(null);
  };

  // parse versionType template
  const [versionTpl, setVersionTpl] = useState<Record<string, any>>({});
  const [versionFields, setVersionFields] = useState<Record<string, any>>({});

  useEffect(() => {
    if (versionType.versionMetadata) {
      try {
        // Check if versionMetadata is already an object or a JSON string
        const tpl = typeof versionType.versionMetadata === 'string' 
          ? JSON.parse(versionType.versionMetadata)
          : versionType.versionMetadata;
        
        // Remove literatureTypes field from the form (it's used internally for linking)
        if (tpl.literatureTypes !== undefined) {
          delete tpl.literatureTypes;
        }
        
        // Extract default values from the metadata structure
        const extractedTpl: Record<string, any> = {};
        const initialFields: Record<string, any> = {};
        
        Object.entries(tpl).forEach(([key, value]) => {
          if (value && typeof value === 'object' && 'default_value' in value) {
            extractedTpl[key] = value.default_value;
            // For version creation, we want empty fields for user input
            // Only keep actual defaults for non-user-input fields
            if (Array.isArray(value.default_value)) {
              initialFields[key] = []; // Empty array for user input
            } else if (typeof value.default_value === 'number') {
              // For edition/version numbers, start at 1 instead of 0
              const isVersionOrEdition = key.toLowerCase().includes('version') || key.toLowerCase().includes('edition');
              initialFields[key] = isVersionOrEdition ? 1 : 0;
            } else {
              initialFields[key] = ""; // Empty string for text fields
            }
          } else if (value && typeof value === 'object' && 'default' in value) {
            // Handle old structure with 'default' key
            extractedTpl[key] = value.default;
            if (Array.isArray(value.default)) {
              initialFields[key] = [];
            } else if (typeof value.default === 'number') {
              const isVersionOrEdition = key.toLowerCase().includes('version') || key.toLowerCase().includes('edition');
              initialFields[key] = isVersionOrEdition ? 1 : 0;
            } else {
              initialFields[key] = "";
            }
          } else {
            // Fallback for very old structure
            extractedTpl[key] = value;
            if (Array.isArray(value)) {
              initialFields[key] = [];
            } else if (typeof value === 'number') {
              const isVersionOrEdition = key.toLowerCase().includes('version') || key.toLowerCase().includes('edition');
              initialFields[key] = isVersionOrEdition ? 1 : 0;
            } else {
              initialFields[key] = "";
            }
          }
        });
        
        setVersionTpl(extractedTpl);
        setVersionFields(initialFields);
      } catch (e) {
        console.error("Error parsing versionMetadata:", e);
        setVersionTpl({});
        setVersionFields({});
      }
    }
  }, [versionType]);

  // Set initial file if provided
  useEffect(() => {
    if (initialFile && fileInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(initialFile);
      fileInputRef.current.files = dt.files;
    }
  }, [initialFile]);

  // recommended keys
  const recommended = ["publishingDate","versionTitle","editionNumber","versionNumber"];
  const recKeys = recommended.filter(k => k in versionTpl);
  const customKeys = Object.keys(versionTpl).filter(k => !recommended.includes(k));

  // render per‐field input
  const renderField = (key: string, value: any) => {
    const baseClassName = "w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200";
    
    if (key === "publishingDate") {
      // Get current date for defaults
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11
      const currentDay = currentDate.getDate();
      
      // Parse existing date value if any
      const existingDate = versionFields[key] || "";
      let selectedYear = currentYear;
      let selectedMonth = currentMonth;
      let selectedDay = currentDay;
      
      if (existingDate) {
        const dateParts = existingDate.split('-');
        if (dateParts.length === 3) {
          selectedYear = parseInt(dateParts[0]) || currentYear;
          selectedMonth = parseInt(dateParts[1]) || currentMonth;
          selectedDay = parseInt(dateParts[2]) || currentDay;
        }
      }
      
      // Generate options
      const years = Array.from({length: 50}, (_, i) => currentYear - i); // Current year to 50 years ago
      const months = [
        { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
        { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
        { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
        { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" }
      ];
      
      // Calculate days in selected month/year
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const days = Array.from({length: daysInMonth}, (_, i) => i + 1);
      
      const updateDate = (newYear: number, newMonth: number, newDay: number) => {
        // Ensure day is valid for the month/year combination
        const maxDays = new Date(newYear, newMonth, 0).getDate();
        const validDay = Math.min(newDay, maxDays);
        
        const dateString = `${newYear}-${String(newMonth).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`;
        setVersionFields(f => ({...f, [key]: dateString}));
      };
      
      return (
        <div className="grid grid-cols-3 gap-2">
          {/* Day Dropdown */}
          <select
            value={selectedDay}
            onChange={e => updateDate(selectedYear, selectedMonth, parseInt(e.target.value))}
            className={baseClassName}
          >
            {days.map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
          
          {/* Month Dropdown */}
          <select
            value={selectedMonth}
            onChange={e => updateDate(selectedYear, parseInt(e.target.value), selectedDay)}
            className={baseClassName}
          >
            {months.map(month => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
          
          {/* Year Dropdown */}
          <select
            value={selectedYear}
            onChange={e => updateDate(parseInt(e.target.value), selectedMonth, selectedDay)}
            className={baseClassName}
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      );
    }
    // Check if the template value is a number or if the current field value is a number
    if (typeof value === "number" || (!isNaN(Number(value)) && value !== "")) {
      // For edition/version numbers, ensure minimum value is 1
      const isVersionOrEdition = key.toLowerCase().includes('version') || key.toLowerCase().includes('edition');
      const minValue = isVersionOrEdition ? 1 : 0;
      const currentValue = versionFields[key] || minValue;
      
      return <input 
        type="number" 
        min={minValue}
        value={Math.max(currentValue, minValue)}
        onChange={e => {
          const newValue = Math.max(Number(e.target.value), minValue);
          setVersionFields(f => ({...f, [key]: newValue}));
        }}
        className={baseClassName}
        placeholder={`Enter number (min: ${minValue})...`}
      />;
    }
    // Check if template value is an array (dropdown options)
    if (Array.isArray(value) && value.length > 0) {
      return <select 
        value={versionFields[key] || ""}
        onChange={e=>setVersionFields(f=>({...f,[key]:e.target.value}))}
        className={baseClassName}
      >
        <option value="">Select an option...</option>
        {value.map((opt:any,i)=> <option key={i} value={opt}>{opt}</option>)}
      </select>;
    }
    // Default to text input for everything else
    return <input 
      type="text" 
      value={versionFields[key] || ""}
      onChange={e=>setVersionFields(f=>({...f,[key]:e.target.value}))}
      className={baseClassName}
      placeholder="Enter text..."
    />;
  };

  // File input change handler
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "application/pdf") {
        setFileError("Only PDF files allowed");
        setFile(null);
      } else {
        setFileError("");
        setFile(selectedFile);
      }
    }
  };

  // Drag and drop handlers for file input
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === 'application/pdf');
    
    if (pdfFile) {
      setFileError("");
      setFile(pdfFile);
      
      // Update the file input element to show the dropped file
      if (fileInputRef.current) {
        const dt = new DataTransfer();
        dt.items.add(pdfFile);
        fileInputRef.current.files = dt.files;
      }
    } else if (files.length > 0) {
      setFileError("Only PDF files are allowed");
    }
  };

  const handleFileDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleFileDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragOver to false if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  // Generate thumbnail from the uploaded PDF
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  useEffect(() => {
    if (file) {
      renderPdfPageToImage(file, 1, 0.5)
        .then((url) => {
          setThumbnailUrl(url);
          const thumbFile = dataURLtoFile(url, "thumbnail.png");
          setThumbnail(thumbFile);
        })
        .catch((err) => {
          console.error("Error generating thumbnail", err);
          setThumbnailUrl(null);
          setThumbnail(null);
        });
    } else {
      setThumbnailUrl(null);
      setThumbnail(null);
    }
  }, [file]);

  // Error and submitting states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const updateLiteratureMutation = useMutation<
    Literature,
    Error,
    { documentId: string; data: Partial<Literature> }
  >({
    mutationFn: ({ documentId, data }) => updateLiterature(documentId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["literature"] }),
    onError: (error: Error) => {
      console.error("Failed to update literature:", error);
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    if (!file) {
      setErrorMsg("Please select a PDF file.");
      setIsSubmitting(false);
      return;
    }

    // Prevent duplicate version by hash within the same literature entry
    let currentMetadata: any = {};
    const metadata = entry.metadata;
    if (typeof metadata === "string") {
      try {
        currentMetadata = JSON.parse(metadata);
      } catch {
        currentMetadata = {};
      }
    } else if (typeof metadata === "object" && metadata !== null) {
      currentMetadata = metadata;
    }
    const existing = Array.isArray(currentMetadata.versions) ? currentMetadata.versions : [];
    // The versionMetadata field is a JSON string, so we need to parse it
    const existingParsed = existing.map((v: any) => {
      try {
        return JSON.parse(v.versionMetadata);
      } catch {
        return {};
      }
    });
    if (existingParsed.some((v: any) => v.fileHash === fileHash)) {
      setErrorMsg("This file has already been uploaded as a version for this literature entry.");
      setIsSubmitting(false);
      return;
    }

    try {
      const uploadedFile    = await uploadFile(file);
      const uploadedThumb   = thumbnail ? await uploadFile(thumbnail) : { url: "", id: 0 };

      // bundle all version data into a single JSON field
      const newVersion = {
        versionMetadata: JSON.stringify({
          ...versionFields,
          name: entry.type,
          fileUrl: uploadedFile.url,
          thumbnailUrl: uploadedThumb.url,
          fileId: uploadedFile.id, // Store the Strapi file ID for deletion
          thumbnailId: uploadedThumb.id || undefined, // Store thumbnail ID if exists
          fileHash,
        })
      };

      currentMetadata.versions = [...(currentMetadata.versions||[]), newVersion];

      await updateLiteratureMutation.mutateAsync({
        documentId: entry.documentId!,
        data: { metadata: JSON.stringify(currentMetadata) },
      });

      console.log("Updated literature with new version.");

      // Reset fields on success.
      setFile(null);
      setThumbnail(null);
      setThumbnailUrl(null);
      setVersionFields({});
      setFileHash("");
      setDuplicateWarning(null);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Document Info */}
        <div className="bg-slate-700/30 border border-slate-600/30 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-2 h-4 bg-gradient-to-b from-emerald-500 to-blue-600 rounded-full"></div>
            <h4 className="text-md font-semibold text-slate-200">{entry.type || "Document"}</h4>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-slate-400">Title:</span>
              <span className="text-slate-200 ml-2">{entry.title}</span>
            </div>
            {entry.authors && (
              <div>
                <span className="text-slate-400">Authors:</span>
                <span className="text-slate-200 ml-2">
                  {Array.isArray(entry.authors) ? entry.authors.join(", ") : entry.authors}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* File Upload and Thumbnail */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-1 h-4 bg-gradient-to-b from-orange-500 to-red-600 rounded-full"></div>
            <label className="text-sm font-medium text-slate-300">Upload PDF</label>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* File input with drag-and-drop */}
            <div 
              className="space-y-2"
              onDrop={handleFileDrop}
              onDragOver={handleFileDragOver}
              onDragLeave={handleFileDragLeave}
            >
              <div className={`border-2 border-dashed rounded-lg p-4 transition-all duration-200 ${
                isDragOver 
                  ? "border-indigo-400 bg-indigo-500/10 scale-105" 
                  : isGlobalDrag
                    ? "border-emerald-400 bg-emerald-500/5 animate-pulse"
                    : "border-slate-600/50 hover:border-slate-500/50"
              }`}>
                <input
                  type="file"
                  accept=".pdf"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  className="w-full px-3 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
                />
                <p className="text-xs text-slate-400 text-center mt-2">
                  {isDragOver 
                    ? "Drop your PDF file here" 
                    : isGlobalDrag 
                      ? "Drag your file here to upload" 
                      : "Or drag and drop a PDF file here"}
                </p>
              </div>
              {fileError && (
                <div className="mt-2 bg-red-950/20 border border-red-900/20 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <p className="text-red-400 text-sm">{fileError}</p>
                  </div>
                </div>
              )}
              {duplicateWarning?.exists && (
                <div className="mt-2 bg-amber-950/20 border border-amber-900/20 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-amber-500 rounded-full mt-0.5 flex-shrink-0"></div>
                    <div>
                      <p className="text-amber-400 text-sm font-medium">⚠️ Duplicate File Detected</p>
                      <p className="text-amber-300 text-xs mt-1">
                        This file already exists in: <strong>"{duplicateWarning.literatureTitle}"</strong>
                      </p>
                      <p className="text-amber-300 text-xs mt-1">
                        Uploading the same file multiple times may create unnecessary duplicates.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {file && (
                <div className="mt-2 bg-emerald-950/20 border border-emerald-900/20 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <p className="text-emerald-400 text-sm">
                        {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setFileError("");
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      className="p-1 text-emerald-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Thumbnail preview */}
            <div className="flex items-center justify-center h-48 bg-slate-700/30 border border-slate-600/30 rounded-lg">
              {thumbnailUrl ? (
                <img 
                  src={thumbnailUrl} 
                  alt="PDF Thumbnail" 
                  className="max-h-full max-w-full object-contain rounded"
                />
              ) : (
                <div className="text-center text-slate-500">
                  <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm">PDF Preview</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Core Fields Section */}
        {recKeys.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-1 h-4 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
              <h4 className="text-md font-semibold text-slate-200">Core Fields</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l border-slate-700/50">
              {recKeys.map(key => (
                <div key={key} className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  {renderField(key, versionTpl[key])}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Fields Section */}
        {customKeys.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-1 h-4 bg-gradient-to-b from-purple-500 to-pink-600 rounded-full"></div>
              <h4 className="text-md font-semibold text-slate-200">Additional Fields</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l border-slate-700/50">
              {customKeys.map(key => (
                <div key={key} className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  {renderField(key, versionTpl[key])}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMsg && (
          <div className="bg-red-950/20 border border-red-900/20 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <p className="text-red-400 text-sm">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-700/50">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !file}
            className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
              isSubmitting || !file
                ? "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                : "bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-700 hover:to-red-700 shadow-sm hover:shadow-md"
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Creating Version...</span>
              </div>
            ) : (
              "Create Version"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VersionForm;

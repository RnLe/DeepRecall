// enhancedLiteratureForm.tsx

import React, { useState, useEffect, useRef } from "react";
import { Literature, LiteratureType } from "../../types/deepRecall/strapi/literatureTypes";
import { VersionType } from "../../types/deepRecall/strapi/versionTypes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLiterature, updateLiterature } from "../../api/literatureService";
import { useVersionTypes } from "../../customHooks/useLiterature";
import { uploadFile } from "../../api/uploadFile";
import { X, Upload, FileText, Sparkles, Plus, Edit2, Trash2 } from 'lucide-react';
import PdfThumbnailSelector from './pdfThumbnailSelector';
import PdfTextExtractionModal from './pdfTextExtractionModal';
import SparkMD5 from "spark-md5";

interface EnhancedLiteratureFormProps {
  literatureType: LiteratureType;
  className?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface Author {
  id: string;
  name: string;
}

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

const EnhancedLiteratureForm: React.FC<EnhancedLiteratureFormProps> = ({
  literatureType,
  className,
  onSuccess,
  onCancel,
}) => {
  // Literature form state
  const [title, setTitle] = useState("");
  const [additionalFields, setAdditionalFields] = useState<Record<string, any>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // PDF upload state
  const [showPdfSection, setShowPdfSection] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [selectedThumbnailPage, setSelectedThumbnailPage] = useState(1);
  const [fileError, setFileError] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Version form state
  const [versionFields, setVersionFields] = useState<Record<string, any>>({});
  const [matchingVersionType, setMatchingVersionType] = useState<VersionType | null>(null);
  
  // Text extraction modal state
  const [showTextExtractionModal, setShowTextExtractionModal] = useState(false);
  
  // Author management state
  const [editingAuthor, setEditingAuthor] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  
  // Get version types to find matching one
  const { data: versionTypes } = useVersionTypes();

  // Find matching version type
  useEffect(() => {
    if (versionTypes && literatureType.name) {
      const matchingType = versionTypes.find(vt => vt.name.toLowerCase() === literatureType.name.toLowerCase());
      setMatchingVersionType(matchingType || null);
      
      if (matchingType) {
        // Initialize version fields
        try {
          const tpl = typeof matchingType.versionMetadata === 'string' 
            ? JSON.parse(matchingType.versionMetadata)
            : matchingType.versionMetadata;
          
          if (tpl.literatureTypes !== undefined) {
            delete tpl.literatureTypes;
          }
          
          const initialFields: Record<string, any> = {};
          Object.entries(tpl).forEach(([key, value]) => {
            if (value && typeof value === 'object' && 'default_value' in value) {
              if (Array.isArray((value as any).default_value)) {
                initialFields[key] = [];
              } else if (typeof (value as any).default_value === 'number') {
                const isVersionOrEdition = key.toLowerCase().includes('version') || key.toLowerCase().includes('edition');
                initialFields[key] = isVersionOrEdition ? 1 : 0;
              } else {
                initialFields[key] = "";
              }
            } else if (value && typeof value === 'object' && 'default' in value) {
              if (Array.isArray((value as any).default)) {
                initialFields[key] = [];
              } else if (typeof (value as any).default === 'number') {
                const isVersionOrEdition = key.toLowerCase().includes('version') || key.toLowerCase().includes('edition');
                initialFields[key] = isVersionOrEdition ? 1 : 0;
              } else {
                initialFields[key] = "";
              }
            }
          });
          
          setVersionFields(initialFields);
        } catch (e) {
          console.error("Error parsing version metadata:", e);
        }
      }
    }
  }, [versionTypes, literatureType.name]);

  // Parse literature type metadata
  useEffect(() => {
    try {
      let template;
      if (typeof literatureType.typeMetadata === "string") {
        template = literatureType.typeMetadata 
          ? JSON.parse(literatureType.typeMetadata) 
          : {};
      } else {
        template = literatureType.typeMetadata || {};
      }
      
      if (template.versions !== undefined) delete template.versions;
      if (template.icon !== undefined) delete template.icon;
      if (template.versionsAreEqual !== undefined) delete template.versionsAreEqual;
      
      const initFields: Record<string, any> = {};
      Object.entries(template).forEach(([k, v]) => {
        if (v && typeof v === 'object' && 'default_value' in v) {
          if (k === 'versionsAreEqual' || k === 'icon') {
            initFields[k] = (v as any).default_value;
          } else if ((v as any).field_type === 'array') {
            initFields[k] = [];
          } else {
            initFields[k] = "";
          }
        } else {
          if (k === 'versionsAreEqual' || k === 'icon') {
            initFields[k] = v;
          } else {
            initFields[k] = Array.isArray(v) ? [] : "";
          }
        }
      });
      setAdditionalFields(initFields);
    } catch (err) {
      setAdditionalFields({});
      console.error("Error parsing literature type metadata:", err);
    }
  }, [literatureType]);

  // Mutations
  const createLiteratureMutation = useMutation<
    Literature,
    Error,
    Omit<Literature, "documentId">
  >({
    mutationFn: createLiterature,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["literature"] }),
    onError: (error: Error) => {
      console.error("Failed to create literature:", error);
    },
  });

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

  // Helper functions
  const handleAdditionalFieldChange = (key: string, value: any) => {
    setAdditionalFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleVersionFieldChange = (key: string, value: any) => {
    setVersionFields((prev) => ({ ...prev, [key]: value }));
  };

  // Author management functions
  const convertAuthorsArrayToObjects = (authors: any[]): Author[] => {
    return authors.map((author, index) => ({
      id: `author-${Date.now()}-${index}`,
      name: typeof author === 'string' ? author : String(author)
    }));
  };

  const handleAddAuthor = () => {
    const currentAuthors = Array.isArray(additionalFields.authors) ? additionalFields.authors : [];
    const authorsObjects = convertAuthorsArrayToObjects(currentAuthors);
    const newAuthor: Author = {
      id: `author-${Date.now()}-${Math.random()}`,
      name: 'New Author'
    };
    const updatedAuthors = [...authorsObjects, newAuthor];
    handleAdditionalFieldChange('authors', updatedAuthors.map(a => a.name));
    setEditingAuthor(newAuthor.id);
  };

  const handleEditAuthor = (authorId: string, newName: string) => {
    const currentAuthors = Array.isArray(additionalFields.authors) ? additionalFields.authors : [];
    const authorsObjects = convertAuthorsArrayToObjects(currentAuthors);
    const updatedAuthors = authorsObjects.map(author => 
      author.id === authorId ? { ...author, name: newName } : author
    );
    handleAdditionalFieldChange('authors', updatedAuthors.map(a => a.name));
  };

  const handleRemoveAuthor = (authorId: string) => {
    const currentAuthors = Array.isArray(additionalFields.authors) ? additionalFields.authors : [];
    const authorsObjects = convertAuthorsArrayToObjects(currentAuthors);
    const updatedAuthors = authorsObjects.filter(author => author.id !== authorId);
    handleAdditionalFieldChange('authors', updatedAuthors.map(a => a.name));
  };

  // File handling
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "application/pdf") {
        setFileError("Only PDF files allowed");
        setPdfFile(null);
      } else {
        setFileError("");
        setPdfFile(selectedFile);
      }
    }
  };

  // Drag and drop handlers for PDF file input
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === 'application/pdf');
    
    if (pdfFile) {
      setFileError("");
      setPdfFile(pdfFile);
      
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

  const handleThumbnailUpload = async (thumbnailFile: File | null) => {
    setThumbnail(thumbnailFile);
  };

  const handleThumbnailUrlUpdate = (url: string | null) => {
    setThumbnailUrl(url);
  };

  const handlePageChange = (page: number) => {
    setSelectedThumbnailPage(page);
  };

  // Text extraction
  const getExtractionFields = () => {
    const fields = [
      { key: 'title', label: 'Title', value: title }
    ];
    
    Object.entries(additionalFields).forEach(([key, value]) => {
      fields.push({
        key,
        label: key.replace(/([A-Z])/g, ' $1').trim(),
        value
      });
    });

    if (showPdfSection) {
      Object.entries(versionFields).forEach(([key, value]) => {
        fields.push({
          key: `version_${key}`,
          label: `Version ${key.replace(/([A-Z])/g, ' $1').trim()}`,
          value
        });
      });
    }

    return fields;
  };

  const handleFieldUpdate = (key: string, value: string) => {
    if (key === 'title') {
      setTitle(value);
    } else if (key.startsWith('version_')) {
      const versionKey = key.replace('version_', '');
      handleVersionFieldChange(versionKey, value);
    } else if (key === 'authors') {
      // Special handling for authors field - convert comma-separated string to array
      if (value.trim() === '') {
        handleAdditionalFieldChange(key, []);
      } else {
        const authorsArray = value
          .split(',')
          .map(author => author.trim())
          .filter(author => author.length > 0);
        handleAdditionalFieldChange(key, authorsArray);
      }
    } else {
      handleAdditionalFieldChange(key, value);
    }
  };

  const handleTextExtraction = (extractedData: Record<string, string>) => {
    // Apply extracted text to form fields
    Object.entries(extractedData).forEach(([fieldName, value]) => {
      if (fieldName === 'title') {
        setTitle(value);
      } else if (additionalFields.hasOwnProperty(fieldName)) {
        if (fieldName === 'authors' && typeof value === 'string') {
          // Handle authors as comma-separated string
          const authorsArray = value.split(',').map(author => author.trim()).filter(Boolean);
          handleAdditionalFieldChange(fieldName, authorsArray);
        } else {
          handleAdditionalFieldChange(fieldName, value);
        }
      } else if (versionFields.hasOwnProperty(fieldName)) {
        handleVersionFieldChange(fieldName, value);
      }
    });
    
    setShowTextExtractionModal(false);
  };

  // Render field inputs (same as original literatureForm)
  const renderAdditionalField = (key: string, value: any) => {
    if (key === "versionsAreEqual") {
      return (
        <div className="px-3 py-2 bg-slate-700/30 border border-slate-600/30 rounded-lg text-slate-300">
          {additionalFields[key] ? "True" : "False"}
        </div>
      );
    }
    
    // Handle authors field specially with tag display
    if (key === "authors") {
      const currentAuthors = Array.isArray(additionalFields[key]) ? additionalFields[key] : [];
      const authorsObjects = convertAuthorsArrayToObjects(currentAuthors);
      
      if (authorsObjects.length > 0) {
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {authorsObjects.map((author) => (
                <div
                  key={author.id}
                  className="inline-flex items-center bg-blue-600/20 text-blue-300 px-2 py-1 rounded-md text-xs border border-blue-500/30 group/tag"
                >
                  {editingAuthor === author.id ? (
                    <input
                      type="text"
                      value={author.name}
                      onChange={(e) => handleEditAuthor(author.id, e.target.value)}
                      onBlur={() => setEditingAuthor(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditingAuthor(null);
                      }}
                      className="bg-transparent border-none outline-none text-blue-300 min-w-0 w-full"
                      autoFocus
                    />
                  ) : (
                    <span 
                      onClick={() => setEditingAuthor(author.id)}
                      className="cursor-pointer hover:bg-blue-500/20 px-1 py-0.5 rounded transition-colors"
                    >
                      {author.name}
                    </span>
                  )}
                  <button
                    onClick={() => handleRemoveAuthor(author.id)}
                    className="ml-1 text-blue-400 hover:text-red-400 opacity-0 group-hover/tag:opacity-100 transition-all duration-200"
                    title="Remove author"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={handleAddAuthor}
                className="inline-flex items-center text-slate-400 hover:text-blue-400 px-2 py-1 rounded-md text-xs border border-slate-600/30 hover:border-blue-500/30 transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            {/* Backup input for bulk entry */}
            <input
              type="text"
              placeholder="Or add authors separated by commas (e.g., John Doe, Jane Smith)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const inputValue = e.currentTarget.value;
                  if (inputValue.trim()) {
                    const newAuthors = inputValue
                      .split(",")
                      .map(author => author.trim())
                      .filter(author => author.length > 0);
                    const allAuthors = [...currentAuthors, ...newAuthors];
                    handleAdditionalFieldChange(key, allAuthors);
                    e.currentTarget.value = '';
                  }
                }
              }}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 text-sm"
            />
          </div>
        );
      } else {
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-center p-4 border-2 border-dashed border-slate-600/50 rounded-lg">
              <button
                onClick={handleAddAuthor}
                className="flex items-center space-x-2 text-slate-400 hover:text-blue-400 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">Add Author</span>
              </button>
            </div>
            <input
              type="text"
              placeholder="Or add authors separated by commas (e.g., John Doe, Jane Smith)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const inputValue = e.currentTarget.value;
                  if (inputValue.trim()) {
                    const newAuthors = inputValue
                      .split(",")
                      .map(author => author.trim())
                      .filter(author => author.length > 0);
                    handleAdditionalFieldChange(key, newAuthors);
                    e.currentTarget.value = '';
                  }
                }
              }}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 text-sm"
            />
          </div>
        );
      }
    }
    
    if (Array.isArray(value)) {
      return (
        <select
          value={additionalFields[key]}
          onChange={(e) => handleAdditionalFieldChange(key, e.target.value)}
          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
        >
          <option value="">Select an option</option>
          {value.map((option: string | number, idx: number) => (
            <option key={idx} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    } else if (typeof value === "number") {
      return (
        <input
          type="number"
          value={additionalFields[key]}
          onChange={(e) => handleAdditionalFieldChange(key, Number(e.target.value))}
          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
        />
      );
    } else {
      return (
        <input
          type="text"
          value={additionalFields[key]}
          onChange={(e) => handleAdditionalFieldChange(key, e.target.value)}
          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
        />
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      // Build metadata by merging the template (as modifiable additionalFields)
      const metadataPayload = { ...additionalFields };
      
      // Handle authors field specially - convert string to array if needed
      if (metadataPayload.authors && typeof metadataPayload.authors === 'string') {
        metadataPayload.authors = metadataPayload.authors
          .split(",")
          .map(author => author.trim())
          .filter(author => author.length > 0);
      }

      const payload: Omit<Literature, "documentId"> = {
        title,
        type: literatureType.name,
        metadata: JSON.stringify(metadataPayload),
      };

      const createdLiterature = await createLiteratureMutation.mutateAsync(payload);
      
      // If PDF section is enabled and file is uploaded, create version
      if (showPdfSection && pdfFile && matchingVersionType) {
        // Compute MD5 hash
        const fileHash = await computeMD5(pdfFile);
        
        // Upload files
        const uploadedFile = await uploadFile(pdfFile);
        const uploadedThumb = thumbnail ? await uploadFile(thumbnail) : { url: "", id: 0 };

        // Create version metadata
        const newVersion = {
          versionMetadata: JSON.stringify({
            ...versionFields,
            name: literatureType.name,
            fileUrl: uploadedFile.url,
            thumbnailUrl: uploadedThumb.url,
            fileId: uploadedFile.id,
            thumbnailId: uploadedThumb.id || undefined,
            fileHash,
          })
        };

        // Update literature with version
        const currentMetadata = createdLiterature.metadata;
        let parsedMetadata = {};
        
        if (typeof currentMetadata === "string") {
          try {
            parsedMetadata = JSON.parse(currentMetadata);
          } catch {
            parsedMetadata = {};
          }
        } else if (typeof currentMetadata === "object" && currentMetadata !== null) {
          parsedMetadata = currentMetadata;
        }

        (parsedMetadata as any).versions = [(parsedMetadata as any).versions || [], newVersion].flat();

        await updateLiteratureMutation.mutateAsync({
          documentId: createdLiterature.documentId!,
          data: { metadata: JSON.stringify(parsedMetadata) },
        });
      }

      // Reset form
      setTitle("");
      setAdditionalFields({});
      setVersionFields({});
      setPdfFile(null);
      setThumbnail(null);
      setThumbnailUrl(null);
      setShowPdfSection(false);
      
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
      <div className="flex gap-6">
        
        {/* Main Form - Left Side */}
        <div className="flex-1">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Title Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Enter literature title..."
                className="w-full px-3 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
              />
            </div>

            {/* Additional Fields */}
            {Object.keys(additionalFields).length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-1 h-4 bg-gradient-to-b from-emerald-500 to-blue-600 rounded-full"></div>
                  <h4 className="text-md font-semibold text-slate-200">
                    Type-specific Attributes
                  </h4>
                </div>
                
                <div className="space-y-4 pl-4 border-l border-slate-700/50">
                  {Object.entries(additionalFields).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <label className="block text-sm font-medium text-slate-300 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      {renderAdditionalField(key, value)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Version Fields (only show if PDF section is enabled) */}
            {showPdfSection && Object.keys(versionFields).length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-1 h-4 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
                  <h4 className="text-md font-semibold text-slate-200">Version Information</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l border-slate-700/50">
                  {Object.entries(versionFields).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <label className="block text-sm font-medium text-slate-300 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <input
                        type={typeof value === 'number' ? 'number' : 'text'}
                        value={versionFields[key]}
                        onChange={(e) => handleVersionFieldChange(key, typeof value === 'number' ? Number(e.target.value) : e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
                      />
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
                disabled={isSubmitting || !title.trim()}
                className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                  isSubmitting || !title.trim()
                    ? "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-600 to-blue-600 text-white hover:from-emerald-700 hover:to-blue-700 shadow-sm hover:shadow-md"
                }`}
              >
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating...</span>
                  </div>
                ) : (
                  `Create ${literatureType.name.charAt(0).toUpperCase() + literatureType.name.slice(1)}`
                )}
              </button>
            </div>
          </form>
        </div>

        {/* PDF Sidebar - Right Side */}
        <div className="w-96 flex-shrink-0">
          <div className="sticky top-0 space-y-6">
            
            {/* PDF Toggle */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-md font-semibold text-slate-200">PDF Upload</h4>
                  <p className="text-sm text-slate-400 mt-1">
                    Add a PDF version
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPdfSection(!showPdfSection)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                    showPdfSection
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {showPdfSection ? "Hide" : "Add PDF"}
                </button>
              </div>

              {/* PDF Upload Section */}
              {showPdfSection && matchingVersionType && (
                <div className="space-y-4">
                  
                  {/* Drag & Drop PDF Upload */}
                  <div
                    className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                      isDragOver
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-slate-600 hover:border-slate-500"
                    }`}
                    onDrop={handleFileDrop}
                    onDragOver={handleFileDragOver}
                    onDragLeave={handleFileDragLeave}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={handleFileInputChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                      <div className="text-sm">
                        <p className="text-slate-300">
                          {pdfFile ? pdfFile.name : "Drop PDF file here or click to browse"}
                        </p>
                        <p className="text-slate-500 text-xs mt-1">PDF files only</p>
                      </div>
                    </div>
                  </div>
                  
                  {fileError && (
                    <div className="text-red-400 text-sm">{fileError}</div>
                  )}
                </div>
              )}
            </div>

            {/* Thumbnail & Text Extraction */}
            {showPdfSection && pdfFile && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 space-y-4">
                
                {/* Header with Extract Button */}
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-semibold text-slate-200">PDF Tools</h4>
                  <button
                    type="button"
                    onClick={() => setShowTextExtractionModal(true)}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm rounded-md hover:from-purple-700 hover:to-pink-700 transition-all duration-200"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Extract Text</span>
                  </button>
                </div>
                
                {/* Thumbnail Selector */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Thumbnail
                  </label>
                  <PdfThumbnailSelector
                    file={pdfFile}
                    onThumbnailChange={handleThumbnailUpload}
                    onThumbnailUrlChange={handleThumbnailUrlUpdate}
                    selectedPage={selectedThumbnailPage}
                    onPageChange={handlePageChange}
                    className="border border-slate-600/50 rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Text Extraction Modal */}
      <PdfTextExtractionModal
        file={pdfFile}
        isOpen={showTextExtractionModal}
        onClose={() => setShowTextExtractionModal(false)}
        fields={getExtractionFields()}
        onFieldUpdate={handleFieldUpdate}
      />
    </div>
  );
};

export default EnhancedLiteratureForm;

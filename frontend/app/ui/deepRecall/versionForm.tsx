// versionForm.tsx

import React, { useState, useEffect, useRef } from "react";
import SparkMD5 from "spark-md5";
import { Literature, LiteratureExtended } from "../../types/deepRecall/strapi/literatureTypes";
import { VersionType } from "../../types/deepRecall/strapi/versionTypes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateLiterature } from "../../api/literatureService";
import { uploadFile } from "../../api/uploadFile";
import { renderPdfPageToImage, dataURLtoFile } from "../../helpers/pdfThumbnail";

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
}

const VersionForm: React.FC<VersionFormProps> = ({ versionType, entry, className, onSuccess, onCancel }) => {
  // File upload state
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute file hash and display as text
  const [fileHash, setFileHash] = useState("");
  useEffect(() => {
    if (file) {
      computeMD5(file).then((hash) => setFileHash(hash));
    } else {
      setFileHash("");
    }
  }, [file]);

  // parse versionType template
  const [versionTpl, setVersionTpl] = useState<Record<string, any>>({});
  const [versionFields, setVersionFields] = useState<Record<string, any>>({});

  useEffect(() => {
    let tpl: Record<string, any> = {};
    const metadata = versionType.versionMetadata;
    if (typeof metadata === "string") {
      try {
        tpl = JSON.parse(metadata);
      } catch {
        tpl = {};
      }
    } else if (typeof metadata === "object" && metadata !== null) {
      tpl = metadata;
    }
    setVersionTpl(tpl);
    setVersionFields({ ...tpl });
  }, [versionType]);

  // recommended keys
  const recommended = ["publishingDate","versionTitle","editionNumber","versionNumber"];
  const recKeys = recommended.filter(k => k in versionTpl);
  const customKeys = Object.keys(versionTpl).filter(k => !recommended.includes(k));

  // render per‐field input
  const renderField = (key: string, value: any) => {
    const baseClassName = "w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200";
    
    if (key === "publishingDate") {
      return <input 
        type="date" 
        value={versionFields[key]||""}
        onChange={e=>setVersionFields(f=>({...f,[key]:e.target.value}))}
        className={baseClassName}
      />;
    }
    if (typeof value === "number") {
      return <input 
        type="number" 
        value={versionFields[key]||0}
        onChange={e=>setVersionFields(f=>({...f,[key]:Number(e.target.value)}))}
        className={baseClassName}
        placeholder="Enter number..."
      />;
    }
    if (Array.isArray(value)) {
      return <select 
        value={versionFields[key]||""}
        onChange={e=>setVersionFields(f=>({...f,[key]:e.target.value}))}
        className={baseClassName}
      >
        <option value="">Select an option...</option>
        {value.map((opt:any,i)=> <option key={i} value={opt}>{opt}</option>)}
      </select>;
    }
    return <input 
      type="text" 
      value={versionFields[key]||""}
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

    // Prevent duplicate version by hash
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
      setErrorMsg("This file/version already uploaded as a version.");
      setIsSubmitting(false);
      return;
    }

    try {
      const uploadedFile    = await uploadFile(file);
      const uploadedThumb   = thumbnail ? await uploadFile(thumbnail) : { url: "" };

      // bundle all version data into a single JSON field
      const newVersion = {
        versionMetadata: JSON.stringify({
          ...versionFields,
          name: entry.type,
          fileUrl: uploadedFile.url,
          thumbnailUrl: uploadedThumb.url,
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
            <h4 className="text-md font-semibold text-slate-200">Document Information</h4>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-slate-400">Title:</span>
              <span className="text-slate-200 ml-2">{entry.title}</span>
            </div>
            <div>
              <span className="text-slate-400">Document ID:</span>
              <span className="text-slate-300 ml-2 font-mono text-xs">{entry.documentId}</span>
            </div>
          </div>
        </div>

        {/* File Upload and Thumbnail */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-1 h-4 bg-gradient-to-b from-orange-500 to-red-600 rounded-full"></div>
            <label className="text-sm font-medium text-slate-300">Upload PDF</label>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* File input */}
            <div>
              <input
                type="file"
                accept=".pdf"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                className="w-full px-3 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
              />
              {fileError && (
                <div className="mt-2 bg-red-950/20 border border-red-900/20 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <p className="text-red-400 text-sm">{fileError}</p>
                  </div>
                </div>
              )}
              {file && (
                <div className="mt-2 bg-emerald-950/20 border border-emerald-900/20 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <p className="text-emerald-400 text-sm">
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  </div>
                  {fileHash && (
                    <p className="text-slate-400 text-xs mt-1 font-mono">Hash: {fileHash}</p>
                  )}
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

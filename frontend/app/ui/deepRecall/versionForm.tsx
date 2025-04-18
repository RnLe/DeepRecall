// versionForm.tsx

import React, { useState, useEffect, useRef } from "react";
import SparkMD5 from "spark-md5";
import { Literature, LiteratureExtended } from "../../types/literatureTypes";
import { VersionType } from "../../types/versionTypes";
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
}

const VersionForm: React.FC<VersionFormProps> = ({ versionType, entry, className, onSuccess }) => {
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
    if (key === "publishingDate") {
      return <input type="date" value={versionFields[key]||""}
        onChange={e=>setVersionFields(f=>({...f,[key]:e.target.value}))}
        className="mt-1 w-full border border-gray-600 bg-gray-700 p-2 text-white"/>;
    }
    if (typeof value === "number") {
      return <input type="number" value={versionFields[key]||0}
        onChange={e=>setVersionFields(f=>({...f,[key]:Number(e.target.value)}))}
        className="mt-1 w-full border border-gray-600 bg-gray-700 p-2 text-white"/>;
    }
    if (Array.isArray(value)) {
      return <select value={versionFields[key]||""}
        onChange={e=>setVersionFields(f=>({...f,[key]:e.target.value}))}
        className="mt-1 w-full border border-gray-600 bg-gray-700 p-2 text-white">
        <option value="">—</option>
        {value.map((opt:any,i)=> <option key={i} value={opt}>{opt}</option>)}
      </select>;
    }
    return <input type="text" value={versionFields[key]||""}
      onChange={e=>setVersionFields(f=>({...f,[key]:e.target.value}))}
      className="mt-1 w-full border border-gray-600 bg-gray-700 p-2 text-white"/>;
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
      setErrorMsg("This file/window already uploaded as a version.");
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
    <div className={`p-4 border rounded shadow mt-4 bg-gray-800 text-white ${className}`}>
      <h3 className="text-lg font-semibold mb-2">Create new version for: {entry.title}</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Document ID at top */}
        <div>
          <label className="block text-sm font-medium text-gray-300">Document ID:</label>
          <div className="mt-1 text-sm text-gray-400">
            {entry.documentId}
          </div>  
        </div>
        {/* Upload and thumbnail side-by-side */}
        <div className="flex gap-4">
          <div className="w-1/2">
            <label className="block text-sm font-medium text-gray-300">Upload PDF</label>
            <input
              type="file"
              accept=".pdf"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              className="mt-1 block w-full border border-gray-600 bg-gray-700 p-2 text-white"
            />
            {fileError && <p className="text-red-500 text-sm mt-1">{fileError}</p>}
            {file && (
              <p className="mt-1 text-sm text-gray-300">File Hash: {fileHash}</p>
            )}
          </div>
          <div className="w-1/2 flex items-center justify-center border border-gray-600 bg-gray-700 h-48">
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="Thumbnail" className="max-h-full" />
            ) : (
              <span className="text-gray-400">Thumbnail Preview</span>
            )}
          </div>
        </div>

        {/* Core Fields Section */}
        {recKeys.length > 0 && (
          <div className="border p-4 rounded">
            <h4 className="text-md font-semibold mb-2">Core Fields</h4>
            {recKeys.map(key => (
               <div key={key} className="mb-4">
                 <label className="block text-sm font-medium text-gray-300">{key}</label>
                 {renderField(key, versionTpl[key])}
               </div>
            ))}
          </div>
        )}

        {/* Additional Fields Section */}
        {customKeys.length > 0 && (
          <div className="border p-4 rounded mt-4">
            <h4 className="text-md font-semibold mb-2">Additional Fields</h4>
            {customKeys.map(key => (
              <div key={key} className="mb-4">
                <label className="block text-sm font-medium text-gray-300">{key}</label>
                {renderField(key, versionTpl[key])}
              </div>
            ))}
          </div>
        )}

        {errorMsg && <p className="text-red-500">{errorMsg}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`bg-green-500 text-white px-4 py-2 rounded ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}>
          {isSubmitting ? "Creating…" : "Submit"}
        </button>
      </form>
    </div>
  );
};

export default VersionForm;

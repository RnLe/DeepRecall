// versionForm.tsx
import React, { useState, useEffect, useRef } from "react";
import SparkMD5 from "spark-md5";
import { LiteratureType, Literature, LiteratureVersion, BaseVersion, TextbookVersion, PaperVersion, ScriptVersion, ThesisVersion } from '../helpers/literatureTypes';
import { LiteratureItem } from "./uploadWidget";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateLiterature } from "../api/literatureService";
import { uploadFile, UploadedFileInfo } from "../api/uploadFile";
import * as pdfjsLib from 'pdfjs-dist/webpack.mjs';
import { renderPdfPageToImage, dataURLtoFile } from "../helpers/pdfThumbnail";

// Compute PDF page count
const getPDFPageCount = async (file: File): Promise<number> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return pdf.numPages;
};

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
  mediaType: LiteratureType;
  entry: LiteratureItem;
  className?: string;
  onSuccess?: () => void;
}

const VersionForm: React.FC<VersionFormProps> = ({ mediaType, entry, className, onSuccess }) => {
  // File upload state (moved here)
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute file hash
  const [fileHash, setFileHash] = useState("");
  useEffect(() => {
    if (file) {
      computeMD5(file).then(hash => setFileHash(hash));
    }
  }, [file]);

  // Additional form fields for version creation:
  const [editionNumber, setEditionNumber] = useState("");
  const [versionNumber, setVersionNumber] = useState("");
  const [volume, setVolume] = useState("");
  const [pages, setPages] = useState("");
  const [scriptVersion, setScriptVersion] = useState("");
  const [year, setYear] = useState("");
  const [tasksPdf, setTasksPdf] = useState("");

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

  // Extract PDF page count when file changes
  const [pageCount, setPageCount] = useState<number | null>(null);
  useEffect(() => {
    if (file) {
      const getCount = async () => {
        try {
          const count = await getPDFPageCount(file);
          setPageCount(count);
        } catch (err) {
          console.error("Error getting page count", err);
          setPageCount(null);
        }
      };
      getCount();
    } else {
      setPageCount(null);
    }
  }, [file]);

  // Generate thumbnail when file changes
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  useEffect(() => {
    if (file) {
      renderPdfPageToImage(file, 1, 0.5)
        .then(url => {
          setThumbnailUrl(url);
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

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
  
    if (!file) {
      setErrorMsg("Please select a PDF file.");
      setIsSubmitting(false);
      return;
    }
  
    try {
      // Upload file and thumbnail, getting both ID and URL
      const uploadedFile: UploadedFileInfo = await uploadFile(file);
      const uploadedThumbnail: UploadedFileInfo = await uploadFile(thumbnail);
      const pageCountValue = await getPDFPageCount(file);
      const fileSize = file.size;
  
      // Create a common base version with shared properties
      // BaseVersion is defined in your types (see previous refactoring) with common fields
      const baseVersion: BaseVersion = {
        year: Number(year),
        file_hash: fileHash,
        file_id: uploadedFile.id,
        file_url: uploadedFile.url, // new field for file URL
        thumbnail_media_id: uploadedThumbnail.id,
        thumbnail_url: uploadedThumbnail.url, // new field for thumbnail URL
        page_count: pageCountValue,
        file_size: fileSize,
      };
  
      // Create the appropriate literature version based on media type
      let newVersion: LiteratureVersion;
      switch (mediaType) {
        case "Textbook": {
          newVersion = {
            ...baseVersion,
            edition_number: Number(editionNumber),
          } as TextbookVersion;
          break;
        }
        case "Paper": {
          newVersion = {
            ...baseVersion,
            version_number: versionNumber || undefined,
            volume: volume || undefined,
            pages: pages || undefined,
          } as PaperVersion;
          break;
        }
        case "Script": {
          newVersion = {
            ...baseVersion,
            version: scriptVersion || undefined,
          } as ScriptVersion;
          break;
        }
        case "Thesis": {
          newVersion = {
            ...baseVersion,
          } as ThesisVersion;
          break;
        }
        default:
          throw new Error("Unsupported media type");
      }
  
      const currentVersions = entry.metadata.versions || [];
      const newMetadata = {
        ...entry.metadata,
        versions: [...currentVersions, newVersion],
      };
  
      await updateLiteratureMutation.mutateAsync({
        documentId: entry.documentId,
        data: { type_metadata: newMetadata },
      });
  
      console.log("Updated literature with new version.");
  
      // Reset fields on success
      setEditionNumber("");
      setYear("");
      setTasksPdf("");
      setScriptVersion("");
      setVersionNumber("");
      setVolume("");
      setPages("");
      setFile(null);
      setThumbnail(null);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`p-4 border rounded shadow mt-4 ${className}`}>
      <h3 className="text-lg font-semibold mb-2">
        Create new version for: {entry.title}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* File Upload Field */}
        <div>
          <label className="block text-sm font-medium">Upload PDF</label>
          <input
            type="file"
            accept=".pdf"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            className="mt-1 block w-full border border-gray-300 p-2"
          />
          {fileError && <p className="text-red-500 text-sm">{fileError}</p>}
        </div>

        {/* File Hash Field (read-only) */}
        <div>
          <label className="block text-sm font-medium">File Hash</label>
          <input
            type="text"
            value={fileHash}
            disabled
            className="mt-1 block w-full bg-gray-200 border-gray-300 p-2"
          />
        </div>

        {/* Relation Field (read-only) */}
        <div>
          <label className="block text-sm font-medium">{mediaType} ID</label>
          <input
            type="text"
            value={entry.documentId}
            disabled
            className="mt-1 block w-full bg-gray-200 border-gray-300 p-2"
          />
        </div>

        {/* Common Field: Year */}
        <div>
          <label className="block text-sm font-medium">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            required
            className="mt-1 block w-full border border-gray-300 p-2"
          />
        </div>

        {mediaType === "Textbook" && (
          <>
            <div>
              <label className="block text-sm font-medium">Edition Number</label>
              <input
                type="number"
                value={editionNumber}
                onChange={(e) => setEditionNumber(e.target.value)}
                required
                className="mt-1 block w-full border border-gray-300 p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Tasks PDF (optional)</label>
              <input
                type="text"
                value={tasksPdf}
                onChange={(e) => setTasksPdf(e.target.value)}
                className="mt-1 block w-full border border-gray-300 p-2"
              />
            </div>
          </>
        )}

        {mediaType === "Paper" && (
          <>
            <div>
              <label className="block text-sm font-medium">Version Number (optional)</label>
              <input
                type="text"
                value={versionNumber}
                onChange={(e) => setVersionNumber(e.target.value)}
                className="mt-1 block w-full border border-gray-300 p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Volume (optional)</label>
              <input
                type="text"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                className="mt-1 block w-full border border-gray-300 p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Pages (optional)</label>
              <input
                type="text"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                className="mt-1 block w-full border border-gray-300 p-2"
              />
            </div>
          </>
        )}

        {mediaType === "Script" && (
          <div>
            <label className="block text-sm font-medium">Version (optional)</label>
            <input
              type="text"
              value={scriptVersion}
              onChange={(e) => setScriptVersion(e.target.value)}
              className="mt-1 block w-full border border-gray-300 p-2"
            />
          </div>
        )}

        {/* No extra fields for Thesis beyond Year */}

        {errorMsg && <p className="text-red-500">{errorMsg}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`bg-green-500 text-white px-4 py-2 rounded ${
            isSubmitting ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {isSubmitting ? "Creating…" : "Submit"}
        </button>
      </form>
    </div>
  );
};

export default VersionForm;

// versionForm.tsx
import React, { useState, useEffect } from "react";
import SparkMD5 from "spark-md5";
import { MediaType, TextbookVersionPayload, ScriptVersionPayload, PaperVersionPayload } from "../helpers/mediaTypes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTextbookVersion } from "../api/textbooks";
import { createPaperVersion } from "../api/papers";
import { createScriptVersion } from "../api/scripts";
import { uploadFile } from "../api/uploadFile";

import * as pdfjsLib from 'pdfjs-dist/webpack.mjs';

const getPDFPageCount = async (file: File): Promise<number> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return pdf.numPages;
};

// Helper: Compute MD5 hash of the file using spark-md5
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

// Props interface for VersionForm
interface VersionFormProps {
  mediaType: MediaType;
  file: File;
  thumbnail: File;
  entry: {
    id: number;
    title: string;
    type: MediaType;
  };
  className?: string;
  onSuccess?: () => void; // callback prop
}

const VersionForm: React.FC<VersionFormProps> = ({ mediaType, file, entry, className, thumbnail, onSuccess }) => {
    // State for file hash
    const [fileHash, setFileHash] = useState("");
    // State for Textbook-specific fields:
    const [editionNumber, setEditionNumber] = useState("");
    const [year, setYear] = useState("");
    const [tasksPdf, setTasksPdf] = useState("");
    // State for Script-specific fields:
    const [scriptVersion, setScriptVersion] = useState("");
    // State for Paper-specific fields:
    const [versionNumber, setVersionNumber] = useState("");
    const [volume, setVolume] = useState("");
    const [pages, setPages] = useState("");

    // State for error and loading
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Compute the file hash when the file changes
    useEffect(() => {
        if (file) {
        computeMD5(file).then((hash) => setFileHash(hash));
        }
    }, [file]);

    // Get react-query's queryClient instance
    const queryClient = useQueryClient();

    // Define mutation hooks for each version type
    const createTextbookVersionMutation = useMutation<
    TextbookVersionPayload,
    Error,
    Omit<TextbookVersionPayload, "id">
    >({
    mutationFn: createTextbookVersion,            // mutation function
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["literature"] }),
    onError: (error) => console.error("Failed to create textbook version:", error),
    });

    const createPaperVersionMutation = useMutation<
    PaperVersionPayload,
    Error,
    Omit<PaperVersionPayload, "id">
    >({
    mutationFn: createPaperVersion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["literature"] }),
    onError: (error) => console.error("Failed to create paper version:", error),
    });

    const createScriptVersionMutation = useMutation<
    ScriptVersionPayload,
    Error,
    Omit<ScriptVersionPayload, "id">
    >({
    mutationFn: createScriptVersion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["literature"] }),
    onError: (error) => console.error("Failed to create script version:", error),
    });


  // Handle form submission to create a new version entry
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      let created;
      switch (mediaType) {
        case "Textbook": {
          // Build payload for textbook version
          // First, try to upload the file to the server
          const uploadedFileId = await uploadFile(file);
          const uploadedThumbnailId = await uploadFile(thumbnail);
          const payload: Omit<TextbookVersionPayload, "id"> = {
            file_hash: fileHash,
            textbook: entry.id,
            edition_number: Number(editionNumber),
            year: Number(year),
            tasks_pdf: tasksPdf ? tasksPdf : undefined,
            pdf_file: uploadedFileId,
            thumbnail: uploadedThumbnailId,
            page_count: await getPDFPageCount(file),
            file_size: file.size,
          };
          created = await createTextbookVersionMutation.mutateAsync(payload);
          break;
        }
        case "Paper": {
          const uploadedFileId = await uploadFile(file);
          const uploadedThumbnailId = await uploadFile(thumbnail);
          const payload: Omit<PaperVersionPayload, "id"> = {
            file_hash: fileHash,
            paper: entry.id,
            version_number: versionNumber ? versionNumber : undefined,
            year: Number(year),
            volume: volume ? volume : undefined,
            pages: pages ? pages : undefined,
            pdf_file: uploadedFileId,
            thumbnail: uploadedThumbnailId,
            page_count: await getPDFPageCount(file),
            file_size: file.size,
          };
          created = await createPaperVersionMutation.mutateAsync(payload);
          break;
        }
        case "Script": {
            const uploadedFileId = await uploadFile(file);
          const uploadedThumbnailId = await uploadFile(thumbnail);
          const payload: Omit<ScriptVersionPayload, "id"> = {
            file_hash: fileHash,
            script: entry.id,
            year: Number(year),
            version: scriptVersion ? scriptVersion : undefined,
            pdf_file: uploadedFileId,
            thumbnail: uploadedThumbnailId,
            page_count: await getPDFPageCount(file),
            file_size: file.size,
          };
          created = await createScriptVersionMutation.mutateAsync(payload);
          break;
        }
        default:
          throw new Error("Unsupported media type");
      }
      console.log("Created version entry:", created);
      // Optional: Reset form fields on success
      setEditionNumber("");
      setYear("");
      setTasksPdf("");
      setScriptVersion("");
      setVersionNumber("");
      setVolume("");
      setPages("");

      // Notify the parent that the submission was successful
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
            value={entry.id}
            disabled
            className="mt-1 block w-full bg-gray-200 border-gray-300 p-2"
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
              <label className="block text-sm font-medium">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
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

        {mediaType === "Script" && (
          <>
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
            <div>
              <label className="block text-sm font-medium">Version (optional)</label>
              <input
                type="text"
                value={scriptVersion}
                onChange={(e) => setScriptVersion(e.target.value)}
                className="mt-1 block w-full border border-gray-300 p-2"
              />
            </div>
          </>
        )}

        {mediaType === "Paper" && (
          <>
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

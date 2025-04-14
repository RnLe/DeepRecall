// versionForm.tsx

import React, { useState, useEffect, useRef } from "react";
import SparkMD5 from "spark-md5";
import { Literature, LiteratureType, LiteratureVersion } from "../../helpers/literatureTypes";
import { LiteratureItem } from "@/app/helpers/literatureTypesLegacy";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateLiterature } from "../../api/literatureService";
import { uploadFile, UploadedFileInfo } from "../../api/uploadFile";
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
  mediaType: LiteratureType;
  entry: LiteratureItem;
  className?: string;
  onSuccess?: () => void;
}

const VersionForm: React.FC<VersionFormProps> = ({ mediaType, entry, className, onSuccess }) => {
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

  // Dynamic extra version fields are assumed to be defined in the literature type's versionMetadata.
  // This simulates a LiteratureVersionType structure.
  const [versionAdditionalFields, setVersionAdditionalFields] = useState<Record<string, any>>({});
  useEffect(() => {
    try {
      let template;
      // Assume mediaType.versionMetadata exists and is a JSON string.
      if (mediaType.versionMetadata && typeof mediaType.versionMetadata === "string") {
        template = mediaType.versionMetadata ? JSON.parse(mediaType.versionMetadata) : {};
      } else {
        template = mediaType.versionMetadata || {};
      }
      setVersionAdditionalFields(template);
    } catch (err) {
      setVersionAdditionalFields({});
      console.error("Error parsing version metadata:", err);
    }
  }, [mediaType]);

  // Render an input for a dynamic version field based on the field's default type.
  const renderVersionField = (key: string, value: any) => {
    if (Array.isArray(value)) {
      return (
        <select
          value={versionAdditionalFields[key]}
          onChange={(e) =>
            setVersionAdditionalFields((prev) => ({ ...prev, [key]: e.target.value }))
          }
          className="mt-1 block w-full border border-gray-600 bg-gray-700 p-2 text-white"
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
          value={versionAdditionalFields[key]}
          onChange={(e) =>
            setVersionAdditionalFields((prev) => ({ ...prev, [key]: Number(e.target.value) }))
          }
          className="mt-1 block w-full border border-gray-600 bg-gray-700 p-2 text-white"
        />
      );
    } else {
      return (
        <input
          type="text"
          value={versionAdditionalFields[key]}
          onChange={(e) =>
            setVersionAdditionalFields((prev) => ({ ...prev, [key]: e.target.value }))
          }
          className="mt-1 block w-full border border-gray-600 bg-gray-700 p-2 text-white"
        />
      );
    }
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

    try {
      // Upload file and thumbnail.
      const uploadedFile: UploadedFileInfo = await uploadFile(file);
      const uploadedThumbnail: UploadedFileInfo = thumbnail ? await uploadFile(thumbnail) : { id: 0, url: "" };

      // Create a new version object using the new structure.
      const newVersion: LiteratureVersion = {
        fileUrl: uploadedFile.url,
        thumbnailUrl: uploadedThumbnail.url,
        metadata: JSON.stringify(versionAdditionalFields),
        file_hash: fileHash,
      };

      // Parse current metadata from the literature entry and add the new version.
      const currentMetadata = entry.metadata ? JSON.parse(entry.metadata) : {};
      const currentVersions = currentMetadata.versions || [];
      currentMetadata.versions = [...currentVersions, newVersion];

      // Update the literature entry.
      await updateLiteratureMutation.mutateAsync({
        documentId: entry.documentId,
        data: { metadata: JSON.stringify(currentMetadata) },
      });

      console.log("Updated literature with new version.");

      // Reset fields on success.
      setFile(null);
      setThumbnail(null);
      setThumbnailUrl(null);
      setVersionAdditionalFields({});
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
        {/* File Upload Field */}
        <div>
          <label className="block text-sm font-medium text-gray-300">Upload PDF</label>
          <input
            type="file"
            accept=".pdf"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            className="mt-1 block w-full border border-gray-600 bg-gray-700 p-2 text-white"
          />
          {fileError && <p className="text-red-500 text-sm">{fileError}</p>}
          {file && (
            <p className="mt-1 text-sm text-gray-300">
              File Hash: {fileHash}
            </p>
          )}
        </div>

        {/* Document ID Field (read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-300">Document ID</label>
          <div className="mt-1 block w-full bg-gray-700 border border-gray-600 p-2 text-white">
            {entry.documentId}
          </div>
        </div>

        {/* Dynamically Render Version-Specific Extra Fields */}
        <div className="p-4 border border-gray-600 rounded">
          <h4 className="text-md font-semibold mb-2">Additional version-specific attributes</h4>
          {Object.keys(versionAdditionalFields).length === 0 ? (
            <p className="text-gray-400">No additional attributes defined</p>
          ) : (
            Object.entries(versionAdditionalFields).map(([key, value]) => (
              <div key={key} className="mb-4">
                <label className="block text-sm font-medium text-gray-300 capitalize">
                  {key}
                </label>
                {renderVersionField(key, value)}
              </div>
            ))
          )}
        </div>

        {errorMsg && <p className="text-red-500">{errorMsg}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`bg-green-500 text-white px-4 py-2 rounded ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {isSubmitting ? "Creating…" : "Submit"}
        </button>
      </form>
    </div>
  );
};

export default VersionForm;

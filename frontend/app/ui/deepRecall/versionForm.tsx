// versionForm.tsx
import React, { useState, useEffect, useRef } from "react";
import SparkMD5 from "spark-md5";
import {
  LiteratureType,
  Literature,
  LiteratureVersion,
  BaseVersion,
  LITERATURE_VERSION_FORM_FIELDS,
} from "../../helpers/literatureTypes";
import { LiteratureItem } from "./uploadWidget";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateLiterature } from "../../api/literatureService";
import { uploadFile, UploadedFileInfo } from "../../api/uploadFile";
import * as pdfjsLib from "pdfjs-dist/webpack.mjs";
import { renderPdfPageToImage, dataURLtoFile } from "../../helpers/pdfThumbnail";

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
  // File upload state
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute file hash
  const [fileHash, setFileHash] = useState("");
  useEffect(() => {
    if (file) {
      computeMD5(file).then((hash) => setFileHash(hash));
    }
  }, [file]);

  // Common field: Year
  const [year, setYear] = useState("");

  // Extra version-specific fields (state is keyed by field names)
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});
  useEffect(() => {
    const fields = LITERATURE_VERSION_FORM_FIELDS[mediaType] || [];
    const initial: Record<string, string> = {};
    fields.forEach((field) => {
      initial[field.name] = "";
    });
    setExtraFields(initial);
  }, [mediaType]);

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

  // Get PDF page count when file changes
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

  // Handle extra field changes dynamically
  const handleExtraFieldChange = (fieldName: string, value: string) => {
    setExtraFields((prev) => ({ ...prev, [fieldName]: value }));
  };

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
      // Upload file and thumbnail
      const uploadedFile: UploadedFileInfo = await uploadFile(file);
      const uploadedThumbnail: UploadedFileInfo = await uploadFile(thumbnail);
      const pageCountValue = await getPDFPageCount(file);
      const fileSize = file.size;

      // Create common base version
      const baseVersion: BaseVersion = {
        year: Number(year),
        file_hash: fileHash,
        file_id: uploadedFile.id,
        file_url: uploadedFile.url,
        thumbnail_media_id: uploadedThumbnail.id,
        thumbnail_url: uploadedThumbnail.url,
        page_count: pageCountValue,
        file_size: fileSize,
      };

      // Convert extra fields from string to proper types
      const fieldsConfig = LITERATURE_VERSION_FORM_FIELDS[mediaType] || [];
      const extraVersionFields: Record<string, any> = {};
      fieldsConfig.forEach((field) => {
        if (extraFields[field.name] !== "") {
          extraVersionFields[field.name] =
            field.type === "number" ? Number(extraFields[field.name]) : extraFields[field.name];
        }
      });

      // Combine into new version
      const newVersion: LiteratureVersion = { ...baseVersion, ...extraVersionFields };

      const currentVersions = entry.metadata.versions || [];
      const newMetadata = { ...entry.metadata, versions: [...currentVersions, newVersion] };

      await updateLiteratureMutation.mutateAsync({
        documentId: entry.documentId,
        data: { type_metadata: newMetadata },
      });

      console.log("Updated literature with new version.");

      // Reset fields on success
      setYear("");
      setExtraFields({});
      setFile(null);
      setThumbnail(null);
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
        </div>

        {/* File Hash Field (read-only) */}
        <div>
          <label className="block text-sm font-medium">File Hash</label>
          <input type="text" value={fileHash} disabled className="mt-1 block w-full bg-gray-700 border-gray-600 p-2 text-white" />
        </div>

        {/* Relation Field (read-only) */}
        <div>
          <label className="block text-sm font-medium">{mediaType} ID</label>
          <input type="text" value={entry.documentId} disabled className="mt-1 block w-full bg-gray-700 border-gray-600 p-2 text-white" />
        </div>

        {/* Common Field: Year */}
        <div>
          <label className="block text-sm font-medium">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            required
            className="mt-1 block w-full border border-gray-600 bg-gray-700 p-2 text-white"
          />
        </div>

        {/* Dynamically Render Version-Specific Extra Fields */}
        {LITERATURE_VERSION_FORM_FIELDS[mediaType]?.map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium">
              {field.label}{field.required ? " *" : ""}
            </label>
            <input
              type={field.type}
              value={extraFields[field.name] || ""}
              onChange={(e) => handleExtraFieldChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className="mt-1 block w-full border border-gray-600 bg-gray-700 p-2 text-white"
              required={field.required}
            />
          </div>
        ))}

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

/**
 * UploadButton - Mobile file upload button
 * Opens native file picker for PDFs, images, and markdown
 */

import { Upload } from "lucide-react";
import { useState } from "react";
import { useFileUpload } from "../../../utils/fileUpload";

export function UploadButton() {
  const { uploadFiles } = useFileUpload();
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (isUploading) return;

    try {
      setIsUploading(true);
      const result = await uploadFiles();

      if (result.success > 0) {
        alert(`Successfully uploaded ${result.success} file(s)!`);
      }

      if (result.failed > 0) {
        console.error("Upload errors:", result.errors);
        alert(
          `Failed to upload ${result.failed} file(s). Check console for details.`
        );
      }

      if (result.success === 0 && result.failed === 0) {
        // User cancelled
        console.log("Upload cancelled");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload files");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <button
      onClick={handleUpload}
      disabled={isUploading}
      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
      title="Upload files (PDF, PNG, JPG, MD)"
    >
      <Upload className="w-4 h-4" />
      <span>{isUploading ? "Uploading..." : "Upload Files"}</span>
    </button>
  );
}

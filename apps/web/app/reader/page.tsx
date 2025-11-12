/**
 * Reader page - VSCode-style PDF reader with tabs and sidebars
 */

"use client";

// ========================================
// PURE UI IMPORTS (from @deeprecall/ui)
// ========================================
import {
  ReaderLayout,
  type AnnotationEditorComponentProps,
} from "@deeprecall/ui";
import {
  AnnotationEditor,
  type AnnotationEditorOperations,
} from "@deeprecall/ui";

// ========================================
// PLATFORM WRAPPERS (from ./_components)
// ========================================
import { TabContent } from "./_components/TabContent";

// ========================================
// PLATFORM HOOKS & UTILITIES
// ========================================
import {
  createAssetLocal,
  updateAssetLocal,
} from "@deeprecall/data/repos/assets.local";
import { getDeviceId } from "@deeprecall/data/utils/deviceId";
import { attachAssetToAnnotation } from "@deeprecall/data/repos/annotations";
import { PDFViewer } from "./PDFViewer";

// ============================================================================
// Platform-specific Component Wrappers
// ============================================================================

/**
 * AnnotationEditor with web-specific operations
 */
function WebAnnotationEditor(props: AnnotationEditorComponentProps) {
  const operations: AnnotationEditorOperations = {
    // Blob operations
    getBlobUrl: (sha256) => `/api/blob/${sha256}`,

    fetchBlobContent: async (sha256) => {
      const response = await fetch(`/api/blob/${sha256}`);
      if (!response.ok) {
        throw new Error("Failed to fetch blob content");
      }
      return await response.text();
    },

    // Markdown creation
    createMarkdown: async ({ content, title, annotationId }) => {
      const deviceId = getDeviceId();
      const response = await fetch("/api/library/create-markdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, title, annotationId, deviceId }),
      });

      if (!response.ok) {
        throw new Error("Failed to create markdown note");
      }

      const { blob } = await response.json();
      return {
        sha256: blob.sha256,
        filename: blob.filename,
        size: blob.size,
        mime: blob.mime,
      };
    },

    // File upload
    uploadFile: async ({ file, annotationId, title }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "metadata",
        JSON.stringify({
          role: "notes",
          purpose: "annotation-note",
          annotationId,
          title,
        })
      );

      const response = await fetch("/api/library/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const { blob } = await response.json();
      return {
        sha256: blob.sha256,
        filename: blob.filename,
        size: blob.size,
        mime: blob.mime,
      };
    },

    // Create note asset (optimistic)
    createNoteAsset: async (params) => {
      const asset = await createAssetLocal({
        sha256: params.sha256,
        filename: params.filename,
        bytes: params.bytes,
        mime: params.mime,
        role: "notes",
        purpose: params.purpose as
          | "annotation-note"
          | "work-note"
          | "activity-note",
        userTitle: params.title,
        annotationId: params.annotationId,
        favorite: false,
      });
      return { id: asset.id };
    },

    // Attach asset to annotation
    attachAssetToAnnotation: async (annotationId, assetId) => {
      await attachAssetToAnnotation(annotationId, assetId);
    },

    // Update asset metadata (optimistic)
    updateAssetMetadata: async (assetId, metadata) => {
      await updateAssetLocal(assetId, {
        userTitle: metadata.userTitle,
        userDescription: metadata.userDescription,
      });
    },
  };

  return <AnnotationEditor {...props} operations={operations} />;
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function ReaderPage() {
  return (
    <div className="h-full">
      <ReaderLayout AnnotationEditorComponent={WebAnnotationEditor}>
        <TabContent />
      </ReaderLayout>
    </div>
  );
}

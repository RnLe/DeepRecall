/**
 * Reader page - Mobile implementation
 * VSCode-style PDF reader with tabs and sidebars
 */

// ========================================
// PURE UI IMPORTS (from @deeprecall/ui)
// ========================================
import {
  ReaderLayout,
  type AnnotationEditorComponentProps,
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
  useCapacitorBlobStorage,
  fetchBlobContent,
  createMarkdownBlob,
} from "../../blob-storage/capacitor";
import { assets, annotations } from "@deeprecall/data";

// ============================================================================
// Platform-specific Component Wrappers
// ============================================================================

/**
 * AnnotationEditor with mobile-specific operations
 */
function MobileAnnotationEditor(props: AnnotationEditorComponentProps) {
  const cas = useCapacitorBlobStorage();

  const operations: AnnotationEditorOperations = {
    // Blob operations
    getBlobUrl: (sha256) => cas.getUrl(sha256),

    fetchBlobContent: async (sha256) => {
      return await fetchBlobContent(sha256);
    },

    // Markdown creation
    createMarkdown: async ({ content, title }) => {
      const result = await createMarkdownBlob(content, title);
      return {
        sha256: result.sha256,
        filename: result.filename,
        size: result.size,
        mime: result.mime,
      };
    },

    // File upload
    uploadFile: async ({ file }) => {
      const blob = new Blob([file], { type: file.type });
      const result = await cas.put(blob, {
        filename: file.name,
        mime: file.type || "application/octet-stream",
      });

      return {
        sha256: result.sha256,
        filename: result.filename || file.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
      };
    },

    // Create note asset (optimistic)
    createNoteAsset: async (params) => {
      const asset = await assets.createNoteAsset({
        sha256: params.sha256,
        filename: params.filename,
        bytes: params.bytes,
        mime: params.mime,
        purpose: params.purpose as
          | "annotation-note"
          | "work-note"
          | "activity-note",
        title: params.title,
        annotationId: params.annotationId,
      });
      return { id: asset.id };
    },

    // Attach asset to annotation
    attachAssetToAnnotation: async (annotationId, assetId) => {
      await annotations.attachAssetToAnnotation(annotationId, assetId);
    },

    // Update asset metadata (optimistic)
    updateAssetMetadata: async (assetId, metadata) => {
      await assets.updateAssetMetadata(assetId, {
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
      <ReaderLayout AnnotationEditorComponent={MobileAnnotationEditor}>
        <TabContent />
      </ReaderLayout>
    </div>
  );
}

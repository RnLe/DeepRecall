/**
 * AnnotationEditor - Mobile wrapper for platform-agnostic AnnotationEditor
 * Injects all platform-specific operations
 */

import {
  AnnotationEditor as AnnotationEditorUI,
  type AnnotationEditorOperations,
} from "@deeprecall/ui";
import { assets, annotations } from "@deeprecall/data";
import {
  useCapacitorBlobStorage,
  fetchBlobContent,
  createMarkdownBlob,
} from "../../../blob-storage/capacitor";

interface AnnotationEditorProps {
  sha256: string;
  onAnnotationDeleted?: () => void;
  onAnnotationUpdated?: () => void;
}

export function AnnotationEditor(props: AnnotationEditorProps) {
  const cas = useCapacitorBlobStorage();

  const operations: AnnotationEditorOperations = {
    // Blob operations
    getBlobUrl: (sha256: string) => cas.getUrl(sha256),

    fetchBlobContent: async (sha256: string) => {
      return await fetchBlobContent(sha256);
    },

    // Markdown creation
    createMarkdown: async ({
      content,
      title,
    }: {
      content: string;
      title: string;
      annotationId?: string;
    }) => {
      const blob = await createMarkdownBlob(content, title);
      return {
        sha256: blob.sha256,
        filename: blob.filename,
        size: blob.size,
        mime: blob.mime,
      };
    },

    // File upload
    uploadFile: async ({
      file,
      title,
    }: {
      file: File;
      annotationId?: string;
      title: string;
    }) => {
      const blobMetadata = await cas.put(file, {
        filename: title || file.name,
        mime: file.type,
      });

      return {
        sha256: blobMetadata.sha256,
        filename: blobMetadata.filename || file.name,
        size: blobMetadata.size,
        mime: blobMetadata.mime || file.type,
      };
    },

    // Create note asset (optimistic)
    createNoteAsset: async (params: {
      sha256: string;
      filename: string;
      bytes: number;
      mime: string;
      purpose: string;
      title: string;
      annotationId?: string;
    }) => {
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
    attachAssetToAnnotation: async (annotationId: string, assetId: string) => {
      await annotations.attachAssetToAnnotation(annotationId, assetId);
    },

    // Update asset metadata (optimistic)
    updateAssetMetadata: async (
      assetId: string,
      metadata: Record<string, unknown>
    ) => {
      await assets.updateAssetMetadata(assetId, metadata);
    },
  };

  return <AnnotationEditorUI {...props} operations={operations} />;
}

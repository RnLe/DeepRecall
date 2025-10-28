/**
 * Mobile platform wrapper for CreateNoteDialog
 * Implements platform-specific operations for Capacitor/Mobile
 */

import {
  CreateNoteDialog as CreateNoteDialogUI,
  type CreateNoteDialogProps as BaseProps,
  type CreateNoteDialogOperations,
} from "@deeprecall/ui";
import { annotations, assets } from "@deeprecall/data";
import {
  useCapacitorBlobStorage,
  createMarkdownBlob,
} from "../../../blob-storage/capacitor";

/** Mobile-specific props (operations auto-injected) */
export type CreateNoteDialogProps = Omit<BaseProps, "operations">;

/**
 * Mobile-specific CreateNoteDialog with Capacitor operations
 */
export function CreateNoteDialog(props: CreateNoteDialogProps) {
  const cas = useCapacitorBlobStorage();

  const operations: CreateNoteDialogOperations = {
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

    createNoteAsset: async (params) => {
      const asset = await assets.createNoteAsset(params);
      return { id: asset.id };
    },

    attachAssetToAnnotation: async (annotationId, assetId) => {
      await annotations.attachAssetToAnnotation(annotationId, assetId);
    },
  };

  return <CreateNoteDialogUI {...props} operations={operations} />;
}

/**
 * Web platform wrapper for CreateNoteDialog
 * Implements platform-specific operations for Next.js/Web
 */

"use client";

import {
  CreateNoteDialog as CreateNoteDialogUI,
  CreateNoteDialogProps as BaseProps,
  CreateNoteDialogOperations,
} from "@deeprecall/ui/reader/CreateNoteDialog";
import * as annotationRepo from "@deeprecall/data/repos/annotations";
import * as assetRepo from "@deeprecall/data/repos/assets";
import { getDeviceId } from "@deeprecall/data/utils/deviceId";

/** Web-specific props (operations auto-injected) */
export type CreateNoteDialogProps = Omit<BaseProps, "operations">;

/**
 * Web-specific CreateNoteDialog with server API operations
 */
export function CreateNoteDialog(props: CreateNoteDialogProps) {
  const operations: CreateNoteDialogOperations = {
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

    createNoteAsset: async (params) => {
      const asset = await assetRepo.createNoteAsset(params);
      return { id: asset.id };
    },

    attachAssetToAnnotation: async (annotationId, assetId) => {
      await annotationRepo.attachAssetToAnnotation(annotationId, assetId);
    },
  };

  return <CreateNoteDialogUI {...props} operations={operations} />;
}

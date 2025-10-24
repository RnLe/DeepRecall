/**
 * AnnotationOverlay - Next.js wrapper for platform-agnostic AnnotationOverlay
 * Injects navigation and file upload operations
 */

"use client";

import { useRouter } from "next/navigation";
import {
  AnnotationOverlay as AnnotationOverlayUI,
  type AnnotationOverlayProps as BaseProps,
} from "@deeprecall/ui";
import { createAssetLocal } from "@deeprecall/data/repos/assets.local";
import { attachAssetToAnnotation } from "@deeprecall/data/repos/annotations";

/** Web-specific props (operations auto-injected) */
export type AnnotationOverlayProps = Omit<
  BaseProps,
  "navigateToAnnotation" | "uploadAndAttachNote"
>;

export function AnnotationOverlay(props: AnnotationOverlayProps) {
  const router = useRouter();

  const uploadAndAttachNote = async (annotationId: string, file: File) => {
    // Upload file to server
    const formData = new FormData();
    formData.append("file", file);
    formData.append(
      "metadata",
      JSON.stringify({
        role: "notes",
        annotationId,
        purpose: "annotation-note",
      })
    );

    const response = await fetch("/api/library/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Upload failed");
    }

    const { blob } = await response.json();

    // Create Asset (optimistic)
    const asset = await createAssetLocal({
      sha256: blob.sha256,
      filename: blob.filename,
      bytes: blob.size,
      mime: blob.mime,
      role: "notes",
      annotationId,
      userTitle: file.name,
      purpose: "annotation-note",
      favorite: false,
    });

    // Attach to annotation
    await attachAssetToAnnotation(annotationId, asset.id);
  };

  return (
    <AnnotationOverlayUI
      {...props}
      navigateToAnnotation={(id) => router.push(`/reader/annotation/${id}`)}
      uploadAndAttachNote={uploadAndAttachNote}
    />
  );
}

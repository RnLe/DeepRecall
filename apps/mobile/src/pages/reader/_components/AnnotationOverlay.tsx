/**
 * AnnotationOverlay - Mobile wrapper for platform-agnostic AnnotationOverlay
 * Injects navigation and file upload operations
 */

import { useNavigate } from "react-router-dom";
import {
  AnnotationOverlay as AnnotationOverlayUI,
  type AnnotationOverlayProps as BaseProps,
} from "@deeprecall/ui";
import { assets, annotations } from "@deeprecall/data";
import { useCapacitorBlobStorage } from "../../../blob-storage/capacitor";

/** Mobile-specific props (operations auto-injected) */
export type AnnotationOverlayProps = Omit<
  BaseProps,
  "navigateToAnnotation" | "uploadAndAttachNote"
>;

export function AnnotationOverlay(props: AnnotationOverlayProps) {
  const navigate = useNavigate();
  const cas = useCapacitorBlobStorage();

  const uploadAndAttachNote = async (annotationId: string, file: File) => {
    // Upload file using Capacitor storage
    const blobMetadata = await cas.put(file, {
      filename: file.name,
      mime: file.type,
    });

    // Create Asset (optimistic)
    const asset = await assets.createNoteAsset({
      sha256: blobMetadata.sha256,
      filename: blobMetadata.filename || file.name,
      bytes: blobMetadata.size,
      mime: blobMetadata.mime || file.type,
      purpose: "annotation-note",
      title: file.name,
      annotationId,
    });

    // Attach to annotation
    await annotations.attachAssetToAnnotation(annotationId, asset.id);
  };

  return (
    <AnnotationOverlayUI
      {...props}
      navigateToAnnotation={(id) => navigate(`/reader/annotation/${id}`)}
      uploadAndAttachNote={uploadAndAttachNote}
    />
  );
}

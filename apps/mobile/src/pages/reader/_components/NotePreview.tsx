/**
 * Mobile platform wrapper for NotePreview
 * Implements platform-specific operations for Capacitor/Mobile
 */

import {
  NotePreview as NotePreviewUI,
  type NotePreviewProps as BaseProps,
  type NotePreviewOperations,
} from "@deeprecall/ui";
import {
  useCapacitorBlobStorage,
  fetchBlobContent,
} from "../../../blob-storage/capacitor";

/** Mobile-specific props (operations auto-injected) */
export type NotePreviewProps = Omit<BaseProps, "operations">;

/**
 * Mobile-specific NotePreview with Capacitor operations
 */
export function NotePreview(props: NotePreviewProps) {
  const cas = useCapacitorBlobStorage();

  const operations: NotePreviewOperations = {
    fetchBlobContent: async (sha256: string) => {
      return await fetchBlobContent(sha256);
    },

    getBlobUrl: (sha256: string) => cas.getUrl(sha256),
  };

  return <NotePreviewUI {...props} operations={operations} />;
}

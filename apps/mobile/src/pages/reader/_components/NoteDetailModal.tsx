/**
 * Mobile platform wrapper for NoteDetailModal
 * Implements platform-specific operations for Capacitor/Mobile
 */

import {
  NoteDetailModal as NoteDetailModalUI,
  type NoteDetailModalProps as BaseProps,
  type NoteDetailModalOperations,
} from "@deeprecall/ui";
import { assets } from "@deeprecall/data";
import {
  useCapacitorBlobStorage,
  fetchBlobContent,
} from "../../../blob-storage/capacitor";

/** Mobile-specific props (operations auto-injected) */
export type NoteDetailModalProps = Omit<BaseProps, "operations">;

/**
 * Mobile-specific NoteDetailModal with Capacitor operations
 */
export function NoteDetailModal(props: NoteDetailModalProps) {
  const cas = useCapacitorBlobStorage();

  const operations: NoteDetailModalOperations = {
    fetchBlobContent: async (sha256: string) => {
      return await fetchBlobContent(sha256);
    },

    getBlobUrl: (sha256: string) => cas.getUrl(sha256),

    updateAssetMetadata: async (
      assetId: string,
      metadata: Record<string, unknown>
    ) => {
      await assets.updateAssetMetadata(assetId, metadata);
    },
  };

  return <NoteDetailModalUI {...props} operations={operations} />;
}

/**
 * CompactNoteItem - Mobile wrapper for platform-agnostic CompactNoteItem
 * Injects blob URL generator using Capacitor storage
 */

import { CompactNoteItem as CompactNoteItemUI } from "@deeprecall/ui";
import type { Asset } from "@deeprecall/core";
import { useCapacitorBlobStorage } from "../../../blob-storage/capacitor";

interface CompactNoteItemProps {
  asset: Asset;
  onClick: () => void;
  selected?: boolean;
}

export function CompactNoteItem({
  asset,
  onClick,
  selected,
}: CompactNoteItemProps) {
  const cas = useCapacitorBlobStorage();

  return (
    <CompactNoteItemUI
      asset={asset}
      onClick={onClick}
      selected={selected}
      getBlobUrl={(sha256) => cas.getUrl(sha256)}
    />
  );
}

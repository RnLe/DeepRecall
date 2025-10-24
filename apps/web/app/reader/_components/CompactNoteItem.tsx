/**
 * CompactNoteItem - Next.js wrapper for platform-agnostic CompactNoteItem
 * Injects blob URL generator
 */

"use client";

import { CompactNoteItem as CompactNoteItemUI } from "@deeprecall/ui";
import type { Asset } from "@deeprecall/core";

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
  return (
    <CompactNoteItemUI
      asset={asset}
      onClick={onClick}
      selected={selected}
      getBlobUrl={(sha256) => `/api/blob/${sha256}`}
    />
  );
}

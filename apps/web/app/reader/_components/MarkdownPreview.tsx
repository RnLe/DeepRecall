/**
 * Web platform wrapper for MarkdownPreview
 * Implements platform-specific operations for Next.js/Web
 */

"use client";

import {
  MarkdownPreview as MarkdownPreviewUI,
  MarkdownPreviewProps as BaseProps,
  MarkdownPreviewOperations,
} from "@deeprecall/ui/components/MarkdownPreview";

/** Web-specific props (same as base, operations auto-injected) */
export type MarkdownPreviewProps = Omit<BaseProps, "operations">;

/**
 * Web-specific MarkdownPreview with server API operations
 */
export function MarkdownPreview(props: MarkdownPreviewProps) {
  const operations: MarkdownPreviewOperations = {
    saveContent: async ({ sha256, content, filename }) => {
      const response = await fetch(`/api/library/blobs/${sha256}/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, filename }),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      const data = await response.json();
      return { hash: data.hash };
    },

    renameFile: async ({ sha256, filename }) => {
      const response = await fetch(`/api/library/blobs/${sha256}/rename`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });

      if (!response.ok) {
        throw new Error("Failed to rename");
      }
    },
  };

  return <MarkdownPreviewUI {...props} operations={operations} />;
}

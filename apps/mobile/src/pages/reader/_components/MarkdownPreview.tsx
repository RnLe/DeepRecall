/**
 * Mobile platform wrapper for MarkdownPreview
 * Implements platform-specific operations for Capacitor/Mobile
 */

import { MarkdownPreview as MarkdownPreviewUI } from "@deeprecall/ui/components";
import {
  updateBlobContent,
  renameBlobFile,
} from "../../../blob-storage/capacitor";

// Define the operations interface inline since it's not exported
interface MarkdownPreviewOperations {
  saveContent: (params: {
    sha256: string;
    content: string;
    filename: string;
  }) => Promise<{ hash: string }>;
  renameFile: (params: { sha256: string; filename: string }) => Promise<void>;
}

interface MarkdownPreviewProps {
  sha256: string;
  initialContent: string;
  filename: string;
  onClose: () => void;
  operations: MarkdownPreviewOperations;
}

/** Mobile-specific props (operations auto-injected) */
export type MobileMarkdownPreviewProps = Omit<
  MarkdownPreviewProps,
  "operations"
>;

/**
 * Mobile-specific MarkdownPreview with Capacitor operations
 */
export function MarkdownPreview(props: MobileMarkdownPreviewProps) {
  const operations: MarkdownPreviewOperations = {
    saveContent: async ({
      sha256,
      content,
      filename,
    }: {
      sha256: string;
      content: string;
      filename: string;
    }) => {
      const result = await updateBlobContent(sha256, content, filename);
      return { hash: result.hash };
    },

    renameFile: async ({
      sha256,
      filename,
    }: {
      sha256: string;
      filename: string;
    }) => {
      await renameBlobFile(sha256, filename);
    },
  };

  return <MarkdownPreviewUI {...props} operations={operations} />;
}

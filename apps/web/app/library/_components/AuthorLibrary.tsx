/**
 * AuthorLibrary Next.js Wrapper (Ultra-Thin)
 *
 * Only provides platform-specific operations:
 * - Avatar uploads (filesystem)
 * - Blob URLs (Next.js API routes)
 * - Navigation (Next.js routing)
 *
 * All data operations use Electric hooks directly in the hoisted component.
 */

"use client";

import {
  AuthorLibrary as AuthorLibraryUI,
  type AuthorLibraryPlatformOps,
} from "@deeprecall/ui/library";
import { useRouter } from "next/navigation";
import { useReaderUI } from "@deeprecall/data/stores/reader-ui";

interface AuthorLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthorLibrary({ isOpen, onClose }: AuthorLibraryProps) {
  const router = useRouter();
  const { openTab, setLeftSidebarView } = useReaderUI();

  // Platform-specific operations (only 3!)
  const platformOps: AuthorLibraryPlatformOps = {
    // Avatar management (filesystem)
    uploadAvatar: async ({
      authorId,
      originalBlob,
      displayBlob,
      cropRegion,
    }) => {
      const formData = new FormData();
      formData.append("authorId", authorId);
      formData.append("originalBlob", originalBlob);
      formData.append("displayBlob", displayBlob);
      formData.append("cropRegion", JSON.stringify(cropRegion));

      const response = await fetch("/api/avatars", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload avatar");
      }

      return await response.json();
    },

    deleteAvatar: async (path) => {
      const response = await fetch("/api/avatars", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete avatar");
      }
    },

    // Blob URLs (platform storage)
    getBlobUrl: (sha256: string) => `/api/blob/${sha256}`,

    // Navigation (platform routing)
    openWorkInReader: (sha256, title) => {
      openTab(sha256, title);
      setLeftSidebarView("annotations");
      router.push("/reader");
    },
  };

  return (
    <AuthorLibraryUI
      isOpen={isOpen}
      onClose={onClose}
      platformOps={platformOps}
    />
  );
}

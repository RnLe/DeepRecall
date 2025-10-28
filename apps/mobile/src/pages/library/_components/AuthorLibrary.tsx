/**
 * AuthorLibrary Capacitor Wrapper
 * Provides platform-specific operations for mobile
 */

"use client";

import {
  AuthorLibrary as AuthorLibraryUI,
  type AuthorLibraryPlatformOps,
} from "@deeprecall/ui/library";
import { useNavigate } from "react-router-dom";
import { useReaderUI } from "@deeprecall/data/stores/reader-ui";
import { useCapacitorBlobStorage } from "../../../hooks/useBlobStorage";

interface AuthorLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthorLibrary({ isOpen, onClose }: AuthorLibraryProps) {
  const navigate = useNavigate();
  const { openTab, setLeftSidebarView } = useReaderUI();
  const cas = useCapacitorBlobStorage();

  // Platform-specific operations
  const platformOps: AuthorLibraryPlatformOps = {
    // Avatar management (via HTTP API since native image handling is complex)
    uploadAvatar: async ({
      authorId,
      originalBlob,
      displayBlob,
      cropRegion,
    }) => {
      const apiBaseUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

      const formData = new FormData();
      formData.append("authorId", authorId);
      formData.append("originalBlob", originalBlob);
      formData.append("displayBlob", displayBlob);
      formData.append("cropRegion", JSON.stringify(cropRegion));

      const response = await fetch(`${apiBaseUrl}/api/avatars`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload avatar");
      }

      return await response.json();
    },

    deleteAvatar: async (path) => {
      const apiBaseUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

      const response = await fetch(`${apiBaseUrl}/api/avatars`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete avatar");
      }
    },

    // Blob URLs (Capacitor file:// URLs)
    getBlobUrl: (sha256: string) => cas.getUrl(sha256),

    // Navigation (React Router)
    openWorkInReader: (sha256, title) => {
      openTab(sha256, title);
      setLeftSidebarView("annotations");
      navigate("/reader");
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

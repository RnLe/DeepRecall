/**
 * AuthorLibrary Tauri Wrapper (Ultra-Thin)
 *
 * Only provides platform-specific operations:
 * - Avatar uploads (local filesystem via Tauri commands)
 * - Blob URLs (Tauri asset protocol)
 * - Navigation (react-router)
 *
 * All data operations use Electric hooks directly in the hoisted component.
 */

import {
  AuthorLibrary as AuthorLibraryUI,
  type AuthorLibraryPlatformOps,
} from "@deeprecall/ui/library";
import { useNavigate } from "react-router-dom";
import { useReaderUI } from "@deeprecall/data/stores/reader-ui";
import { convertFileSrc } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";

interface AuthorLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthorLibrary({ isOpen, onClose }: AuthorLibraryProps) {
  const navigate = useNavigate();
  const { openTab, setLeftSidebarView } = useReaderUI();

  // Platform-specific operations
  const platformOps: AuthorLibraryPlatformOps = {
    // Avatar management (local filesystem via Tauri)
    uploadAvatar: async ({
      authorId,
      originalBlob,
      displayBlob,
      cropRegion,
    }) => {
      // Convert blobs to base64 for Rust command
      const originalBase64 = await blobToBase64(originalBlob);
      const displayBase64 = await blobToBase64(displayBlob);

      const result = await invoke<{
        paths: { original: string; display: string };
        cropRegion: { x: number; y: number; size: number };
      }>("upload_avatar", {
        authorId,
        originalBase64,
        displayBase64,
        cropRegion: JSON.stringify(cropRegion),
      });

      return result;
    },

    deleteAvatar: async (path) => {
      await invoke("delete_avatar", { path });
    },

    // Blob URLs (Tauri asset protocol)
    getBlobUrl: (sha256: string) =>
      convertFileSrc(
        `~/Documents/DeepRecall/blobs/${sha256.substring(0, 2)}/${sha256}`
      ),

    // Navigation (react-router)
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

// Helper function to convert Blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

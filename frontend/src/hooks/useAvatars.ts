/**
 * Avatar Upload Hook
 *
 * Provides utilities for uploading and deleting avatar images
 */

import { useMutation } from "@tanstack/react-query";

interface CropRegion {
  x: number;
  y: number;
  size: number;
}

interface UploadAvatarData {
  authorId: string;
  originalBlob: Blob;
  displayBlob: Blob;
  cropRegion: CropRegion;
}

interface UploadAvatarResult {
  paths: {
    original: string;
    display: string;
  };
  cropRegion: CropRegion;
}

/**
 * Upload avatar images to the server
 */
async function uploadAvatar(
  data: UploadAvatarData
): Promise<UploadAvatarResult> {
  const formData = new FormData();
  formData.append("authorId", data.authorId);
  formData.append("original", data.originalBlob, "original.jpg");
  formData.append("display", data.displayBlob, "display.jpg");
  formData.append("cropRegion", JSON.stringify(data.cropRegion));

  const response = await fetch("/api/avatars", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to upload avatar");
  }

  return response.json();
}

/**
 * Delete an avatar image
 */
async function deleteAvatar(path: string): Promise<void> {
  const response = await fetch(
    `/api/avatars?path=${encodeURIComponent(path)}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete avatar");
  }
}

/**
 * Hook for uploading avatars
 */
export function useUploadAvatar() {
  return useMutation({
    mutationFn: uploadAvatar,
  });
}

/**
 * Hook for deleting avatars
 */
export function useDeleteAvatar() {
  return useMutation({
    mutationFn: deleteAvatar,
  });
}

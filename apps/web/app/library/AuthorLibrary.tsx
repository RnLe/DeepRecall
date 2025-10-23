/**
 * AuthorLibrary Next.js Wrapper
 *
 * Implements AuthorLibraryOperations using Electric and Next.js specific features
 */

"use client";

import {
  AuthorLibrary as AuthorLibraryUI,
  type AuthorLibraryOperations,
} from "@deeprecall/ui";
import type { Author, CropRegion } from "@deeprecall/core";
import { getAuthorFullName } from "@deeprecall/core";
import { useAuthors } from "@deeprecall/data/hooks/useAuthors";
import { useWorks } from "@deeprecall/data/hooks/useWorks";
import { usePresets } from "@deeprecall/data/hooks/usePresets";
import {
  createAuthor as createAuthorElectric,
  updateAuthor as updateAuthorElectric,
  deleteAuthor as deleteAuthorElectric,
} from "@deeprecall/data/repos/authors.electric";
import { queryShape } from "@deeprecall/data/electric";
import { useRouter } from "next/navigation";
import { useReaderUI } from "@deeprecall/data/stores/reader-ui";
import { SimplePDFViewer } from "../reader/SimplePDFViewer";
import { ImageCropper } from "@/src/components/ImageCropper";
import { parseAuthorList } from "@/src/utils/nameParser";

interface AuthorLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Format work statistics in a readable way
 * E.g., "2 papers, 1 textbook" instead of "3 works"
 */
function formatWorkStats(stats: Record<string, number>): string {
  const parts: string[] = [];
  const entries = Object.entries(stats);

  if (entries.length === 0) return "";

  entries.forEach(([type, count]) => {
    if (count === 0) return;

    // Pluralize type names
    const typeName =
      count === 1
        ? type
        : type === "thesis"
          ? "theses"
          : type.endsWith("s")
            ? type
            : `${type}s`;

    parts.push(`${count} ${typeName}`);
  });

  return parts.join(", ");
}

export function AuthorLibrary({ isOpen, onClose }: AuthorLibraryProps) {
  const router = useRouter();
  const { openTab, setLeftSidebarView } = useReaderUI();

  // Use Electric hooks to get reactive data
  const allAuthors = useAuthors();
  const works = useWorks();
  const presets = usePresets();

  // Sort authors client-side for different sort orders
  const sortAuthors = (
    authors: Author[],
    sortBy: "lastName" | "firstName" | "createdAt"
  ) => {
    return [...authors].sort((a, b) => {
      if (sortBy === "lastName") {
        return a.lastName.localeCompare(b.lastName);
      } else if (sortBy === "firstName") {
        return a.firstName.localeCompare(b.firstName);
      } else {
        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        );
      }
    });
  };

  const operations: AuthorLibraryOperations = {
    // Author data fetching
    listAuthors: ({ sortBy }) => {
      return sortAuthors(allAuthors.data || [], sortBy);
    },

    searchAuthors: (query, { limit }) => {
      // Client-side search
      const lowerQuery = query.toLowerCase();
      return (allAuthors.data || [])
        .filter((author) => {
          const fullName = getAuthorFullName(author).toLowerCase();
          const orcid = author.orcid?.toLowerCase() || "";
          return fullName.includes(lowerQuery) || orcid.includes(lowerQuery);
        })
        .slice(0, limit);
    },

    // Author CRUD
    createAuthor: async (data) => {
      return await createAuthorElectric(
        data as Omit<Author, "id" | "createdAt" | "updatedAt">
      );
    },

    updateAuthor: async ({ id, updates }) => {
      await updateAuthorElectric(id, updates);
    },

    deleteAuthor: async (id) => {
      await deleteAuthorElectric(id);
    },

    findOrCreateAuthor: async (data) => {
      // Check for existing by ORCID
      if (data.orcid) {
        const existing = await queryShape<Author>({
          table: "authors",
          where: `orcid = '${data.orcid.replace(/'/g, "''")}'`,
        });
        if (existing.length > 0) return existing[0];
      }

      // Check for existing by name
      const allAuthors = await queryShape<Author>({ table: "authors" });
      const existing = allAuthors.find(
        (a) =>
          a.firstName.toLowerCase() === data.firstName?.toLowerCase() &&
          a.lastName.toLowerCase() === data.lastName?.toLowerCase()
      );
      if (existing) return existing;

      // Create new
      return await createAuthorElectric(
        data as Omit<Author, "id" | "createdAt" | "updatedAt">
      );
    },

    // Avatar management
    uploadAvatar: async ({
      authorId,
      originalBlob,
      displayBlob,
      cropRegion,
    }) => {
      // Upload to /api/avatars
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

    // Works and presets
    getWorks: () => works.data || [],
    getPresets: () => presets.data || [],

    // Utilities
    getAuthorFullName,
    parseAuthorList,
    formatWorkStats,

    // Navigation
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
      operations={operations}
      SimplePDFViewer={SimplePDFViewer}
      ImageCropper={ImageCropper}
    />
  );
}

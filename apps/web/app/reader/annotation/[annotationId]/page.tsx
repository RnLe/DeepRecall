/**
 * Annotation Detail Page - Dedicated view for annotation with organized notes
 * Route: /reader/annotation/[annotationId]
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

// ========================================
// PURE UI IMPORTS (from @deeprecall/ui)
// ========================================
import {
  AnnotationPreview,
  type AnnotationPreviewOperations,
} from "@deeprecall/ui";
import { NoteTreeView, type NoteTreeViewOperations } from "@deeprecall/ui";
import type { Annotation } from "@deeprecall/core/schemas/annotation";
import type { Asset } from "@deeprecall/core/schemas/library";

// ========================================
// PLATFORM WRAPPERS (from ./_components)
// ========================================
// (None - this page directly implements operations)

// ========================================
// PLATFORM HOOKS & UTILITIES
// ========================================
import {
  getAnnotation,
  getAnnotationAssets,
} from "@deeprecall/data/repos/annotations";
import { updateAnnotationLocal } from "@deeprecall/data/repos/annotations.local";
import { updateAssetLocal } from "@deeprecall/data/repos/assets.local";
import { loadPDFDocument } from "../../../../src/utils/pdf";

export default function AnnotationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const annotationId = params.annotationId as string;

  const [annotation, setAnnotation] = useState<Annotation | null>(null);
  const [notes, setNotes] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // Platform-specific Operations
  // ============================================================================

  // Annotation Preview Operations
  const annotationPreviewOps: AnnotationPreviewOperations = {
    getBlobUrl: (sha256) => `/api/blob/${sha256}`,
    loadPDFDocument: loadPDFDocument,
    updateAnnotationMetadata: async (id, metadata) => {
      await updateAnnotationLocal({
        id,
        metadata,
      });
    },
  };

  // Note Tree View Operations (extends NoteBranch operations)
  const noteTreeViewOps: NoteTreeViewOperations = {
    // Blob operations
    getBlobUrl: (sha256) => `/api/blob/${sha256}`,

    fetchBlobContent: async (sha256) => {
      const response = await fetch(`/api/blob/${sha256}`);
      if (!response.ok) {
        throw new Error("Failed to fetch blob content");
      }
      return await response.text();
    },

    // File upload
    uploadFile: async (file, metadata) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("metadata", JSON.stringify(metadata));

      const response = await fetch("/api/library/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const result = await response.json();
      return {
        blob: {
          sha256: result.blob.sha256,
          filename: result.blob.filename,
          size: result.blob.size,
          mime: result.blob.mime,
        },
      };
    },

    // Asset metadata updates (optimistic)
    updateAssetMetadata: async (assetId, updates) => {
      await updateAssetLocal(assetId, {
        metadata: updates,
      });
    },

    // Group management operations
    createNoteGroup: async (annotationId, name, color) => {
      const ann = await getAnnotation(annotationId);
      if (!ann) throw new Error("Annotation not found");

      const existingGroups = ann.metadata.noteGroups || [];
      const newGroup = {
        id: crypto.randomUUID(),
        name,
        color,
        order: existingGroups.length,
        viewMode: "compact" as const,
        columns: 1 as const,
      };

      await updateAnnotationLocal({
        id: annotationId,
        metadata: {
          ...ann.metadata,
          noteGroups: [...existingGroups, newGroup],
        },
      });
    },

    updateNoteGroup: async (annotationId, groupId, updates) => {
      const ann = await getAnnotation(annotationId);
      if (!ann) throw new Error("Annotation not found");

      const groups = ann.metadata.noteGroups || [];
      const updatedGroups = groups.map((g) =>
        g.id === groupId ? { ...g, ...updates } : g
      );

      await updateAnnotationLocal({
        id: annotationId,
        metadata: {
          ...ann.metadata,
          noteGroups: updatedGroups,
        },
      });
    },

    deleteNoteGroup: async (annotationId, groupId) => {
      const ann = await getAnnotation(annotationId);
      if (!ann) throw new Error("Annotation not found");

      const groups = ann.metadata.noteGroups || [];
      const filteredGroups = groups.filter((g) => g.id !== groupId);

      await updateAnnotationLocal({
        id: annotationId,
        metadata: {
          ...ann.metadata,
          noteGroups: filteredGroups,
        },
      });
    },

    moveNoteToGroup: async (assetId, groupId) => {
      await updateAssetLocal(assetId, {
        metadata: {
          groupId,
        },
      });
    },

    onRefreshNeeded: async () => {
      // Reload notes when operations complete
      await loadAnnotation();
    },
  };

  useEffect(() => {
    loadAnnotation();
  }, [annotationId]);

  const loadAnnotation = async () => {
    setLoading(true);
    setError(null);

    try {
      const ann = await getAnnotation(annotationId);
      if (!ann) {
        setError("Annotation not found");
        return;
      }

      const annNotes = await getAnnotationAssets(annotationId);

      setAnnotation(ann);
      setNotes(annNotes);
    } catch (err) {
      console.error("Failed to load annotation:", err);
      setError("Failed to load annotation");
    } finally {
      setLoading(false);
    }
  };

  const handleNotesChange = async () => {
    // Reload notes when they change
    const annNotes = await getAnnotationAssets(annotationId);
    setNotes(annNotes);
  };

  if (loading) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={48} className="animate-spin text-purple-400" />
          <p className="text-gray-400">Loading annotation...</p>
        </div>
      </div>
    );
  }

  if (error || !annotation) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">
            {error || "Annotation not found"}
          </p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex">
      {/* Left Sidebar: Annotation Details */}
      <div className="w-96 border-r border-gray-700 bg-gray-800/50 overflow-y-auto">
        <AnnotationPreview
          annotation={annotation}
          onBack={() => router.back()}
          operations={annotationPreviewOps}
        />
      </div>

      {/* Right Content: Note Tree */}
      <div className="flex-1 overflow-y-auto p-6">
        <NoteTreeView
          annotation={annotation}
          notes={notes}
          onNotesChange={handleNotesChange}
          operations={noteTreeViewOps}
        />
      </div>
    </div>
  );
}

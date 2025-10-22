/**
 * NoteSidebar - Floating panel displaying notes for visible annotations
 * Shows notes from annotations on current page with visual connectors
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { useAnnotationUI } from "@deeprecall/data/stores";
import type { Annotation } from "@deeprecall/core";
import type { Asset } from "@deeprecall/core";
import { getAnnotationAssets } from "@deeprecall/data/repos";
import {
  StickyNote,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { NotePreview } from "@/app/reader/NotePreview";

interface NoteSidebarProps {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** All annotations for the PDF */
  annotations: Annotation[];
  /** Sidebar visibility state */
  isOpen: boolean;
  /** Callback to toggle visibility */
  onToggle: (open: boolean) => void;
}

interface AnnotationWithNotes {
  annotation: Annotation;
  notes: Asset[];
}

export function NoteSidebar({
  currentPage,
  annotations,
  isOpen,
  onToggle,
}: NoteSidebarProps) {
  const [notesMap, setNotesMap] = useState<Map<string, Asset[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const { selectedAnnotationId, setSelectedAnnotationId } = useAnnotationUI();

  // Filter annotations for current page
  const pageAnnotations = useMemo(() => {
    return annotations.filter((ann) => ann.page === currentPage);
  }, [annotations, currentPage]);

  // Load notes for all annotations on current page
  useEffect(() => {
    const loadNotes = async () => {
      if (pageAnnotations.length === 0) {
        setNotesMap(new Map());
        return;
      }

      setLoading(true);
      try {
        const newNotesMap = new Map<string, Asset[]>();

        // Load notes for each annotation
        await Promise.all(
          pageAnnotations.map(async (ann) => {
            if (
              ann.metadata?.attachedAssets &&
              ann.metadata.attachedAssets.length > 0
            ) {
              try {
                const notes = await getAnnotationAssets(ann.id);
                if (notes.length > 0) {
                  newNotesMap.set(ann.id, notes);
                }
              } catch (error) {
                console.error(
                  `Failed to load notes for annotation ${ann.id}:`,
                  error
                );
              }
            }
          })
        );

        setNotesMap(newNotesMap);
      } catch (error) {
        console.error("Failed to load notes:", error);
      } finally {
        setLoading(false);
      }
    };

    loadNotes();
  }, [pageAnnotations]);

  // Get annotations with notes
  const annotationsWithNotes = useMemo<AnnotationWithNotes[]>(() => {
    return pageAnnotations
      .map((ann) => ({
        annotation: ann,
        notes: notesMap.get(ann.id) || [],
      }))
      .filter((item) => item.notes.length > 0);
  }, [pageAnnotations, notesMap]);

  const toggleSidebar = () => {
    onToggle(!isOpen);
  };

  // Collapse button when sidebar is closed
  if (!isOpen) {
    return (
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={toggleSidebar}
          className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-lg transition-all hover:shadow-xl"
          title="Show notes sidebar (Shift+N)"
        >
          <StickyNote size={18} />
          <span className="text-sm font-medium">Notes</span>
          <ChevronLeft size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-gray-800/95 backdrop-blur-sm border-l border-gray-700 shadow-2xl z-20 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-900/50">
        <div className="flex items-center gap-2">
          <StickyNote size={18} className="text-purple-400" />
          <h3 className="text-sm font-medium text-gray-200">
            Page Notes
            {annotationsWithNotes.length > 0 && (
              <span className="ml-2 text-xs text-gray-500">
                ({annotationsWithNotes.length})
              </span>
            )}
          </h3>
        </div>
        <button
          onClick={toggleSidebar}
          className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-200 transition-colors"
          title="Hide notes sidebar (Shift+N)"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin text-purple-400" />
              <p className="text-sm text-gray-500">Loading notes...</p>
            </div>
          </div>
        ) : annotationsWithNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <StickyNote size={48} className="text-gray-700 mb-3" />
            <p className="text-sm text-gray-500">No notes on this page</p>
            <p className="text-xs text-gray-600 mt-2">
              Select an annotation and click "Add Note" to attach notes
            </p>
          </div>
        ) : (
          annotationsWithNotes.map(({ annotation, notes }) => (
            <div
              key={annotation.id}
              className={`border rounded-lg p-3 transition-all cursor-pointer ${
                selectedAnnotationId === annotation.id
                  ? "border-purple-500 bg-purple-900/20 shadow-lg"
                  : "border-gray-700 bg-gray-900/50 hover:border-gray-600 hover:bg-gray-900/70"
              }`}
              onClick={() => setSelectedAnnotationId(annotation.id)}
            >
              {/* Annotation Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  {annotation.metadata?.title && (
                    <div className="font-medium text-sm text-gray-200 truncate mb-1">
                      {annotation.metadata.title}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {annotation.metadata?.kind && (
                      <>
                        <span className="px-1.5 py-0.5 bg-gray-800 rounded">
                          {annotation.metadata.kind}
                        </span>
                        <span>•</span>
                      </>
                    )}
                    <span>
                      {notes.length} {notes.length === 1 ? "note" : "notes"}
                    </span>
                  </div>
                </div>
                {annotation.metadata?.color && (
                  <div
                    className="w-3 h-3 rounded-full border border-gray-600 flex-shrink-0"
                    style={{ backgroundColor: annotation.metadata.color }}
                  />
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                {notes.map((note) => (
                  <div key={note.id} className="text-xs">
                    <NotePreview asset={note} />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer with keyboard hint */}
      <div className="px-4 py-2 border-t border-gray-700 bg-gray-900/50">
        <p className="text-xs text-gray-600 text-center">
          Press{" "}
          <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-400">
            Shift+N
          </kbd>{" "}
          to toggle
        </p>
      </div>
    </div>
  );
}

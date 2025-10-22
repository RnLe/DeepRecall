/**
 * Annotation Detail Page - Dedicated view for annotation with organized notes
 * Route: /reader/annotation/[annotationId]
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { Annotation } from "@deeprecall/core/schemas/annotation";
import type { Asset } from "@deeprecall/core/schemas/library";
import { getAnnotation, getAnnotationAssets } from "@deeprecall/data/repos/annotations";
import { AnnotationPreview } from "./AnnotationPreview";
import { NoteTreeView } from "./NoteTreeView";

export default function AnnotationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const annotationId = params.annotationId as string;

  const [annotation, setAnnotation] = useState<Annotation | null>(null);
  const [notes, setNotes] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        />
      </div>

      {/* Right Content: Note Tree */}
      <div className="flex-1 overflow-y-auto p-6">
        <NoteTreeView
          annotation={annotation}
          notes={notes}
          onNotesChange={handleNotesChange}
        />
      </div>
    </div>
  );
}

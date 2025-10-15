// src/components/pdfViewer/annotationProperties.tsx
import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Eye, X, StickyNote, Tags, FileText, Sigma, Image as ImageIcon } from "lucide-react";

import {
  Annotation,
  annotationTypes,
  AnnotationType,
  Solution
} from "../../types/deepRecall/strapi/annotationTypes";
import { AnnotationTag } from "@/src/types/deepRecall/strapi/annotationTagTypes";
import { uploadFile, deleteFile } from "../../api/uploadFile";
import { agoTimeToString } from "../../helpers/timesToString";
import MarkdownEditorModal from "./MarkdownEditorModal";
import TagInput from "./TagInput";
import { prefixStrapiUrl } from "@/app/helpers/getStrapiMedia";

// Which rectangle‑annotation types should show the Solutions panel?
const solutionTypes: AnnotationType[] = [
    "Exercise",
    "Problem",
    "Calculation",
    "Other",
];

interface Props {
  annotation: Annotation | null;
  updateAnnotation: (a: Annotation) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  saveImage: (a: Annotation) => Promise<void>;
  onCancel: () => void;
  colorMap?: Record<string, string>;
}

const AnnotationProperties: React.FC<Props> = ({
  annotation,
  updateAnnotation,
  deleteAnnotation,
  saveImage,
  onCancel,
  colorMap = {},
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const [editDescription, setEditDescription] = useState(false);
  const [editNewSolNotes, setEditNewSolNotes] = useState(false);

  const [draft, setDraft] = useState<Annotation | null>(annotation);
  const [titleDirty, setTitleDirty] = useState(false);

  // modals
  const [editNotes, setEditNotes] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewSolutionNote, setPreviewSolutionNote] = useState<string | null>(null);
  const [editSolIdx, setEditSolIdx] = useState<number | null>(null);

  // For adding new solution
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAddSol, setShowAddSol] = useState(false);

  useEffect(() => {
    setDraft(annotation);
    setTitleDirty(false);
    setEditNotes(false);
    setEditDescription(false);
    setEditNewSolNotes(false);
    setPreviewImageUrl(null);
    setPreviewSolutionNote(null);
    setNewFile(null);
    setNewDate(today);
    setNewNotes("");
  }, [annotation]);

  if (!draft) return <div className="p-4">No annotation selected.</div>;
  const isRect = draft.mode === "rectangle";

  // generic field updater (no longer used for title/color/tags)
  const setField = <K extends keyof Annotation>(key: K, val: Annotation[K]) => {
    setDraft((d) => (d ? { ...d, [key]: val } : d));
  };

  // Title change only => mark dirty
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...draft!, title: e.target.value };
    setDraft(next);
    setTitleDirty(true);
  };
  const applyTitle = async () => {
    if (draft) {
      await updateAnnotation(draft);
      setTitleDirty(false);
    }
  };

  // Color change => immediate update
  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...draft!, color: e.target.value };
    setDraft(next);
    updateAnnotation(next);
  };

  // Tags change => immediate update
  const handleTagsChange = (newTags: AnnotationTag[]) => {
    const next = { ...draft!, annotation_tags: newTags };
    setDraft(next);
    updateAnnotation(next);
  };

  const commonChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setDraft({ ...draft, [name]: value } as Annotation);
  };

  const typeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!draft) return;
    const next = {
      ...(draft as Annotation),
      type: e.target.value as AnnotationType,
    };
    setDraft(next);
    updateAnnotation(next);    // <- persist change immediately
  };

  const handleDelete = async () => {
    if (draft.documentId && confirm("Delete this annotation?")) {
      await deleteAnnotation(draft.documentId);
    }
  };

  const saveNotes = async (md: string) => {
    const next = { ...draft, notes: md } as Annotation;
    setDraft(next);
    await updateAnnotation(next);
  };

  const saveDescription = async (md: string) => {
    const next = { ...draft, description: md } as Annotation;
    setDraft(next);
    await updateAnnotation(next);
  };

  const saveSolNote = async (md: string) => {
    if (draft && editSolIdx !== null) {
      const updatedSols = sols.map((s, i) =>
        i === editSolIdx ? { ...s, notes: md } : s
      );
      const updated = { ...draft, solutions: updatedSols } as Annotation;
      setDraft(updated);
      await updateAnnotation(updated);
      setEditSolIdx(null);
    }
  };

  // Solutions
  const hasSolutions = isRect && solutionTypes.includes((draft as Annotation).type);
  const sols: Solution[] = draft.solutions ?? [];

  const handleSolutionFile = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setNewFile(e.target.files?.[0] ?? null);

  const addSolution = async () => {
    if (!newFile || !draft) return;
    const { id: fileId, url: fileUrl } = await uploadFile(newFile);
    const sol: Solution = {
      fileId,
      fileUrl,
      date: newDate || new Date().toISOString().slice(0, 10),
      notes: newNotes,
    };
    const updated = { ...draft, solutions: [...sols, sol] } as Annotation;
    setDraft(updated);
    await updateAnnotation(updated);
    setNewFile(null);
    setNewDate(today);                // reset to today
    setNewNotes("");
    if (fileInputRef.current)        // clear file input
      fileInputRef.current.value = "";
  };

  const removeSolution = async (idx: number) => {
    const sol = sols[idx];
    if (!sol || !draft) return;
    if (!confirm("Delete this solution?")) return;
    try {
      await deleteFile(sol.fileId);
    } catch {}
    const updated = { ...draft, solutions: sols.filter((_, i) => i !== idx) };
    setDraft(updated);
    await updateAnnotation(updated);
  };

  const hasImage = Boolean(draft.extra?.imageUrl);

  return (
    <div className="p-4 border-l border-gray-700 flex flex-col space-y-4 overflow-y-auto">

      {isRect && (
        <>
          <label className="text-sm">Annotation Type</label>
          <select
            value={draft.type}
            onChange={typeChange}
            className="w-full p-1 rounded bg-gray-800 border border-gray-600"
          >
            {annotationTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </>
      )}

      {/* Title */}
      <label className="text-sm">Title</label>
      <input
        name="title"
        value={draft.title ?? ""}
        onChange={handleTitleChange}
        className="w-full p-1 rounded bg-gray-800 border border-gray-600"
      />
      {titleDirty && (
        <button
          onClick={applyTitle}
          className="mt-1 p-2 rounded bg-blue-600 hover:bg-blue-500 text-sm transition"
        >
          Apply
        </button>
      )}

      {/* Description */}
      <div className="flex items-center space-x-1">
        <FileText size={16} className="text-gray-400" />
        <label className="text-sm">Description</label>
      </div>
      <div
        onClick={() => setEditDescription(true)}
        className="w-full h-auto overflow-auto p-2 rounded bg-gray-800 border border-gray-600 cursor-pointer prose prose-invert text-sm text-center"
      >
        <span className="italic text-gray-400">Click to edit</span>
      </div>

      {/* Tags */}
      <div className="flex items-center space-x-1">
        <Tags size={16} className="text-gray-400" />
        <label className="text-sm">Tags</label>
      </div>
      <TagInput
        tags={draft.annotation_tags ?? []}
        onChange={handleTagsChange}
      />

      {/* Notes */}
      <div className="flex items-center space-x-1">
        <StickyNote size={16} className="text-gray-400" />
        <label className="text-sm">Notes</label>
      </div>
      <div
        onClick={() => setEditNotes(true)}
        className="w-full h-auto overflow-auto p-2 rounded bg-gray-800 border border-gray-600 cursor-pointer prose prose-invert text-sm text-center"
      >
        <span className="italic text-gray-400">Click to edit</span>
      </div>

      {/* Color */}
      <div>
        <label className="text-sm block">Custom color</label>
        <div
          className="w-full h-8 rounded"
          style={{ backgroundColor: draft.color ?? "#000000" }}
        />
        <div className="flex space-x-2 mt-1">
          <input
            type="color"
            value={draft.color ?? "#000000"}
            onChange={handleColorChange}
          />
          <button
            onClick={() => {
              const next = { ...draft, color: undefined };
              setDraft(next);
              updateAnnotation(next);
            }}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Solutions container */}
      {hasSolutions && (
        <div className="border border-gray-600 rounded p-2 space-y-2">
          <div className="flex items-center space-x-1">
            <Sigma size={16} className="text-gray-400" />
            <h4 className="font-medium">
              {(draft as Annotation).type}
              {sols.length > 1 && ` (${sols.length})`}
            </h4>
          </div>

          {sols.map((sol, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between bg-gray-800 p-2 rounded"
            >
              <div className="flex items-center space-x-2">
                <button onClick={() => setPreviewImageUrl(prefixStrapiUrl(sol.fileUrl))}>
                  <ImageIcon
                    size={24}
                    className="text-gray-400 hover:text-white"
                  />
                </button>
                <button onClick={() => setEditSolIdx(idx)}>
                  <StickyNote
                    size={24}
                    className="text-gray-400 hover:text-white"
                  />
                </button>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm">{sol.date}</span>
                <span className="text-xs text-gray-400">
                  {agoTimeToString(
                    new Date(sol.date).getTime() / 1000,
                    true        // compactUnderDay
                  )}
                </span>
              </div>
              <button onClick={() => removeSolution(idx)}>
                <X size={16} className="text-red-500 hover:text-red-400" />
              </button>
            </div>
          ))}

          {!showAddSol ? (
            <button
              onClick={() => setShowAddSol(true)}
              className="w-full p-2 mt-2 border border-dashed border-gray-600 rounded text-sm text-gray-400"
            >
              Add new {(draft as Annotation).type.toLowerCase()}
            </button>
          ) : (
            <>
              <div className="border-t-2 border-double border-t-gray-600 my-2" />
              {/* Add new solution inputs */}
              <div className="flex flex-col space-y-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleSolutionFile}
                  className="text-sm"
                />
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="p-1 rounded bg-gray-800 border border-gray-600 w-full text-sm"
                />
                <div
                  onClick={() => setEditNewSolNotes(true)}
                  className="w-full h-auto p-2 rounded bg-gray-800 border border-gray-600 cursor-pointer prose prose-invert text-sm text-center"
                >
                  <span className="italic text-gray-400">
                    {newNotes ? "Edit notes" : "Click to add notes"}
                  </span>
                </div>
                <button
                  onClick={addSolution}
                  disabled={!newFile}
                  className={`mt-1 p-2 rounded ${
                    newFile ? "bg-green-600 hover:bg-green-500" : "bg-gray-700 cursor-not-allowed"
                  } text-sm`}
                >
                  Add
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {!hasImage ? (
        <button
          onClick={() => saveImage(draft as Annotation)}
          className="mt-2 p-2 rounded bg-green-600 hover:bg-green-500 flex items-center space-x-1"
        >
          <ImageIcon size={16} />
          <span>Save annotation image</span>
        </button>
      ) : (
        <div className="mt-2 flex items-center space-x-1 text-green-400 text-sm">
          <ImageIcon size={16} />
          <span>Annotation image already saved</span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto flex space-x-2">
        <button
          onClick={onCancel}
          className="flex-1 p-2 rounded bg-gray-600"
        >
          Cancel
        </button>
        {draft.documentId && (
          <button
            onClick={async () => {
              if (confirm("Are you sure you want to delete this annotation? This action cannot be undone.")) {
                await deleteAnnotation(draft.documentId!);
              }
            }}
            className="flex-1 p-2 rounded bg-red-700 hover:bg-red-600"
          >
            Delete
          </button>
        )}
      </div>

      {/* Modals for edit notes, preview image, preview solution note */}
      {editNotes && (
        <MarkdownEditorModal
          initial={draft.notes ?? ""}
          onSave={saveNotes}
          onClose={() => setEditNotes(false)}
          annotation={draft}
          objectName="Notes"
          colorMap={colorMap}
        />
      )}

      {editDescription && (
        <MarkdownEditorModal
          initial={draft.description ?? ""}
          onSave={saveDescription}
          onClose={() => setEditDescription(false)}
          annotation={draft}
          objectName="Description"
          colorMap={colorMap}
        />
      )}

      {editNewSolNotes && (
        <MarkdownEditorModal
          initial={newNotes}
          onSave={(md) => {
            setNewNotes(md);
            setEditNewSolNotes(false);
          }}
          onClose={() => setEditNewSolNotes(false)}
          annotation={draft}
          objectName="Notes"
          colorMap={colorMap}
        />
      )}

      {editSolIdx !== null && (
        <MarkdownEditorModal
          initial={sols[editSolIdx].notes}
          onSave={saveSolNote}
          onClose={() => setEditSolIdx(null)}
          annotation={draft}
          objectName="Notes"
          colorMap={colorMap}
          startInPreview={true}
        />
      )}

      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="bg-gray-900 p-4 max-w-[90vw] max-h-[90vh] overflow-auto rounded"
            onClick={e => e.stopPropagation()}
          >
            <img src={previewImageUrl} alt="Solution" className="mx-auto" />
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="mt-4 px-3 py-1 bg-gray-700 rounded text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {previewSolutionNote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setPreviewSolutionNote(null)}
        >
          <div
            className="bg-gray-900 p-4 max-w-[80vw] max-h-[80vh] overflow-auto rounded prose prose-invert"
            onClick={e => e.stopPropagation()}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {previewSolutionNote}
            </ReactMarkdown>
            <button
              onClick={() => setPreviewSolutionNote(null)}
              className="mt-4 px-3 py-1 bg-gray-700 rounded text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnotationProperties;

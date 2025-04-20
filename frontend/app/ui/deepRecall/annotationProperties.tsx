// src/components/pdfViewer/annotationProperties.tsx
import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Eye, X, StickyNote } from "lucide-react";

import {
  Annotation,
  RectangleAnnotation,
  annotationTypes,
  AnnotationType,
  Solution,
} from "../../types/annotationTypes";
import { uploadFile, deleteFile } from "../../api/uploadFile";
import MarkdownEditorModal from "./MarkdownEditorModal";

interface Props {
  annotation: Annotation | null;
  updateAnnotation: (a: Annotation) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  saveImage: (a: RectangleAnnotation) => Promise<void>;
  onCancel: () => void;
}

const AnnotationProperties: React.FC<Props> = ({
  annotation,
  updateAnnotation,
  deleteAnnotation,
  saveImage,
  onCancel,
}) => {
  const [draft, setDraft] = useState<Annotation | null>(annotation);
  const [dirty, setDirty] = useState(false);

  // modals
  const [editNotes, setEditNotes] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewSolutionNote, setPreviewSolutionNote] = useState<string | null>(null);

  // For adding new solution
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newNotes, setNewNotes] = useState("");

  useEffect(() => {
    setDraft(annotation);
    setDirty(false);
    setEditNotes(false);
    setPreviewImageUrl(null);
    setPreviewSolutionNote(null);
    setNewFile(null);
    setNewDate("");
    setNewNotes("");
  }, [annotation]);

  if (!draft) return <div className="p-4">No annotation selected.</div>;
  const isRect = draft.type === "rectangle";

  const commonChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setDraft({ ...draft, [name]: value } as Annotation);
    setDirty(true);
  };

  const tagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vals = e.target.value
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t);
    setDirty(true);
  };

  const typeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDraft({
      ...(draft as RectangleAnnotation),
      annotationType: e.target.value as AnnotationType,
    });
    setDirty(true);
  };

  const colorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft({ ...draft, color: e.target.value });
    setDirty(true);
  };

  const handleSave = async () => {
    if (draft) {
      await updateAnnotation(draft);
      setDirty(false);
    }
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
    setDirty(false);
  };

  // Solutions
  const hasSolutions =
    isRect &&
    ["Exercise", "Problem"].includes(
      (draft as RectangleAnnotation).annotationType
    );
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
    setDirty(false);
    setNewFile(null);
    setNewDate("");
    setNewNotes("");
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
    setDirty(false);
  };

  const hasImage = Boolean(draft.extra?.imageUrl);

  return (
    <div className="p-4 border-l border-gray-700 flex flex-col space-y-4 overflow-y-auto">
      <h3 className="text-lg font-semibold">Properties</h3>

      {/* Title */}
      <label className="text-sm">Title</label>
      <input
        name="title"
        value={draft.title ?? ""}
        onChange={commonChange}
        className="w-full p-1 rounded bg-gray-800 border border-gray-600"
      />

      {/* Notes */}
      <label className="text-sm">Notes (Markdown)</label>
      <div
        onClick={() => setEditNotes(true)}
        className="w-full max-h-40 overflow-auto p-2 rounded bg-gray-800 border border-gray-600 cursor-pointer prose prose-invert text-sm"
        title="Click to edit"
      >
        {draft.notes ? (
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
            {draft.notes}
          </ReactMarkdown>
        ) : (
          <span className="italic text-gray-400">Click to add notes…</span>
        )}
      </div>

      {/* Description (kept for old data but can be phased out) */}
      <label className="text-sm">Description (plain text)</label>
      <textarea
        name="description"
        rows={2}
        value={draft.description ?? ""}
        onChange={commonChange}
        className="w-full p-1 rounded bg-gray-800 border border-gray-600 resize-none"
      />

      {/* Tags */}
      <label className="text-sm">Tags (comma‑separated)</label>
      <input
        type="text"
        onChange={tagsChange}
        className="w-full p-1 rounded bg-gray-800 border border-gray-600"
      />

      {/* Color */}
      <div>
        <label className="text-sm block">Color</label>
        <input
          type="color"
          value={draft.color ?? "#000000"}
          onChange={colorChange}
          className="h-8 w-12 p-0 border-0"
        />
      </div>

      {/* Annotation Type */}
      {isRect && (
        <>
          <label className="text-sm">Annotation Type</label>
          <select
            value={(draft as RectangleAnnotation).annotationType}
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

      {/* Solutions container */}
      {hasSolutions && (
        <div className="border border-gray-600 rounded p-2 space-y-2">
          <h4 className="font-medium">
            Solutions{sols.length > 1 && ` (${sols.length})`}
          </h4>

          {sols.map((sol, idx) => (
            <div
              key={idx}
              className="flex items-center space-x-2 bg-gray-800 p-2 rounded"
            >
              <button onClick={() => setPreviewImageUrl(sol.fileUrl)}>
                <Eye size={16} className="text-gray-400 hover:text-white" />
              </button>

              <button onClick={() => removeSolution(idx)}>
                <X size={16} className="text-red-500 hover:text-red-400" />
              </button>

              <input
                type="date"
                value={sol.date}
                onChange={(e) => {
                  const updatedSols = sols.map((s, i) =>
                    i === idx ? { ...s, date: e.target.value } : s
                  );
                  setDraft({ ...draft, solutions: updatedSols });
                  setDirty(true);
                }}
                className="p-1 rounded bg-gray-800 border border-gray-600 w-20 text-sm"
              />

              {sol.notes ? (
                <button onClick={() => setPreviewSolutionNote(sol.notes)}>
                  <StickyNote size={16} className="text-gray-400 hover:text-white" />
                </button>
              ) : (
                <div className="w-4" />
              )}
            </div>
          ))}

          {/* Add new solution */}
          <div className="flex flex-col space-y-1">
            <input type="file" onChange={handleSolutionFile} className="text-sm" />
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="p-1 rounded bg-gray-800 border border-gray-600 w-20 text-sm"
            />
            <textarea
              rows={2}
              placeholder="Notes"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="p-1 rounded bg-gray-800 border border-gray-600 resize-none text-sm"
            />
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
        </div>
      )}

      {!hasImage ? (
        <button
          onClick={() => saveImage(draft as RectangleAnnotation)}
          className="mt-2 p-2 rounded bg-green-600 hover:bg-green-500 text-sm"
        >
          Save Image
        </button>
      ) : (
        <div className="mt-2 text-green-400 text-sm">
          ✔ Image saved!
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto flex space-x-2">
        <button
          onClick={handleSave}
          disabled={!dirty}
          className={`flex-1 p-2 rounded ${
            dirty ? "bg-blue-600" : "bg-gray-700 cursor-not-allowed"
          }`}
        >
          Save
        </button>
        <button onClick={onCancel} className="flex-1 p-2 rounded bg-gray-600">
          Cancel
        </button>
        {draft.documentId && (
          <button
            onClick={handleDelete}
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
        />
      )}

      {previewImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-gray-900 p-4 max-w-[90vw] max-h-[90vh] overflow-auto rounded">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-gray-900 p-4 max-w-[80vw] max-h-[80vh] overflow-auto rounded prose prose-invert">
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

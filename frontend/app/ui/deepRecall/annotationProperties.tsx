// src/components/pdfViewer/annotationProperties.tsx
import React, { useState, useEffect } from "react";
import {
  Annotation,
  AnnotationKind,
  RectangleAnnotation,
  TextAnnotation,
  Solution,
} from "../../types/annotationTypes";
import { uploadFile, deleteFile } from "../../api/uploadFile";

interface Props {
  annotation: Annotation | null;
  updateAnnotation: (a: Annotation) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  saveImage: (a: RectangleAnnotation) => Promise<void>;
  onCancel: () => void;
}

const kinds: AnnotationKind[] = [
  "Equation",
  "Plot",
  "Illustration",
  "Theorem",
  "Statement",
  "Definition",
  "Figure",
  "Table",
  "Exercise",
  "Problem",
];

const AnnotationProperties: React.FC<Props> = ({
  annotation,
  updateAnnotation,
  deleteAnnotation,
  saveImage,
  onCancel,
}) => {
  const [draft, setDraft] = useState<Annotation | null>(annotation);
  const [dirty, setDirty] = useState(false);

  // For new solution upload
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newDate, setNewDate] = useState<string>("");
  const [newNotes, setNewNotes] = useState<string>("");

  useEffect(() => {
    setDraft(annotation);
    setDirty(false);
    setNewFile(null);
    setNewDate("");
    setNewNotes("");
  }, [annotation]);

  if (!draft) {
    return <div className="p-4">No annotation selected.</div>;
  }

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
    setDraft({ ...draft, tags: vals });
    setDirty(true);
  };

  const kindChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDraft({
      ...(draft as RectangleAnnotation),
      annotationKind: e.target.value as AnnotationKind,
    });
    setDirty(true);
  };

  const colorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDraft({ ...draft, [name]: value } as Annotation);
    setDirty(true);
  };

  const handleSave = async () => {
    if (draft) {
      await updateAnnotation(draft);
      setDirty(false);
    }
  };

  const handleDelete = async () => {
    if (draft?.documentId && confirm("Delete this annotation?")) {
      await deleteAnnotation(draft.documentId);
    }
  };

  // --- Solutions for Exercise/Problem ---
  const hasSolutions =
    isRect &&
    ["Exercise", "Problem"].includes(
      (draft as RectangleAnnotation).annotationKind
    );
  const sols: Solution[] = draft.solutions ?? [];

  const handleSolutionFile = (e: React.ChangeEvent<HTMLInputElement>) =>
    setNewFile(e.target.files?.[0] ?? null);

  const addSolution = async () => {
    if (!newFile || !draft) return;
    // upload file
    const { id: fileId, url: fileUrl } = await uploadFile(newFile);
    const sol: Solution = {
      fileId,
      fileUrl,
      date:
        newDate ||
        new Date().toISOString().slice(0, 10), // YYYY-MM-DD
      notes: newNotes,
    };
    const updated = {
      ...draft,
      solutions: [...sols, sol],
    };
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
    if (!confirm("Delete this solution file?")) return;
    try {
      await deleteFile(sol.fileId);
    } catch {
      /* ignore */
    }
    const updated = {
      ...draft,
      solutions: sols.filter((_, i) => i !== idx),
    };
    setDraft(updated);
    await updateAnnotation(updated);
    setDirty(false);
  };

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

      {/* Description */}
      <label className="text-sm">Description</label>
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
        value={(draft.tags ?? []).join(", ")}
        onChange={tagsChange}
        className="w-full p-1 rounded bg-gray-800 border border-gray-600"
      />

      {/* Colors */}
      <div className="flex space-x-4">
        <div>
          <label className="text-sm block">Color</label>
          <input
            type="color"
            name="color"
            value={draft.color ?? "#000000"}
            onChange={colorChange}
            className="h-8 w-12 p-0 border-0"
          />
        </div>
        <div>
          <label className="text-sm block">Selected</label>
          <input
            type="color"
            name="selectedColor"
            value={draft.selectedColor ?? "#800080"}
            onChange={colorChange}
            className="h-8 w-12 p-0 border-0"
          />
        </div>
      </div>

      {/* Rectangle‑only fields */}
      {isRect && (
        <>
          <label className="text-sm">Kind</label>
          <select
            value={(draft as RectangleAnnotation).annotationKind}
            onChange={kindChange}
            className="w-full p-1 rounded bg-gray-800 border border-gray-600"
          >
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </>
      )}

      {/* Solutions for Exercise/Problem */}
      {hasSolutions && (
        <div className="space-y-2">
          <h4 className="font-medium">Solutions</h4>

          {/* Existing */}
          {sols.map((sol, idx) => (
            <div
              key={idx}
              className="flex items-center space-x-2 bg-gray-800 p-2 rounded"
            >
              <a
                href={sol.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                View
              </a>

              <button
                onClick={() => removeSolution(idx)}
                className="text-red-500 hover:text-red-400"
              >
                Delete
              </button>

              <input
                type="date"
                value={sol.date}
                onChange={(e) => {
                  const newSols = sols.map((s, i) =>
                    i === idx ? { ...s, date: e.target.value } : s
                  );
                  setDraft({ ...draft, solutions: newSols });
                  setDirty(true);
                }}
                className="p-1 rounded bg-gray-800 border border-gray-600"
              />

              <textarea
                value={sol.notes}
                onChange={(e) => {
                  const newSols = sols.map((s, i) =>
                    i === idx ? { ...s, notes: e.target.value } : s
                  );
                  setDraft({ ...draft, solutions: newSols });
                  setDirty(true);
                }}
                placeholder="Notes"
                className="flex-1 p-1 rounded bg-gray-800 border border-gray-600 resize-none"
              />
            </div>
          ))}

          {/* Add new */}
          <div className="flex flex-col space-y-1">
            <input
              type="file"
              onChange={handleSolutionFile}
              className="text-sm"
            />
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="p-1 rounded bg-gray-800 border border-gray-600"
            />
            <textarea
              rows={2}
              placeholder="Notes"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="p-1 rounded bg-gray-800 border border-gray-600 resize-none"
            />
            <button
              onClick={addSolution}
              disabled={!newFile}
              className={`mt-1 p-2 rounded ${
                newFile ? "bg-green-600 hover:bg-green-500" : "bg-gray-700 cursor-not-allowed"
              } text-sm`}
            >
              Add Solution
            </button>
          </div>
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
        <button
          onClick={onCancel}
          className="flex-1 p-2 rounded bg-gray-600"
        >
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
    </div>
  );
};

export default AnnotationProperties;

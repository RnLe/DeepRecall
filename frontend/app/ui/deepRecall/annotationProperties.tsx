// annotationProperties.tsx
import React, { useState, useEffect } from "react";
import {
  Annotation,
  AnnotationKind,
  RectangleAnnotation,
  TextAnnotation,
} from "../../types/annotationTypes";

interface Props {
  annotation: Annotation | null;
  updateAnnotation: (a: Annotation) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
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
];

const AnnotationProperties: React.FC<Props> = ({
  annotation,
  updateAnnotation,
  deleteAnnotation,
}) => {
  /* Draft copy so changes are not committed until Save */
  const [draft, setDraft] = useState<Annotation | null>(annotation);
  const [dirty, setDirty] = useState(false);

  /* reset draft when selection changes */
  useEffect(() => {
    setDraft(annotation);
    setDirty(false);
  }, [annotation]);

  if (!draft) return <div className="p-4">No annotation selected.</div>;

  const commonChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setDraft({ ...draft, [name]: value } as Annotation);
    setDirty(true);
  };

  /* rectangle‑specific */
  const kindChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const kind = e.target.value as AnnotationKind;
    setDraft({
      ...(draft as RectangleAnnotation),
      annotationKind: kind,
    });
    setDirty(true);
  };

  /* text highlight‑specific */
  const textChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft({
      ...(draft as TextAnnotation),
      highlightedText: e.target.value,
    });
    setDirty(true);
  };

  const onSave = async () => {
    if (draft) await updateAnnotation(draft);
    setDirty(false);
  };

  const onCancel = () => {
    setDraft(annotation);
    setDirty(false);
  };

  const onDelete = async () => {
    if (draft?.documentId && confirm("Delete this annotation?")) {
      await deleteAnnotation(draft.documentId);
    }
  };

  return (
    <div className="p-4 border-l border-gray-700 flex flex-col space-y-2">
      <h3 className="text-lg font-semibold">Properties</h3>

      <label className="text-sm">Title</label>
      <input
        name="title"
        value={draft.title ?? ""}
        onChange={commonChange}
        className="p-1 rounded bg-gray-800 border border-gray-600"
      />

      <label className="text-sm">Description</label>
      <textarea
        name="description"
        rows={3}
        value={draft.description ?? ""}
        onChange={commonChange}
        className="p-1 rounded bg-gray-800 border border-gray-600 resize-none"
      />

      {draft.type === "rectangle" && (
        <>
          <label className="text-sm">Kind</label>
          <select
            value={(draft as RectangleAnnotation).annotationKind}
            onChange={kindChange}
            className="p-1 rounded bg-gray-800 border border-gray-600"
          >
            {kinds.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </>
      )}

      {draft.type === "text" && (
        <>
          <label className="text-sm">Highlighted Text</label>
          <textarea
            rows={4}
            value={(draft as TextAnnotation).highlightedText}
            readOnly
            className="p-1 rounded bg-gray-900 border border-gray-600 resize-none"
          />
        </>
      )}

      {/* ACTIONS */}
      <div className="mt-auto flex space-x-2">
        <button
          onClick={onSave}
          disabled={!dirty}
          className={`flex-1 p-2 rounded ${
            dirty ? "bg-blue-600" : "bg-gray-700 cursor-not-allowed"
          }`}
        >
          Save
        </button>
        <button
          onClick={onCancel}
          disabled={!dirty}
          className="flex-1 p-2 rounded bg-gray-600"
        >
          Cancel
        </button>
        {draft?.documentId && (
          <button
            onClick={onDelete}
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

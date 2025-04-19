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

  const kindChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDraft({
      ...(draft as RectangleAnnotation),
      annotationKind: e.target.value as AnnotationKind,
    });
    setDirty(true);
  };

  const handleSave = async () => {
    await updateAnnotation(draft);
    setDirty(false);
  };

  const handleDelete = async () => {
    if (draft.documentId && confirm("Delete?")) {
      await deleteAnnotation(draft.documentId);
    }
  };

  const isRect = draft.type === "rectangle";
  const hasImage = Boolean(draft.extra?.imageUrl);

  return (
    <div className="p-4 border-l border-gray-700 flex flex-col space-y-3">
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
        rows={2}
        value={draft.description ?? ""}
        onChange={commonChange}
        className="p-1 rounded bg-gray-800 border border-gray-600 resize-none"
      />

      {isRect && (
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
        </>
      )}

      {draft.type === "text" && (
        <textarea
          rows={3}
          readOnly
          value={(draft as TextAnnotation).highlightedText}
          className="p-1 rounded bg-gray-900 border border-gray-600 resize-none"
        />
      )}

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
    </div>
  );
};

export default AnnotationProperties;

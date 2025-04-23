// src/components/pdfViewer/ColorAssignmentPanel.tsx
import React, { useState } from "react";
import { AnnotationType, annotationTypes } from "../../types/deepRecall/strapi/annotationTypes";
import { ColorSchemeDefinition, ColorScheme } from "../../types/deepRecall/strapi/colorSchemeTypes";

interface Props {
  colorMap: Record<AnnotationType, string>;
  setColorMap: (m: Record<AnnotationType, string>) => void;

  schemes: ColorScheme[];
  selectedSchemeId: string | null;
  onSchemeSelect: (id: string) => void;
  createScheme: (
    scheme: Omit<ColorScheme, "documentId" | "createdAt" | "updatedAt">
  ) => Promise<ColorScheme>;
  updateScheme: (
    args: {
      documentId: string;
      scheme: Omit<ColorScheme, "documentId" | "createdAt" | "updatedAt">;
    }
  ) => Promise<ColorScheme>;
  deleteScheme: (documentId: string) => Promise<void>;

  onClose: () => void;
}

const ColorAssignmentPanel: React.FC<Props> = ({
  colorMap,
  setColorMap,
  schemes,
  selectedSchemeId,
  onSchemeSelect,
  createScheme,
  updateScheme,
  deleteScheme,
  onClose,
}) => {
  const [isSaving, setIsSaving] = useState(false);

  /** Create a brand‑new scheme from the current map */
  const handleNew = async () => {
    const name = window.prompt("Enter a name for the new color scheme");
    if (!name) return;

    setIsSaving(true);
    try {
      const def: ColorSchemeDefinition = { annotationColors: colorMap };
      const created = await createScheme({ name, scheme: def });
      // immediately seed it into the UI
      setColorMap(created.scheme.annotationColors);
      onSchemeSelect(created.documentId!);
    } finally {
      setIsSaving(false);
    }
  };

  /** Save edits back to the currently selected scheme */
  const handleSave = async () => {
    if (!selectedSchemeId) return;
    setIsSaving(true);
    try {
      const existing = schemes.find(s => s.documentId === selectedSchemeId)!;
      await updateScheme({
        documentId: selectedSchemeId,
        scheme: { name: existing.name, scheme: { annotationColors: colorMap }},
      });
    } finally {
      setIsSaving(false);
    }
  };

  /** Delete the current scheme */
  const handleDelete = async () => {
    if (!selectedSchemeId || !window.confirm("Delete this scheme?")) return;
    setIsSaving(true);
    try {
      await deleteScheme(selectedSchemeId);
      const next = schemes.find(s => s.documentId !== selectedSchemeId);
      if (next) {
        onSchemeSelect(next.documentId!);
        setColorMap(next.scheme.annotationColors);
      }
    } finally {
      setIsSaving(false);
    }
  };

  /** When user picks a scheme from the dropdown */
  const handleSelect = (id: string) => {
    onSchemeSelect(id);
    const scheme = schemes.find(s => s.documentId === id);
    if (scheme) {
      setColorMap(scheme.scheme.annotationColors);
    }
  };

  const handleChange = (t: AnnotationType) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setColorMap({ ...colorMap, [t]: e.target.value });

  return (
    <div className="absolute top-16 left-4 z-50 w-72 bg-gray-800 border border-gray-600 p-4 rounded shadow-lg">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-lg font-semibold">Color Schemes</h4>
        <button onClick={onClose} className="text-white text-xl leading-none">×</button>
      </div>

      {/* Scheme selector & actions */}
      <div className="flex items-center space-x-2 mb-4">
        <select
          value={selectedSchemeId || ""}
          onChange={e => handleSelect(e.target.value)}
          className="flex-1 p-1 rounded bg-gray-700 border border-gray-600 text-sm"
        >
          {schemes.map(s => (
            <option key={s.documentId} value={s.documentId}>{s.name}</option>
          ))}
        </select>
        <button onClick={handleNew} disabled={isSaving}
          className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-sm">
          New
        </button>
      </div>
      <div className="flex items-center space-x-2 mb-4">
        <button onClick={handleSave} disabled={!selectedSchemeId || isSaving}
          className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm">
          Save
        </button>
        <button onClick={handleDelete} disabled={!selectedSchemeId || isSaving}
          className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-sm">
          Delete
        </button>
      </div>

      {/* Color table */}
      <table className="w-full table-auto">
        <thead>
          <tr>
            <th className="px-2 text-left">Type</th>
            <th className="px-2">Color</th>
          </tr>
        </thead>
        <tbody>
          {annotationTypes.map(t => (
            <tr key={t} className="hover:bg-gray-700">
              <td className="px-2 py-1 text-sm">{t}</td>
              <td className="px-2 py-1">
                <input
                  type="color"
                  value={colorMap[t]}
                  onChange={handleChange(t)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ColorAssignmentPanel;

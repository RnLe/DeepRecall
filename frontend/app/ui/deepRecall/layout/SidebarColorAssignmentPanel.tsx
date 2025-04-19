import React, { useState } from "react";
import { AnnotationType, annotationTypes } from "../../../types/annotationTypes";
import {
  ColorSchemeDefinition,
  ColorScheme,
} from "../../../types/colorSchemeTypes";

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
}

const SidebarColorAssignmentPanel: React.FC<Props> = ({
  colorMap,
  setColorMap,
  schemes,
  selectedSchemeId,
  onSchemeSelect,
  createScheme,
  updateScheme,
  deleteScheme,
}) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleNew = async () => {
    const name = window.prompt("Enter a name for the new color scheme");
    if (!name) return;

    setIsSaving(true);
    try {
      const def: ColorSchemeDefinition = { annotationColors: colorMap };
      const created = await createScheme({ name, scheme: def });
      setColorMap(created.scheme.annotationColors);
      onSchemeSelect(created.documentId!);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedSchemeId) return;
    setIsSaving(true);
    try {
      const existing = schemes.find((s) => s.documentId === selectedSchemeId)!;
      await updateScheme({
        documentId: selectedSchemeId,
        scheme: { name: existing.name, scheme: { annotationColors: colorMap } },
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSchemeId || !window.confirm("Delete this scheme?")) return;
    setIsSaving(true);
    try {
      await deleteScheme(selectedSchemeId);
      const next = schemes.find((s) => s.documentId !== selectedSchemeId);
      if (next) {
        onSchemeSelect(next.documentId!);
        setColorMap(next.scheme.annotationColors);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelect = (id: string) => {
    onSchemeSelect(id);
    const scheme = schemes.find((s) => s.documentId === id);
    if (scheme) setColorMap(scheme.scheme.annotationColors);
  };

  const handleChange = (t: AnnotationType) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) =>
    setColorMap({
      ...colorMap,
      [t]: e.target.value,
    });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <h4 className="text-lg font-semibold">Color Schemes</h4>
      </div>

      {/* Selector & New */}
      <div className="flex items-center px-4 py-2 space-x-2 border-b border-gray-700">
        <select
          value={selectedSchemeId || ""}
          onChange={(e) => handleSelect(e.target.value)}
          className="flex-1 p-1 rounded bg-gray-800 border border-gray-600 text-sm"
        >
          {schemes.map((s) => (
            <option key={s.documentId} value={s.documentId}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleNew}
          disabled={isSaving}
          className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-sm"
        >
          New
        </button>
      </div>

      {/* Save/Delete */}
      <div className="flex items-center px-4 py-2 space-x-2 border-b border-gray-700">
        <button
          onClick={handleSave}
          disabled={!selectedSchemeId || isSaving}
          className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm"
        >
          Save
        </button>
        <button
          onClick={handleDelete}
          disabled={!selectedSchemeId || isSaving}
          className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-sm"
        >
          Delete
        </button>
      </div>

      {/* Color matrix */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <table className="w-full table-auto">
          <thead>
            <tr>
              <th className="px-2 text-left">Type</th>
              <th className="px-2">Color</th>
            </tr>
          </thead>
          <tbody>
            {annotationTypes.map((t) => (
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
    </div>
  );
};

export default SidebarColorAssignmentPanel;

import React, { useState, useEffect } from "react";
import { AnnotationType, annotationTypes } from "../../../types/annotationTypes";
import {
  ColorSchemeDefinition,
  ColorScheme,
} from "../../../types/colorSchemeTypes";
import { Edit2, CheckCircle, XCircle, Trash2 } from "lucide-react";

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
  const [isEditing, setIsEditing] = useState(false);
  const [originalColorMap, setOriginalColorMap] = useState(colorMap);

  useEffect(() => {
    if (!isEditing) setOriginalColorMap(colorMap);
  }, [colorMap, isEditing]);

  const isChanged =
    JSON.stringify(colorMap) !== JSON.stringify(originalColorMap);

  const handleEdit = () => {
    setOriginalColorMap(colorMap);
    setIsEditing(true);
  };
  const handleCancel = () => {
    setColorMap(originalColorMap);
    setIsEditing(false);
  };

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
      setIsEditing(false);
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

      {/* Edit / Save / Cancel / Delete */}
      {!isEditing ? (
        <div className="flex items-center px-4 py-2">
          <button
            onClick={handleEdit}
            className="flex-1 px-2 py-1 bg-yellow-600 hover:bg-yellow-500 rounded text-sm flex items-center justify-center space-x-1"
          >
            <Edit2 size={16} /> <span>Edit</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center px-4 py-2 space-x-2">
          <button
            onClick={handleSave}
            disabled={!isChanged}
            className={`flex-1 px-2 py-1 rounded text-sm flex items-center justify-center space-x-1 ${
              isChanged
                ? "bg-blue-600 hover:bg-blue-500"
                : "bg-gray-600 cursor-not-allowed"
            }`}
          >
            <CheckCircle size={16} /> <span>Save</span>
          </button>
          <button
            onClick={handleCancel}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center justify-center space-x-1"
          >
            <XCircle size={16} /> <span>Cancel</span>
          </button>
          <button
            onClick={handleDelete}
            className="px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-sm flex items-center justify-center space-x-1"
          >
            <Trash2 size={16} /> <span>Delete</span>
          </button>
        </div>
      )}

      {/* Color circles */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="flex flex-wrap justify-center gap-6">
          {annotationTypes.map((t) => (
            <div key={t} className="flex flex-col items-center">
              <label
                className={`w-8 h-8 rounded-full border-2 ${
                  isEditing ? "cursor-pointer border-gray-600" : ""
                }`}
                style={{ backgroundColor: colorMap[t] }}
              >
                {isEditing && (
                  <input
                    type="color"
                    value={colorMap[t]}
                    onChange={handleChange(t)}
                    className="opacity-0 w-full h-full"
                  />
                )}
              </label>
              <span className="mt-1 text-sm">{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SidebarColorAssignmentPanel;

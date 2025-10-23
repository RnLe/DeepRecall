/**
 * AuthorFormFields Component
 *
 * Shared form fields for creating and editing authors
 */

import { useState } from "react";
import { Plus, X, GripVertical } from "lucide-react";

interface AuthorFormData {
  firstName: string;
  lastName: string;
  middleName: string;
  titles: string[];
  affiliation: string;
  contact: string;
  orcid: string;
  website: string;
  bio: string;
}

interface AuthorFormFieldsProps {
  formData: AuthorFormData;
  onChange: (data: AuthorFormData) => void;
}

const TITLE_SHORTCUTS = [
  "Dr.",
  "Prof.",
  "PhD",
  "M.Sc.",
  "B.Sc.",
  "M.A.",
  "B.A.",
  "Jr.",
  "Sr.",
];

export function AuthorFormFields({
  formData,
  onChange,
}: AuthorFormFieldsProps) {
  const [newTitle, setNewTitle] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newTitles = [...formData.titles];
    const draggedTitle = newTitles[draggedIndex];
    newTitles.splice(draggedIndex, 1);
    newTitles.splice(index, 0, draggedTitle);

    onChange({ ...formData, titles: newTitles });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const addTitle = (title: string) => {
    const trimmed = title.trim();
    if (trimmed && !formData.titles.includes(trimmed)) {
      onChange({
        ...formData,
        titles: [...formData.titles, trimmed],
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Name Fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1.5">
            First Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.firstName}
            onChange={(e) =>
              onChange({ ...formData, firstName: e.target.value })
            }
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1.5">
            Last Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.lastName}
            onChange={(e) =>
              onChange({ ...formData, lastName: e.target.value })
            }
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          Middle Name
        </label>
        <input
          type="text"
          value={formData.middleName}
          onChange={(e) =>
            onChange({ ...formData, middleName: e.target.value })
          }
          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Titles with Shortcuts and Drag-and-Drop */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          Titles
        </label>

        {/* Shortcut Buttons */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {TITLE_SHORTCUTS.map((shortcut) => (
            <button
              key={shortcut}
              type="button"
              onClick={() => addTitle(shortcut)}
              disabled={formData.titles.includes(shortcut)}
              className="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {shortcut}
            </button>
          ))}
        </div>

        {/* Custom Title Input */}
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTitle(newTitle);
                setNewTitle("");
              }
            }}
            placeholder="Add custom title"
            className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => {
              addTitle(newTitle);
              setNewTitle("");
            }}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Draggable Title Tags */}
        {formData.titles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {formData.titles.map((title, idx) => (
              <div
                key={idx}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className="group flex items-center gap-1 px-2 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-xs text-neutral-200 transition-colors cursor-move"
              >
                <GripVertical className="w-3 h-3 text-neutral-500" />
                <span className="italic font-serif">{title}</span>
                <button
                  type="button"
                  onClick={() => {
                    onChange({
                      ...formData,
                      titles: formData.titles.filter((_, i) => i !== idx),
                    });
                  }}
                  className="text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Professional Info */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          Affiliation
        </label>
        <input
          type="text"
          value={formData.affiliation}
          onChange={(e) =>
            onChange({ ...formData, affiliation: e.target.value })
          }
          placeholder="Institution or organization"
          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1.5">
            ORCID
          </label>
          <input
            type="text"
            value={formData.orcid}
            onChange={(e) => onChange({ ...formData, orcid: e.target.value })}
            placeholder="0000-0002-1825-0097"
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1.5">
            Contact
          </label>
          <input
            type="text"
            value={formData.contact}
            onChange={(e) => onChange({ ...formData, contact: e.target.value })}
            placeholder="Email or other contact"
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          Website
        </label>
        <input
          type="url"
          value={formData.website}
          onChange={(e) => onChange({ ...formData, website: e.target.value })}
          placeholder="https://..."
          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          Biography
        </label>
        <textarea
          value={formData.bio}
          onChange={(e) => onChange({ ...formData, bio: e.target.value })}
          placeholder="Brief biography..."
          rows={4}
          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
    </div>
  );
}

export type { AuthorFormData };

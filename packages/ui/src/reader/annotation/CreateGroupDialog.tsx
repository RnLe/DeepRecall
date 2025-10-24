/**
 * CreateGroupDialog - Modal for creating new note groups
 * Platform-agnostic dialog component
 */

"use client";

import { useState } from "react";
import { X } from "lucide-react";

const GROUP_COLORS = [
  { name: "Purple", value: "#c084fc" },
  { name: "Blue", value: "#60a5fa" },
  { name: "Green", value: "#4ade80" },
  { name: "Amber", value: "#fbbf24" },
  { name: "Red", value: "#f87171" },
  { name: "Pink", value: "#f472b6" },
];

export interface CreateGroupDialogProps {
  onClose: () => void;
  onCreate: (name: string, description?: string, color?: string) => void;
}

export function CreateGroupDialog({
  onClose,
  onCreate,
}: CreateGroupDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(GROUP_COLORS[0].value);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), description.trim() || undefined, selectedColor);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-100">
            Create Note Group
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Group Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Calculations, General, Notes..."
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a brief description..."
              rows={2}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent resize-none"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Color
            </label>
            <div className="flex gap-2">
              {GROUP_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  className={`w-10 h-10 rounded transition-all hover:brightness-110 ${
                    selectedColor === color.value
                      ? "ring-2 ring-white ring-offset-2 ring-offset-gray-800"
                      : ""
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white transition-colors"
            >
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

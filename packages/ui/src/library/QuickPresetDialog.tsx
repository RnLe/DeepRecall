/**
 * QuickPresetDialog Component
 * Simple dialog for creating a basic preset without complexity
 * Platform-agnostic - uses Electric hooks for real-time sync
 */

import { useState } from "react";
import { useCreatePreset } from "@deeprecall/data/hooks";
import type { PresetTarget } from "@deeprecall/core";
import { logger } from "@deeprecall/telemetry";

interface QuickPresetDialogProps {
  targetEntity: PresetTarget;
  onSuccess: (presetId: string) => void;
  onCancel: () => void;
}

export function QuickPresetDialog({
  targetEntity,
  onSuccess,
  onCancel,
}: QuickPresetDialogProps) {
  const createPreset = useCreatePreset();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("Please enter a name for your template");
      return;
    }

    try {
      const preset = await createPreset.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        targetEntity,
        coreFieldConfig: {
          // Show basic fields for Work
          title: { required: true },
          subtitle: { required: false },
          workType: { required: false },
          topics: { required: false },
        },
        customFields: [],
        formLayout: "single-column",
        isSystem: false,
      });

      onSuccess(preset.id);
    } catch (error) {
      logger.error("ui", "Failed to create quick preset", {
        error,
        name,
        targetEntity,
      });
      alert("Failed to create template. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-neutral-900 rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-neutral-100 mb-4">
          Create Quick Template
        </h2>
        <p className="text-sm text-neutral-400 mb-6">
          Create a simple template to get started. You can customize it later in
          the Preset Manager.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-200 mb-2">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Research Paper, Textbook, Notes..."
              className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-600"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-200 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this template for?"
              rows={3}
              className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-600 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-neutral-800 text-neutral-200 rounded-lg hover:bg-neutral-750 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPreset.isPending}
              className="flex-1 px-4 py-2.5 bg-neutral-700 text-neutral-100 rounded-lg hover:bg-neutral-600 transition-colors disabled:opacity-50"
            >
              {createPreset.isPending ? "Creating..." : "Create Template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

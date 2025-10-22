/**
 * PresetManager Component
 * UI for managing user-created presets (CRUD operations)
 */

"use client";

import { useState } from "react";
import type { Preset, PresetTarget } from "@deeprecall/core/schemas/presets";
import {
  usePresets,
  useCreatePreset,
  useUpdatePreset,
  useDeletePreset,
  useInitializePresets,
  useMissingDefaultPresets,
  useResetSinglePreset,
} from "@/src/hooks/usePresets";
import { getPresetColor } from "@/src/utils/presets";
import { DEFAULT_PRESET_NAMES } from "@deeprecall/data/repos/presets.default";

export function PresetManager() {
  const presets = usePresets();
  const createPreset = useCreatePreset();
  const updatePreset = useUpdatePreset();
  const deletePreset = useDeletePreset();
  const initializePresets = useInitializePresets();
  const missingDefaults = useMissingDefaultPresets();
  const resetSinglePreset = useResetSinglePreset();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<PresetTarget | "all">(
    "all"
  );
  const [isCreating, setIsCreating] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);

  // Filter presets (include both system and user presets)
  const filteredPresets = (presets || []).filter((preset) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = preset.name.toLowerCase().includes(query);
      const matchesDesc = preset.description?.toLowerCase().includes(query);
      if (!matchesName && !matchesDesc) return false;
    }

    // Target filter
    if (selectedTarget !== "all" && preset.targetEntity !== selectedTarget) {
      return false;
    }

    return true;
  });

  // Separate system and user presets for display
  const systemPresets = filteredPresets.filter((p) => p.isSystem);
  const userPresets = filteredPresets.filter((p) => !p.isSystem);

  // Handle delete with confirmation
  const handleDelete = async (preset: Preset) => {
    if (!confirm(`Delete preset "${preset.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deletePreset.mutateAsync(preset.id);
      console.log(`✅ Deleted preset: ${preset.name}`);
    } catch (error) {
      console.error("Failed to delete preset:", error);
      alert("Failed to delete preset");
    }
  };

  // Handle duplicate
  const handleDuplicate = async (preset: Preset) => {
    try {
      const newPreset: Omit<Preset, "id" | "createdAt" | "updatedAt"> = {
        ...preset,
        name: `${preset.name} (Copy)`,
        isSystem: false,
      };
      await createPreset.mutateAsync(newPreset);
      console.log(`✅ Duplicated preset: ${preset.name}`);
    } catch (error) {
      console.error("Failed to duplicate preset:", error);
      alert("Failed to duplicate preset");
    }
  };

  // Handle initialize missing defaults
  const handleInitializeMissing = async () => {
    if (!missingDefaults || missingDefaults.length === 0) {
      alert("All default presets are already initialized!");
      return;
    }

    const message = `Initialize ${missingDefaults.length} missing default preset(s):\n${missingDefaults.join(", ")}\n\nThis will NOT affect existing presets.`;

    if (!confirm(message)) {
      return;
    }

    try {
      await initializePresets.mutateAsync();
      alert(
        `Successfully initialized ${missingDefaults.length} default preset(s)`
      );
    } catch (error) {
      console.error("Failed to initialize defaults:", error);
      alert("Failed to initialize default presets");
    }
  };

  // Handle reset single preset
  const handleResetSingle = async (name: string) => {
    const message = `Reset "${name}" preset to its default configuration?\n\nThis will delete the current "${name}" preset and replace it with the original.`;

    if (!confirm(message)) {
      return;
    }

    try {
      const success = await resetSinglePreset.mutateAsync(name);
      if (success) {
        alert(`Successfully reset "${name}" to default`);
      } else {
        alert(`"${name}" is not a default preset`);
      }
    } catch (error) {
      console.error(`Failed to reset "${name}":`, error);
      alert(`Failed to reset "${name}"`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">
            Preset Manager
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Create and manage form templates for your library
          </p>
        </div>
        <div className="flex items-center gap-3">
          {missingDefaults && missingDefaults.length > 0 && (
            <button
              onClick={handleInitializeMissing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
              title={`Initialize ${missingDefaults.length} missing default preset(s)`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Initialize Missing ({missingDefaults.length})
            </button>
          )}
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-neutral-700 text-neutral-100 rounded-lg hover:bg-neutral-600 transition-colors flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Preset
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search presets..."
            className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-600"
          />
        </div>

        {/* Target filter */}
        <select
          value={selectedTarget}
          onChange={(e) => setSelectedTarget(e.target.value as any)}
          className="px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-600"
        >
          <option value="all">All Types</option>
          <option value="work">Work</option>
          <option value="version">Version</option>
          <option value="asset">Asset</option>
          <option value="activity">Activity</option>
          <option value="collection">Collection</option>
          <option value="edge">Edge</option>
        </select>
      </div>

      {/* Preset list */}
      {filteredPresets.length === 0 ? (
        <div className="text-center py-16 text-neutral-500">
          <svg
            className="w-16 h-16 mx-auto mb-4 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-lg">No presets found</p>
          <p className="text-sm mt-1">
            {searchQuery || selectedTarget !== "all"
              ? "Try adjusting your filters"
              : "Click 'Initialize Defaults' to get started"}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* System Presets Section */}
          {systemPresets.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-neutral-200 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-neutral-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
                Default Presets
                <span className="text-sm text-neutral-500 font-normal">
                  (Read-only, duplicate to customize)
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {systemPresets.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    onEdit={() => setEditingPreset(preset)}
                    onDelete={() => handleDelete(preset)}
                    onDuplicate={() => handleDuplicate(preset)}
                    onReset={
                      DEFAULT_PRESET_NAMES.includes(preset.name as any)
                        ? () => handleResetSingle(preset.name)
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* User Presets Section */}
          {userPresets.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-neutral-200 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-neutral-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                Custom Presets
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userPresets.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    onEdit={() => setEditingPreset(preset)}
                    onDelete={() => handleDelete(preset)}
                    onDuplicate={() => handleDuplicate(preset)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(isCreating || editingPreset) && (
        <PresetFormModal
          preset={editingPreset}
          onClose={() => {
            setIsCreating(false);
            setEditingPreset(null);
          }}
          onCreate={createPreset.mutateAsync}
          onUpdate={updatePreset.mutateAsync}
        />
      )}
    </div>
  );
}

/**
 * Individual preset card
 */
interface PresetCardProps {
  preset: Preset;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onReset?: () => void; // Only for default presets
}

function PresetCard({
  preset,
  onEdit,
  onDelete,
  onDuplicate,
  onReset,
}: PresetCardProps) {
  const isSystem = preset.isSystem;
  const hasResetButton = isSystem && onReset;

  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 space-y-3 hover:border-neutral-600 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
          style={{ backgroundColor: getPresetColor(preset.color) }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-neutral-100 truncate">
              {preset.name}
            </h3>
            {isSystem && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 flex-shrink-0">
                Default
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-400 uppercase tracking-wider mt-0.5">
            {preset.targetEntity}
          </p>
        </div>
      </div>

      {/* Description */}
      {preset.description && (
        <p className="text-sm text-neutral-400 line-clamp-2">
          {preset.description}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-neutral-500">
        <span>{preset.customFields.length} custom fields</span>
        <span>•</span>
        <span>{Object.keys(preset.coreFieldConfig).length} core fields</span>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-neutral-700">
        {isSystem ? (
          <>
            <button
              onClick={onDuplicate}
              className="w-full px-3 py-1.5 text-sm bg-neutral-750 text-neutral-200 rounded hover:bg-neutral-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Duplicate to Customize
            </button>
            {hasResetButton && (
              <button
                onClick={onReset}
                className="w-full px-3 py-1.5 text-sm bg-amber-900/30 text-amber-400 border border-amber-700/50 rounded hover:bg-amber-900/50 transition-colors flex items-center justify-center gap-1.5"
                title="Reset this preset to its original default configuration"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Reset to Default
              </button>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex-1 px-3 py-1.5 text-sm bg-neutral-750 text-neutral-200 rounded hover:bg-neutral-700 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={onDuplicate}
              className="flex-1 px-3 py-1.5 text-sm bg-neutral-750 text-neutral-200 rounded hover:bg-neutral-700 transition-colors"
            >
              Duplicate
            </button>
            <button
              onClick={onDelete}
              className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Modal for creating/editing presets
 * TODO: Implement full form builder UI
 */
interface PresetFormModalProps {
  preset: Preset | null;
  onClose: () => void;
  onCreate: (
    preset: Omit<Preset, "id" | "createdAt" | "updatedAt">
  ) => Promise<Preset>;
  onUpdate: (params: {
    id: string;
    updates: Partial<Omit<Preset, "id" | "kind" | "createdAt">>;
  }) => Promise<void>;
}

function PresetFormModal({
  preset,
  onClose,
  onCreate,
  onUpdate,
}: PresetFormModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-neutral-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-bold text-neutral-100">
            {preset ? "Edit Preset" : "Create New Preset"}
          </h2>
          <p className="text-neutral-400">
            Full preset form builder coming soon! This will include:
          </p>
          <ul className="list-disc list-inside text-sm text-neutral-400 space-y-1">
            <li>Name, description, and target entity selection</li>
            <li>Core field configuration (show/hide, required, defaults)</li>
            <li>Custom field builder (add/remove/reorder fields)</li>
            <li>Field type selection with validation rules</li>
            <li>Form layout configuration</li>
            <li>Color and icon picker</li>
          </ul>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 text-neutral-200 rounded-lg hover:bg-neutral-750 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

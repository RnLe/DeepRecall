/**
 * TemplateLibrary Component
 * Large modal (90% viewport) for managing all work templates/presets
 * Includes: viewing, initializing defaults, resetting, editing, deleting, renaming
 * UI state managed by Zustand store (ephemeral only)
 */

"use client";

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
import {
  X,
  Plus,
  RefreshCw,
  Copy,
  Edit2,
  Edit3,
  Trash2,
  Download,
  BookOpen,
  Box,
  FileText,
} from "lucide-react";
import { useTemplateLibraryUI } from "@deeprecall/data/stores/template-library-ui";
import { MessageModal } from "./MessageModal";
import { InputModal } from "./InputModal";
import { TemplateEditorModal } from "./TemplateEditorModal";
import { useState } from "react";

export function TemplateLibrary() {
  // UI state from Zustand (ephemeral)
  const isOpen = useTemplateLibraryUI((state) => state.isOpen);
  const closeModal = useTemplateLibraryUI((state) => state.closeModal);
  const searchQuery = useTemplateLibraryUI((state) => state.searchQuery);
  const setSearchQuery = useTemplateLibraryUI((state) => state.setSearchQuery);
  const selectedTarget = useTemplateLibraryUI((state) => state.selectedTarget);
  const setSelectedTarget = useTemplateLibraryUI(
    (state) => state.setSelectedTarget
  );
  const isSelectMode = useTemplateLibraryUI((state) => state.isSelectMode);
  const enableSelectMode = useTemplateLibraryUI(
    (state) => state.enableSelectMode
  );
  const disableSelectMode = useTemplateLibraryUI(
    (state) => state.disableSelectMode
  );
  const selectedIds = useTemplateLibraryUI((state) => state.selectedIds);
  const toggleSelection = useTemplateLibraryUI(
    (state) => state.toggleSelection
  );
  const selectAllVisible = useTemplateLibraryUI(
    (state) => state.selectAllVisible
  );
  const clearSelection = useTemplateLibraryUI((state) => state.clearSelection);
  const isSelected = useTemplateLibraryUI((state) => state.isSelected);

  // Message modal state
  const [messageModal, setMessageModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    onConfirm?: () => void;
    confirmText?: string;
    variant?: "info" | "warning" | "danger";
  }>({
    isOpen: false,
    title: "",
    message: "",
  });

  // Input modal state (for rename)
  const [inputModal, setInputModal] = useState<{
    isOpen: boolean;
    title: string;
    label: string;
    initialValue: string;
    onConfirm: (value: string) => void;
  }>({
    isOpen: false,
    title: "",
    label: "",
    initialValue: "",
    onConfirm: () => {},
  });

  // Editor modal state
  const [editorModal, setEditorModal] = useState<{
    isOpen: boolean;
    preset: Preset | null;
  }>({
    isOpen: false,
    preset: null,
  });

  // Data from Dexie (via React Query hooks with live updates)
  const presets = usePresets();
  const createPreset = useCreatePreset();
  const updatePreset = useUpdatePreset();
  const deletePreset = useDeletePreset();
  const initializePresets = useInitializePresets();
  const missingDefaults = useMissingDefaultPresets();
  const resetSinglePreset = useResetSinglePreset();

  if (!isOpen) return null;

  // Filter presets
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

  // Separate system and user presets
  const systemPresets = filteredPresets.filter((p) => p.isSystem);
  const userPresets = filteredPresets.filter((p) => !p.isSystem);

  // Handlers
  const handleInitializeMissing = async () => {
    const missing = missingDefaults || [];
    if (missing.length === 0) {
      setMessageModal({
        isOpen: true,
        title: "Already Initialized",
        message: "All default templates are already initialized!",
        variant: "info",
      });
      return;
    }

    setMessageModal({
      isOpen: true,
      title: "Initialize Default Templates",
      message: `Initialize ${missing.length} missing default template(s):\n\n${missing.join("\n")}\n\nThis will NOT affect existing templates.`,
      confirmText: "Initialize",
      variant: "info",
      onConfirm: async () => {
        try {
          await initializePresets.mutateAsync();
          setMessageModal({
            isOpen: true,
            title: "Success",
            message: `Successfully initialized ${missing.length} default template(s)`,
            variant: "info",
          });
        } catch (error) {
          console.error("Failed to initialize defaults:", error);
          setMessageModal({
            isOpen: true,
            title: "Error",
            message: "Failed to initialize default templates",
            variant: "danger",
          });
        }
      },
    });
  };

  // Handle reset single preset
  const handleResetSingle = async (name: string) => {
    setMessageModal({
      isOpen: true,
      title: "Reset Template",
      message: `Reset "${name}" template to its default configuration?\n\nThis will delete the current "${name}" template and replace it with the original default version.`,
      confirmText: "Reset",
      variant: "warning",
      onConfirm: async () => {
        try {
          const success = await resetSinglePreset.mutateAsync(name);
          if (success) {
            setMessageModal({
              isOpen: true,
              title: "Success",
              message: `Successfully reset "${name}" to default`,
              variant: "info",
            });
          } else {
            setMessageModal({
              isOpen: true,
              title: "Error",
              message: `"${name}" is not a default template`,
              variant: "danger",
            });
          }
        } catch (error) {
          console.error(`Failed to reset "${name}":`, error);
          setMessageModal({
            isOpen: true,
            title: "Error",
            message: `Failed to reset "${name}"`,
            variant: "danger",
          });
        }
      },
    });
  };

  // Handle duplicate
  const handleDuplicate = async (preset: Preset) => {
    try {
      const newPreset: Omit<Preset, "id" | "kind" | "createdAt" | "updatedAt"> =
        {
          ...preset,
          name: `${preset.name} (Copy)`,
          isSystem: false,
        };
      await createPreset.mutateAsync(newPreset);
      console.log(`✅ Duplicated template: ${preset.name}`);
    } catch (error) {
      console.error("Failed to duplicate template:", error);
      setMessageModal({
        isOpen: true,
        title: "Error",
        message: "Failed to duplicate template",
        variant: "danger",
      });
    }
  };

  const handleDelete = async (preset: Preset) => {
    setMessageModal({
      isOpen: true,
      title: "Delete Template",
      message: `Delete template "${preset.name}"?\n\nThis cannot be undone.`,
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          await deletePreset.mutateAsync(preset.id);
          console.log(`✅ Deleted template: ${preset.name}`);
          // Remove from selection
          if (isSelected(preset.id)) {
            toggleSelection(preset.id);
          }
        } catch (error) {
          console.error("Failed to delete template:", error);
          setMessageModal({
            isOpen: true,
            title: "Error",
            message: "Failed to delete template",
            variant: "danger",
          });
        }
      },
    });
  };

  const handleSelectAll = () => {
    const visibleIds = filteredPresets.map((p) => p.id);
    selectAllVisible(visibleIds);
  };

  const handleEdit = (preset: Preset) => {
    setEditorModal({
      isOpen: true,
      preset,
    });
  };

  const handleSaveEdit = async (updates: Partial<Preset>) => {
    if (!editorModal.preset) return;

    try {
      await updatePreset.mutateAsync({
        id: editorModal.preset.id,
        updates,
      });
      console.log(`✅ Updated template: ${editorModal.preset.name}`);
      setEditorModal({ isOpen: false, preset: null });
    } catch (error) {
      console.error("Failed to update template:", error);
      setMessageModal({
        isOpen: true,
        title: "Error",
        message: "Failed to update template",
        variant: "danger",
      });
    }
  };

  const handleDeleteSelected = async () => {
    const count = selectedIds.size;
    if (count === 0) return;

    const templates = (presets || []).filter((p) => selectedIds.has(p.id));
    const names = templates.map((p) => p.name).join("\n");

    setMessageModal({
      isOpen: true,
      title: "Delete Templates",
      message: `Delete ${count} template(s)?\n\n${names}\n\nThis cannot be undone.`,
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          await Promise.all(
            Array.from(selectedIds).map((id) => deletePreset.mutateAsync(id))
          );
          console.log(`✅ Deleted ${count} template(s)`);
          clearSelection();
          disableSelectMode(); // Exit select mode after mass deletion
        } catch (error) {
          console.error("Failed to delete templates:", error);
          setMessageModal({
            isOpen: true,
            title: "Error",
            message: "Failed to delete some templates",
            variant: "danger",
          });
        }
      },
    });
  };

  const handleRename = async (preset: Preset) => {
    setInputModal({
      isOpen: true,
      title: "Rename Template",
      label: "Template Name",
      initialValue: preset.name,
      onConfirm: async (newName: string) => {
        if (newName === preset.name) return;

        try {
          await updatePreset.mutateAsync({
            id: preset.id,
            updates: { name: newName },
          });
          console.log(`✅ Renamed template to: ${newName}`);
        } catch (error) {
          console.error("Failed to rename template:", error);
          setMessageModal({
            isOpen: true,
            title: "Error",
            message: "Failed to rename template",
            variant: "danger",
          });
        }
      },
    });
  };

  return (
    <>
      <MessageModal
        isOpen={messageModal.isOpen}
        onClose={() => setMessageModal({ ...messageModal, isOpen: false })}
        onConfirm={messageModal.onConfirm}
        title={messageModal.title}
        message={messageModal.message}
        confirmText={messageModal.confirmText}
        variant={messageModal.variant}
      />

      <InputModal
        isOpen={inputModal.isOpen}
        onClose={() => setInputModal({ ...inputModal, isOpen: false })}
        onConfirm={inputModal.onConfirm}
        title={inputModal.title}
        label={inputModal.label}
        initialValue={inputModal.initialValue}
      />

      {editorModal.preset && (
        <TemplateEditorModal
          isOpen={editorModal.isOpen}
          onClose={() => setEditorModal({ isOpen: false, preset: null })}
          onSave={handleSaveEdit}
          preset={editorModal.preset}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="bg-neutral-900 rounded-xl shadow-2xl w-[90vw] h-[90vh] flex flex-col border border-neutral-800">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-neutral-800">
            <div>
              <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-3">
                <svg
                  className="w-7 h-7 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                Template Library
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                Manage templates for creating works in your library
              </p>
            </div>
            <button
              onClick={closeModal}
              className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-6 h-6 text-neutral-400" />
            </button>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-4 p-4 border-b border-neutral-800 bg-neutral-900/50">
            {/* Search */}
            <div className="flex-1 max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-neutral-100 placeholder-neutral-500"
              />
            </div>

            {/* Type filter - Icon based */}
            <div className="flex items-center gap-1 p-1 bg-neutral-800 rounded-lg border border-neutral-700">
              <button
                onClick={() => setSelectedTarget("all")}
                className={`p-2 rounded transition-colors ${
                  selectedTarget === "all"
                    ? "bg-blue-600 text-white"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-750"
                }`}
                title="All Types"
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
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
              </button>
              <button
                onClick={() => setSelectedTarget("work")}
                className={`p-2 rounded transition-colors ${
                  selectedTarget === "work"
                    ? "bg-blue-600 text-white"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-750"
                }`}
                title="Work Templates"
              >
                <BookOpen className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedTarget("version")}
                className={`p-2 rounded transition-colors ${
                  selectedTarget === "version"
                    ? "bg-blue-600 text-white"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-750"
                }`}
                title="Version Templates"
              >
                <FileText className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedTarget("asset")}
                className={`p-2 rounded transition-colors ${
                  selectedTarget === "asset"
                    ? "bg-blue-600 text-white"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-750"
                }`}
                title="Asset Templates"
              >
                <Box className="w-4 h-4" />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-6 ml-auto">
              {/* Delete selected (only when selection exists) */}
              {selectedIds.size > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  className="px-4 py-2 bg-rose-900/30 text-rose-300 border border-rose-700/50 rounded-lg hover:bg-rose-900/50 transition-colors flex items-center gap-2 font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete ({selectedIds.size})
                </button>
              )}

              {/* Initialize missing (only when defaults are missing) */}
              {missingDefaults && missingDefaults.length > 0 && (
                <button
                  onClick={handleInitializeMissing}
                  className="px-4 py-2 bg-slate-700/50 text-slate-300 border border-slate-600/50 rounded-lg hover:bg-slate-700/70 transition-colors flex items-center gap-2 font-medium"
                  title={`Initialize ${missingDefaults.length} missing default template(s)`}
                >
                  <Download className="w-4 h-4" />
                  Initialize Missing ({missingDefaults.length})
                </button>
              )}

              {/* Selection controls - link style */}
              <div className="flex items-center gap-4 text-sm">
                {!isSelectMode ? (
                  <button
                    onClick={enableSelectMode}
                    className="text-neutral-400 hover:text-blue-400 transition-colors font-medium"
                  >
                    Select
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSelectAll}
                      className="text-neutral-400 hover:text-blue-400 transition-colors font-medium"
                    >
                      Select All
                    </button>
                    <button
                      onClick={disableSelectMode}
                      className="text-neutral-400 hover:text-red-400 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {filteredPresets.length === 0 ? (
              <div className="text-center py-16 text-neutral-500">
                <svg
                  className="w-20 h-20 mx-auto mb-4 opacity-30"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <p className="text-lg font-medium">No templates found</p>
                <p className="text-sm mt-1">
                  {searchQuery || selectedTarget !== "all"
                    ? "Try adjusting your filters"
                    : "Click 'Initialize Missing' to add default templates"}
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Default Templates Section */}
                {systemPresets.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-200 mb-4 flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-blue-400"
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
                      Default Templates
                      <span className="text-sm text-neutral-500 font-normal">
                        (Read-only · Duplicate to customize)
                      </span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {systemPresets.map((preset) => (
                        <TemplateCard
                          key={preset.id}
                          preset={preset}
                          onEdit={() => handleEdit(preset)}
                          onDuplicate={() => handleDuplicate(preset)}
                          onRename={() => handleRename(preset)}
                          onDelete={() => handleDelete(preset)}
                          onReset={
                            DEFAULT_PRESET_NAMES.includes(preset.name as any)
                              ? () => handleResetSingle(preset.name)
                              : undefined
                          }
                          isSelectable={isSelectMode}
                          isSelected={isSelected(preset.id)}
                          onToggleSelect={() => toggleSelection(preset.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Templates Section */}
                {userPresets.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-200 mb-4 flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-green-400"
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
                      Custom Templates
                      <span className="text-sm text-neutral-500 font-normal">
                        ({userPresets.length})
                      </span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {userPresets.map((preset) => (
                        <TemplateCard
                          key={preset.id}
                          preset={preset}
                          onEdit={() => handleEdit(preset)}
                          onDuplicate={() => handleDuplicate(preset)}
                          onRename={() => handleRename(preset)}
                          onDelete={() => handleDelete(preset)}
                          isSelectable={isSelectMode}
                          isSelected={isSelected(preset.id)}
                          onToggleSelect={() => toggleSelection(preset.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer stats */}
          <div className="p-4 border-t border-neutral-800 bg-neutral-900/50 text-sm text-neutral-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <span>
                  {systemPresets.length} default · {userPresets.length} custom
                </span>
                {selectedIds.size > 0 && (
                  <span className="text-blue-400 font-medium">
                    {selectedIds.size} selected
                  </span>
                )}
                {missingDefaults && missingDefaults.length > 0 && (
                  <span className="text-amber-400">
                    {missingDefaults.length} default template(s) not initialized
                  </span>
                )}
              </div>
              <span className="text-neutral-600">
                Total: {filteredPresets.length} template(s)
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Individual template card
 */
interface TemplateCardProps {
  preset: Preset;
  onDuplicate: () => void;
  onRename: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onReset?: () => void;
  isSelectable: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}

function TemplateCard({
  preset,
  onDuplicate,
  onRename,
  onDelete,
  onEdit,
  onReset,
  isSelectable,
  isSelected,
  onToggleSelect,
}: TemplateCardProps) {
  const isSystem = preset.isSystem;

  return (
    <div
      onClick={isSelectable ? onToggleSelect : undefined}
      className={`bg-neutral-800 border rounded-lg p-4 space-y-3 transition-all group relative ${
        isSelectable
          ? "cursor-pointer hover:border-blue-400/50"
          : "hover:border-neutral-600"
      } ${
        isSelected
          ? "border-blue-500 border-[3px] shadow-lg shadow-blue-500/20"
          : isSelectable
            ? "border-neutral-600"
            : "border-neutral-700"
      }`}
    >
      {/* Top-right action icons (hidden in select mode) */}
      {!isSelectable && (
        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isSystem ? (
            <>
              {/* Default template actions */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="p-1.5 hover:bg-neutral-700 rounded transition-colors text-neutral-400 hover:text-neutral-200"
                title="Edit Template"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate();
                }}
                className="p-1.5 hover:bg-neutral-700 rounded transition-colors text-neutral-400 hover:text-neutral-200"
                title="Duplicate to Customize"
              >
                <Copy className="w-4 h-4" />
              </button>
              {onReset && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReset();
                  }}
                  className="p-1.5 hover:bg-amber-900/30 rounded transition-colors text-amber-400/60 hover:text-amber-400"
                  title="Reset to Default"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </>
          ) : (
            <>
              {/* Custom template actions */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="p-1.5 hover:bg-neutral-700 rounded transition-colors text-neutral-400 hover:text-neutral-200"
                title="Edit Template"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRename();
                }}
                className="p-1.5 hover:bg-neutral-700 rounded transition-colors text-neutral-400 hover:text-neutral-200"
                title="Rename"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate();
                }}
                className="p-1.5 hover:bg-neutral-700 rounded transition-colors text-neutral-400 hover:text-neutral-200"
                title="Duplicate"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1.5 hover:bg-rose-900/30 rounded transition-colors text-rose-400/60 hover:text-rose-400"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-3 h-3 rounded-full mt-1 shrink-0"
          style={{ backgroundColor: getPresetColor(preset.color) }}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-neutral-100 truncate">
            {preset.name}
          </h3>
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
      <div className="flex items-center gap-3 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
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
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
          {preset.customFields.length} custom
        </span>
        <span>•</span>
        <span className="flex items-center gap-1">
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          {Object.keys(preset.coreFieldConfig).length} core
        </span>
      </div>
    </div>
  );
}

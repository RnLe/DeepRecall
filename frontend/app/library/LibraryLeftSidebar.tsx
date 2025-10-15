/**
 * LibraryLeftSidebar Component
 * Displays collections, activities, and presets in a compact sidebar
 */

"use client";

import {
  useCollections,
  useActivities,
  useWorksExtended,
} from "@/src/hooks/useLibrary";
import { useWorkPresets, useDeletePreset } from "@/src/hooks/usePresets";
import { useMemo, useState } from "react";
import { Folder, Calendar, FileText, Plus, Trash2 } from "lucide-react";
import { PresetFormBuilder } from "./PresetFormBuilder";

interface LibraryLeftSidebarProps {
  onCreateWorkWithPreset?: (presetId: string) => void;
}

export function LibraryLeftSidebar({
  onCreateWorkWithPreset,
}: LibraryLeftSidebarProps) {
  const collections = useCollections();
  const activities = useActivities();
  const works = useWorksExtended();
  const { system: systemPresets, user: userPresets } = useWorkPresets();
  const deletePresetMutation = useDeletePreset();
  const [isCreatePresetOpen, setIsCreatePresetOpen] = useState(false);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);

  const allPresets = useMemo(
    () => [...(systemPresets || []), ...(userPresets || [])],
    [systemPresets, userPresets]
  );

  // Count works per preset
  const presetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (works) {
      works.forEach((work) => {
        const presetId = work.metadata?._presetId as string | undefined;
        if (presetId) {
          counts[presetId] = (counts[presetId] || 0) + 1;
        }
      });
    }
    return counts;
  }, [works]);

  return (
    <div className="w-64 bg-neutral-900/50 border-r border-neutral-800 p-4 space-y-6 overflow-y-auto">
      {/* Collections Section */}
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-400 mb-3">
          <Folder className="w-4 h-4" />
          <span>Collections</span>
        </div>
        {collections && collections.length > 0 ? (
          <div className="space-y-1">
            {collections.map((collection) => (
              <button
                key={collection.id}
                className="w-full text-left px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800/50 rounded transition-colors truncate"
              >
                {collection.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-600 px-3">No collections yet</p>
        )}
      </div>

      {/* Activities Section */}
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-400 mb-3">
          <Calendar className="w-4 h-4" />
          <span>Activities</span>
        </div>
        {activities && activities.length > 0 ? (
          <div className="space-y-1">
            {activities.map((activity) => (
              <button
                key={activity.id}
                className="w-full text-left px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800/50 rounded transition-colors truncate"
              >
                {activity.title}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-600 px-3">No activities yet</p>
        )}
      </div>

      {/* Presets Section */}
      <div>
        <div className="flex items-center justify-between text-sm font-medium text-neutral-400 mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>Templates</span>
          </div>
          <button
            onClick={() => setIsCreatePresetOpen(true)}
            className="p-1 hover:bg-neutral-800/50 rounded transition-colors"
            title="Create new template"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {allPresets.length > 0 ? (
          <div className="space-y-1">
            {allPresets.map((preset) => {
              const count = presetCounts[preset.id] || 0;
              const isDeleting = deletingPresetId === preset.id;
              const canDelete = !preset.isSystem;

              const handleDeletePreset = async (e: React.MouseEvent) => {
                e.stopPropagation();
                if (!isDeleting) {
                  setDeletingPresetId(preset.id);
                  setTimeout(() => setDeletingPresetId(null), 3000);
                  return;
                }

                if (count > 0) {
                  alert(
                    `Cannot delete template "${preset.name}" because ${count} work(s) are using it.`
                  );
                  setDeletingPresetId(null);
                  return;
                }

                try {
                  await deletePresetMutation.mutateAsync(preset.id);
                  setDeletingPresetId(null);
                } catch (error) {
                  console.error("Failed to delete preset:", error);
                  alert("Failed to delete template. Please try again.");
                  setDeletingPresetId(null);
                }
              };

              return (
                <div
                  key={preset.id}
                  className="group flex items-center justify-between px-3 py-1.5 hover:bg-neutral-800/50 rounded transition-colors"
                >
                  <button
                    className="flex-1 text-left text-sm text-neutral-300 truncate"
                    title={preset.description}
                  >
                    <span>{preset.name}</span>
                    {count > 0 && (
                      <span className="ml-2 text-xs text-neutral-600">
                        ({count})
                      </span>
                    )}
                    {preset.isSystem && (
                      <span className="ml-2 text-xs text-neutral-600">
                        (System)
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => onCreateWorkWithPreset?.(preset.id)}
                      className="p-0.5 hover:bg-neutral-700 rounded transition-all"
                      title={`Create work with ${preset.name} template`}
                    >
                      <Plus className="w-3.5 h-3.5 text-neutral-400" />
                    </button>
                    {canDelete && (
                      <button
                        onClick={handleDeletePreset}
                        className={`p-0.5 rounded transition-all ${
                          isDeleting
                            ? "bg-red-500 text-white"
                            : "hover:bg-red-500/20 text-neutral-400 hover:text-red-400"
                        }`}
                        title={
                          isDeleting
                            ? "Click again to confirm"
                            : "Delete template"
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-neutral-600 px-3">No templates yet</p>
        )}
      </div>

      {/* Preset Form Builder Dialog */}
      {isCreatePresetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-neutral-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-semibold text-neutral-100 mb-4">
              Create Template
            </h3>
            <PresetFormBuilder
              targetEntity="work"
              onSuccess={(presetId) => {
                setIsCreatePresetOpen(false);
              }}
              onCancel={() => setIsCreatePresetOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

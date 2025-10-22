/**
 * EditWorkDialog Component
 * Compact dialog for editing an existing Work
 * Similar to CreateWorkDialog but optimized for smaller size
 */

"use client";

import { useState, useMemo } from "react";
import { useWorkPresets } from "@/src/hooks/usePresets";
import { useUpdateWork } from "@/src/hooks/useLibrary";
import type { WorkExtended } from "@deeprecall/core/schemas/library";
import { CompactDynamicForm } from "./CompactDynamicForm";
import { PDFPreview } from "../reader/PDFPreview";
import { AuthorInput } from "./AuthorInput";
import { useAuthorsByIds } from "@/src/hooks/useAuthors";

interface EditWorkDialogProps {
  work: WorkExtended;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditWorkDialog({
  work,
  isOpen,
  onClose,
  onSuccess,
}: EditWorkDialogProps) {
  const { system: systemPresetsRaw, user: userPresetsRaw } = useWorkPresets();
  const updateWorkMutation = useUpdateWork();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);
  const [selectedPresetIdState, setSelectedPresetIdState] = useState<
    string | null
  >(null);
  const [authorIds, setAuthorIds] = useState<string[]>(work.authorIds || []);

  const { data: selectedAuthors = [] } = useAuthorsByIds(authorIds);

  // Flatten system and user presets into single array
  const allPresets = useMemo(
    () => [...(systemPresetsRaw || []), ...(userPresetsRaw || [])],
    [systemPresetsRaw, userPresetsRaw]
  );

  // Find the preset for this work (can be changed by user)
  const selectedPreset = useMemo(() => {
    const presetId = selectedPresetIdState || work.presetId;
    if (!presetId || !allPresets) return null;
    return allPresets.find((p) => p.id === presetId) || null;
  }, [selectedPresetIdState, work.presetId, allPresets]);

  // Reset selected preset and authorIds when work changes
  useMemo(() => {
    setSelectedPresetIdState(null);
    setAuthorIds(work.authorIds || []);
  }, [work.id, work.authorIds]);

  // Convert work data to form initial values
  const initialValues = useMemo(() => {
    const values: Record<string, unknown> = {
      title: work.title,
      subtitle: work.subtitle,
      workType: work.workType,
      topics: work.topics,
      year: work.year,
      publisher: work.publisher,
      doi: work.doi,
      isbn: work.isbn,
      arxivId: work.arxivId,
      journal: work.journal,
      volume: work.volume,
      issue: work.issue,
      pages: work.pages,
      publishingDate: work.publishingDate,
      notes: work.notes,
      read: work.read,
    };

    // Include metadata fields
    if (work.metadata) {
      Object.entries(work.metadata).forEach(([key, value]) => {
        values[key] = value;
      });
    }

    return values;
  }, [work]);

  const handleSubmit = async (data: {
    coreFields: Record<string, unknown>;
    metadata: Record<string, unknown>;
  }) => {
    if (!selectedPreset) return;

    try {
      setIsSubmitting(true);
      console.log("Updating work with:", data);

      const { coreFields, metadata } = data;

      // Prepare update data
      const updates = {
        title: (coreFields.title as string) || work.title,
        subtitle: coreFields.subtitle as string | undefined,
        authorIds, // Use authorIds from state
        workType: (coreFields.workType as any) || work.workType,
        topics: (coreFields.topics as string[]) || [],
        year: coreFields.year as number | undefined,
        publisher: coreFields.publisher as string | undefined,
        doi: coreFields.doi as string | undefined,
        isbn: coreFields.isbn as string | undefined,
        arxivId: coreFields.arxivId as string | undefined,
        journal: coreFields.journal as string | undefined,
        volume: coreFields.volume as string | undefined,
        issue: coreFields.issue as string | undefined,
        pages: coreFields.pages as string | undefined,
        publishingDate: coreFields.publishingDate as string | undefined,
        notes: coreFields.notes as string | undefined,
        read: coreFields.read as string | undefined,
        presetId: selectedPreset.id, // Update preset if changed
        metadata,
      };

      await updateWorkMutation.mutateAsync({
        id: work.id,
        updates,
      });

      console.log("✅ Work updated successfully!");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("❌ Failed to update work:", error);
      alert(
        `Failed to update work: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get main asset for PDF preview (must be before conditional return)
  const mainAsset = useMemo(() => {
    return work.assets?.find(
      (a) => a.role === "main" && a.mime === "application/pdf"
    );
  }, [work.assets]);

  // Group presets by system/user
  const systemPresets = useMemo(
    () => allPresets.filter((p) => p.isSystem && p.targetEntity === "work"),
    [allPresets]
  );
  const userPresets = useMemo(
    () => allPresets.filter((p) => !p.isSystem && p.targetEntity === "work"),
    [allPresets]
  );

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetIdState(presetId);
    setIsPresetDropdownOpen(false);
  };

  if (!isOpen || !selectedPreset) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {/* Wide Dialog - 95% of viewport with horizontal split */}
      <div className="bg-neutral-900 rounded-xl shadow-2xl w-[95vw] max-h-[90vh] flex flex-col border border-neutral-800">
        {/* Fixed Header - Compact with Template Selector */}
        <div className="shrink-0 px-6 py-4 border-b border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <svg
                  className="w-4 h-4 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-neutral-100 truncate">
                  Edit Work
                </h2>
                <p className="text-xs text-neutral-400 truncate">
                  {work.title}
                </p>
              </div>

              {/* Template Selector Dropdown */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setIsPresetDropdownOpen(!isPresetDropdownOpen)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:brightness-110"
                  style={{
                    backgroundColor: selectedPreset.color
                      ? `${selectedPreset.color}20`
                      : "rgba(148, 163, 184, 0.2)",
                    color: selectedPreset.color || "#94a3b8",
                    borderWidth: "1px",
                    borderStyle: "solid",
                    borderColor: selectedPreset.color
                      ? `${selectedPreset.color}40`
                      : "rgba(148, 163, 184, 0.4)",
                  }}
                >
                  <svg
                    className="w-3.5 h-3.5 mr-1.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  {selectedPreset.name}
                  <svg
                    className={`w-3.5 h-3.5 ml-1.5 transition-transform ${
                      isPresetDropdownOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {isPresetDropdownOpen && (
                  <div className="absolute top-full mt-2 right-0 w-72 max-h-96 overflow-y-auto bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl shadow-black/50 z-50">
                    {/* System Templates */}
                    {systemPresets.length > 0 && (
                      <div className="p-2">
                        <div className="px-2 py-1.5 text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                          System Templates
                        </div>
                        {systemPresets.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => handlePresetChange(preset.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg transition-all hover:bg-neutral-700/50 ${
                              selectedPreset.id === preset.id
                                ? "bg-neutral-700/30"
                                : ""
                            }`}
                          >
                            <div
                              className="inline-flex items-center px-2 py-1 text-xs font-medium rounded"
                              style={{
                                backgroundColor: preset.color
                                  ? `${preset.color}20`
                                  : "rgba(148, 163, 184, 0.2)",
                                color: preset.color || "#94a3b8",
                                borderWidth: "1px",
                                borderStyle: "solid",
                                borderColor: preset.color
                                  ? `${preset.color}40`
                                  : "rgba(148, 163, 184, 0.4)",
                              }}
                            >
                              {preset.name}
                            </div>
                            {preset.description && (
                              <p className="text-xs text-neutral-500 mt-1 ml-1">
                                {preset.description}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* User Templates */}
                    {userPresets.length > 0 && (
                      <div className="p-2 border-t border-neutral-700">
                        <div className="px-2 py-1.5 text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                          My Templates
                        </div>
                        {userPresets.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => handlePresetChange(preset.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg transition-all hover:bg-neutral-700/50 ${
                              selectedPreset.id === preset.id
                                ? "bg-neutral-700/30"
                                : ""
                            }`}
                          >
                            <div
                              className="inline-flex items-center px-2 py-1 text-xs font-medium rounded"
                              style={{
                                backgroundColor: preset.color
                                  ? `${preset.color}20`
                                  : "rgba(148, 163, 184, 0.2)",
                                color: preset.color || "#94a3b8",
                                borderWidth: "1px",
                                borderStyle: "solid",
                                borderColor: preset.color
                                  ? `${preset.color}40`
                                  : "rgba(148, 163, 184, 0.4)",
                              }}
                            >
                              {preset.name}
                            </div>
                            {preset.description && (
                              <p className="text-xs text-neutral-500 mt-1 ml-1">
                                {preset.description}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors shrink-0 ml-3"
              title="Close"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content Area - Horizontal Split */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left: Form */}
          <div className="flex-1 overflow-y-auto px-6 py-5 border-r border-neutral-800">
            {/* Authors Field */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Authors
              </label>
              <AuthorInput
                value={authorIds}
                authors={selectedAuthors}
                onChange={setAuthorIds}
                placeholder="Search or add authors (e.g., 'Smith, John and Doe, Jane')..."
              />
            </div>

            <CompactDynamicForm
              preset={selectedPreset}
              initialValues={initialValues}
              onSubmit={handleSubmit}
              onCancel={onClose}
              submitLabel="Update Work"
              isSubmitting={isSubmitting}
            />
          </div>

          {/* Right: PDF Preview */}
          <div className="w-[45%] flex flex-col bg-neutral-950">
            {mainAsset ? (
              <PDFPreview
                source={`/api/blob/${mainAsset.sha256}`}
                sha256={mainAsset.sha256}
                showToolbar={true}
                autoFitToWidth={true}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-neutral-500">
                <div className="text-center">
                  <svg
                    className="w-16 h-16 mx-auto mb-3 opacity-30"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-sm">No PDF attached</p>
                  <p className="text-xs text-neutral-600 mt-1">
                    Add a main PDF to preview it here
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

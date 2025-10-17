/**
 * LinkBlobDialog Component
 * Dialog for linking an orphaned blob to a new or existing Work
 * Supports two modes: link to existing work or create new work
 */

"use client";

import { useState, useMemo } from "react";
import type { BlobWithMetadata } from "@/src/schema/blobs";
import type { Preset } from "@/src/schema/presets";
import { useWorkPresets } from "@/src/hooks/usePresets";
import { useWorksExtended } from "@/src/hooks/useLibrary";
import { PresetSelector } from "./PresetSelector";
import { WorkSelector } from "./WorkSelector";
import { DynamicForm } from "./DynamicForm";
import { PresetFormBuilder } from "./PresetFormBuilder";
import { useCreateWorkWithAsset } from "@/src/hooks/useLibrary";
import { Plus, Link2 } from "lucide-react";

interface LinkBlobDialogProps {
  /** Blob to link */
  blob: BlobWithMetadata;
  /** Pre-selected work ID (from drag-and-drop) */
  preselectedWorkId?: string | null;
  /** Callback when blob is successfully linked */
  onSuccess: () => void;
  /** Callback when dialog is cancelled */
  onCancel: () => void;
}

type Mode = "link-to-existing" | "create-new";
type Step = "select" | "form" | "create-preset";

export function LinkBlobDialog({
  blob,
  preselectedWorkId,
  onSuccess,
  onCancel,
}: LinkBlobDialogProps) {
  const { system: systemPresets, user: userPresets } = useWorkPresets();
  const works = useWorksExtended();
  const createWorkMutation = useCreateWorkWithAsset();

  const [mode, setMode] = useState<Mode>(
    preselectedWorkId ? "link-to-existing" : "create-new"
  );
  const [step, setStep] = useState<Step>("select");
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(
    preselectedWorkId || null
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  // Get all presets and selected entities
  const allPresets = useMemo(
    () => [...(systemPresets || []), ...(userPresets || [])],
    [systemPresets, userPresets]
  );
  const selectedPreset = allPresets.find((p) => p.id === selectedPresetId);
  const selectedWork = works?.find((w) => w.id === selectedWorkId);

  // Extract initial values from blob pdfMetadata
  const initialValues = blob.pdfMetadata
    ? {
        title: blob.pdfMetadata.title || blob.filename || "Untitled",
        // PDF author field is a string, would need parsing for multiple authors
        // Add more metadata mappings as needed
      }
    : {
        title: blob.filename || "Untitled",
      };

  // Handle preset selection
  const handlePresetSelect = (presetId: string | null) => {
    setSelectedPresetId(presetId);
    if (presetId) {
      setStep("form");
    }
  };

  // Handle form submission
  const handleSubmit = async ({
    coreFields,
    metadata,
  }: {
    coreFields: Record<string, unknown>;
    metadata: Record<string, unknown>;
  }) => {
    if (!selectedPreset) return;

    try {
      console.log("Creating work with:", { coreFields, metadata, blob });

      // Parse authors field - handle both string and array
      let authors: { name: string }[] = [];
      if (typeof coreFields.authors === "string") {
        // Split by comma and create author objects
        authors = coreFields.authors
          .split(",")
          .map((name) => ({ name: name.trim() }))
          .filter((a) => a.name.length > 0);
      } else if (Array.isArray(coreFields.authors)) {
        authors = coreFields.authors as { name: string }[];
      }

      // Create Work + Asset in a single transaction
      await createWorkMutation.mutateAsync({
        work: {
          kind: "work" as const,
          title: (coreFields.title as string) || "Untitled",
          subtitle: coreFields.subtitle as string | undefined,
          authors,
          workType: (coreFields.workType as any) || "other",
          topics: (coreFields.topics as string[]) || [],
          favorite: false,
          presetId: selectedPreset.id,
          allowMultipleAssets: false,
          year: coreFields.year as number | undefined,
          publisher: coreFields.publisher as string | undefined,
          doi: coreFields.doi as string | undefined,
          isbn: coreFields.isbn as string | undefined,
          metadata,
        },
        asset: {
          sha256: blob.sha256,
          filename: blob.filename || "unknown.pdf",
          bytes: blob.size,
          mime: blob.mime,
          role: "main",
          pageCount: blob.pageCount,
        },
      });

      console.log("✅ Work created successfully!");
      onSuccess();
    } catch (error) {
      console.error("❌ Failed to create work:", error);
      alert(
        `Failed to create work: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  // Group presets by system/user
  const systemPresetsFiltered = allPresets.filter((p) => p.isSystem);
  const userPresetsFiltered = allPresets.filter((p) => !p.isSystem);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {/* Dialog - 80% of viewport */}
      <div className="bg-neutral-900 rounded-xl shadow-2xl w-[80vw] h-[80vh] flex flex-col border border-neutral-800">
        {/* Fixed Header */}
        <div className="flex-shrink-0 px-8 py-6 border-b border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-neutral-100">
                Link File to Library
              </h2>
              <p className="text-sm text-neutral-400 mt-1.5">
                Linking:{" "}
                <span className="text-neutral-300 font-medium">
                  {blob.filename || blob.sha256.slice(0, 16)}
                </span>
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
              title="Close"
            >
              <svg
                className="w-6 h-6"
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

          {/* Mode Tabs - Only show on select step */}
          {step === "select" && (
            <div className="flex gap-2 mt-6 border-b border-neutral-800">
              <button
                onClick={() => setMode("link-to-existing")}
                className={`flex items-center gap-2 px-5 py-3 rounded-t-lg transition-all font-medium ${
                  mode === "link-to-existing"
                    ? "bg-neutral-800 text-neutral-100 border-b-2 border-blue-500"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
                }`}
              >
                <Link2 className="w-4 h-4" />
                Link to Existing Work
              </button>
              <button
                onClick={() => {
                  setMode("create-new");
                  setSelectedWorkId(null);
                }}
                className={`flex items-center gap-2 px-5 py-3 rounded-t-lg transition-all font-medium ${
                  mode === "create-new"
                    ? "bg-neutral-800 text-neutral-100 border-b-2 border-emerald-500"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
                }`}
              >
                <Plus className="w-4 h-4" />
                Create New Work
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-8 py-6 min-h-0">
          {/* Mode: Link to Existing Work */}
          {mode === "link-to-existing" && step === "select" && (
            <div className="space-y-6">
              <WorkSelector
                value={selectedWorkId}
                onChange={(workId) => {
                  setSelectedWorkId(workId);
                  // TODO: Move to asset metadata form step
                  // For now, just select
                }}
              />

              {works && works.length === 0 && (
                <div className="border-2 border-dashed border-neutral-700 rounded-xl p-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-800 text-neutral-400 mb-4">
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-neutral-300 mb-2 text-lg font-semibold">
                    No works yet
                  </p>
                  <p className="text-sm text-neutral-500 mb-6">
                    Create your first work to link files to it
                  </p>
                  <button
                    onClick={() => setMode("create-new")}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                  >
                    Create New Work
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mode: Create New Work - Step 1: Select Preset */}
          {mode === "create-new" && step === "select" && (
            <div className="space-y-6">
              {allPresets.length > 0 ? (
                <>
                  {/* System Templates */}
                  {systemPresetsFiltered.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-200 mb-4 flex items-center gap-2">
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
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        System Templates
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {systemPresetsFiltered.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => handlePresetSelect(preset.id)}
                            className={`group relative bg-neutral-800/50 border rounded-xl p-5 text-left transition-all hover:bg-neutral-800 hover:border-neutral-600 hover:shadow-lg ${
                              selectedPresetId === preset.id
                                ? "border-blue-500 bg-blue-950/20"
                                : "border-neutral-700"
                            }`}
                          >
                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-xl opacity-50 group-hover:opacity-100 transition-opacity" />

                            <div className="pl-3">
                              <h4 className="font-semibold text-neutral-100 mb-1.5 text-base">
                                {preset.name}
                              </h4>
                              {preset.description && (
                                <p className="text-sm text-neutral-400 line-clamp-2 mb-3">
                                  {preset.description}
                                </p>
                              )}

                              <div className="flex items-center gap-2 text-xs text-neutral-500">
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
                                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                    />
                                  </svg>
                                  {preset.customFields.length} custom fields
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* User Templates */}
                  {userPresetsFiltered.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-200 mb-4 flex items-center gap-2">
                        <svg
                          className="w-5 h-5 text-emerald-400"
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
                        My Templates
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {userPresetsFiltered.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => handlePresetSelect(preset.id)}
                            className={`group relative bg-neutral-800/50 border rounded-xl p-5 text-left transition-all hover:bg-neutral-800 hover:border-neutral-600 hover:shadow-lg ${
                              selectedPresetId === preset.id
                                ? "border-emerald-500 bg-emerald-950/20"
                                : "border-neutral-700"
                            }`}
                          >
                            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 rounded-l-xl opacity-50 group-hover:opacity-100 transition-opacity" />

                            <div className="pl-3">
                              <h4 className="font-semibold text-neutral-100 mb-1.5 text-base">
                                {preset.name}
                              </h4>
                              {preset.description && (
                                <p className="text-sm text-neutral-400 line-clamp-2 mb-3">
                                  {preset.description}
                                </p>
                              )}

                              <div className="flex items-center gap-2 text-xs text-neutral-500">
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
                                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                    />
                                  </svg>
                                  {preset.customFields.length} custom fields
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Create New Template Card */}
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-200 mb-4 flex items-center gap-2">
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
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Or Create New Template
                    </h3>
                    <button
                      onClick={() => setStep("create-preset")}
                      className="w-full border-2 border-dashed border-neutral-700 rounded-xl p-8 text-center hover:border-neutral-600 hover:bg-neutral-800/30 transition-all group"
                    >
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-neutral-800 text-neutral-400 group-hover:bg-neutral-700 group-hover:text-neutral-300 transition-colors mb-3">
                        <svg
                          className="w-6 h-6"
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
                      </div>
                      <p className="text-neutral-300 font-medium mb-1">
                        Create Custom Template
                      </p>
                      <p className="text-sm text-neutral-500">
                        Design your own template with custom fields
                      </p>
                    </button>
                  </div>
                </>
              ) : (
                <div className="border-2 border-dashed border-neutral-700 rounded-xl p-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-800 text-neutral-400 mb-4">
                    <svg
                      className="w-8 h-8"
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
                  </div>
                  <p className="text-neutral-300 mb-2 text-lg font-semibold">
                    No templates available yet
                  </p>
                  <p className="text-sm text-neutral-500 mb-6">
                    Create your first template to get started
                  </p>
                  <button
                    onClick={() => setStep("create-preset")}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Create Template
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Create Preset Step */}
          {step === "create-preset" && (
            <div className="space-y-4">
              {/* Back button */}
              <button
                onClick={() => setStep("select")}
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-300 transition-colors"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to Templates
              </button>

              <PresetFormBuilder
                targetEntity="work"
                onSuccess={(presetId) => {
                  // Auto-select the newly created preset and go to form
                  setSelectedPresetId(presetId);
                  setStep("form");
                }}
                onCancel={() => setStep("select")}
              />
            </div>
          )}

          {/* Step 2: Fill Form */}
          {step === "form" && selectedPreset && (
            <div className="space-y-4">
              {/* Back button */}
              <button
                onClick={() => setStep("select")}
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-300 transition-colors"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Change Template
              </button>

              {/* Form */}
              <DynamicForm
                preset={selectedPreset}
                initialValues={initialValues}
                onSubmit={handleSubmit}
                onCancel={onCancel}
                submitLabel="Create Work"
                isSubmitting={createWorkMutation.isPending}
              />
            </div>
          )}
        </div>

        {/* Fixed Footer - Show on select step */}
        {step === "select" && (
          <div className="flex-shrink-0 px-8 py-4 border-t border-neutral-800 bg-neutral-900/50">
            <div className="flex justify-between items-center">
              <div className="text-sm text-neutral-500">
                {mode === "link-to-existing" && selectedWorkId && (
                  <span className="text-neutral-400">
                    Work selected • Ready to continue
                  </span>
                )}
                {mode === "create-new" && (
                  <span className="text-neutral-400">
                    {allPresets.length} templates available
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="px-6 py-2.5 bg-neutral-800 text-neutral-200 rounded-lg hover:bg-neutral-750 transition-colors font-medium"
                >
                  Cancel
                </button>
                {mode === "link-to-existing" && selectedWorkId && (
                  <button
                    onClick={async () => {
                      if (!selectedWork || !selectedWorkId) return;

                      try {
                        // Import the asset repo
                        const { createAsset } = await import(
                          "@/src/repo/assets"
                        );

                        // Create asset linked directly to the work
                        await createAsset({
                          kind: "asset",
                          workId: selectedWorkId,
                          sha256: blob.sha256,
                          filename: blob.filename || "unknown.pdf",
                          bytes: blob.size,
                          mime: blob.mime,
                          role: "main",
                          pageCount: blob.pageCount,
                          favorite: false,
                        });

                        console.log("✅ Asset linked to work successfully!");
                        // Trigger success callback which invalidates queries
                        onSuccess();
                      } catch (error) {
                        console.error("❌ Failed to link asset:", error);
                        alert(
                          `Failed to link asset: ${error instanceof Error ? error.message : "Unknown error"}`
                        );
                      }
                    }}
                    disabled={createWorkMutation.isPending}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-blue-800 disabled:cursor-not-allowed"
                  >
                    {createWorkMutation.isPending ? "Linking..." : "Continue"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

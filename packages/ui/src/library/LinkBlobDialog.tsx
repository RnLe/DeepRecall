/**
 * LinkBlobDialog Component
 * Dialog for linking an orphaned blob to a new or existing Work
 * Supports two modes: link to existing work or create new work
 *
 * Platform-agnostic - uses Electric hooks for real-time sync
 */

import { useState, useMemo } from "react";
import type { BlobWithMetadata, Preset, Author } from "@deeprecall/core";
import type { BibtexEntry } from "./BibtexImportModal";

// Electric hooks - platform-agnostic
import { usePresets } from "@deeprecall/data/hooks";
import { useWorks, useCreateWork } from "@deeprecall/data/hooks";
import { useAssets, useCreateAsset } from "@deeprecall/data/hooks";
import { useAuthors, useFindOrCreateAuthor } from "@deeprecall/data/hooks";

// Icons
import { Plus, Link2, FileCode } from "lucide-react";

// Component imports
import { WorkSelector, type WorkSelectorOperations } from "./WorkSelector";
import { DynamicForm } from "./DynamicForm";
import { PresetFormBuilder } from "./PresetFormBuilder";
import { BibtexImportModal, BibtexImportOperations } from "./BibtexImportModal";
import { AuthorInput, AuthorOperations } from "./AuthorInput";

export interface LinkBlobDialogOperations {
  bibtexToWorkFormValues: (entry: BibtexEntry) => Record<string, unknown>;
  parseAuthorList: (input: string) => Array<{
    firstName: string;
    lastName: string;
    middleName?: string;
    orcid?: string;
  }>;
}

interface LinkBlobDialogProps {
  /** Blob to link */
  blob: BlobWithMetadata;
  /** Pre-selected work ID (from drag-and-drop) */
  preselectedWorkId?: string | null;
  /** Callback when blob is successfully linked */
  onSuccess: () => void;
  /** Callback when dialog is cancelled */
  onCancel: () => void;
  /** Platform-specific blob URL resolver */
  getBlobUrl: (sha256: string) => string;
  /** Platform-specific operations */
  operations: LinkBlobDialogOperations;
  /** Author operations */
  authorOps: AuthorOperations;
  /** BibTeX operations */
  bibtexOps: BibtexImportOperations;
  /** Work selector operations */
  workSelectorOps: WorkSelectorOperations;
  /** PDF Preview component */
  PDFPreview: React.ComponentType<{
    source: string;
    sha256: string;
    showToolbar?: boolean;
    autoFitToHeight?: boolean;
  }>;
}

type Mode = "link-to-existing" | "create-new";
type Step = "select" | "form" | "create-preset";

export function LinkBlobDialog({
  blob,
  preselectedWorkId,
  onSuccess,
  onCancel,
  getBlobUrl,
  operations,
  authorOps,
  bibtexOps,
  workSelectorOps,
  PDFPreview,
}: LinkBlobDialogProps) {
  // Electric hooks - real-time synced data
  const { data: allPresets = [], isLoading: presetsLoading } = usePresets();
  const { data: allWorks = [], isLoading: worksLoading } = useWorks();
  const { data: allAssets = [] } = useAssets();

  // Mutations
  const createWork = useCreateWork();
  const createAsset = useCreateAsset();
  const findOrCreateAuthor = useFindOrCreateAuthor();

  const [mode, setMode] = useState<Mode>(
    preselectedWorkId ? "link-to-existing" : "create-new"
  );
  const [step, setStep] = useState<Step>("select");
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(
    preselectedWorkId || null
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [bibtexModalOpen, setBibtexModalOpen] = useState(false);
  const [prefillValues, setPrefillValues] = useState<Record<string, unknown>>(
    {}
  );
  const [authorIds, setAuthorIds] = useState<string[]>([]);

  // Get all authors for lookup
  const { data: allAuthors = [] } = useAuthors();

  // Get selected authors
  const selectedAuthors = useMemo(() => {
    return allAuthors.filter((a: Author) => authorIds.includes(a.id));
  }, [authorIds, allAuthors]);

  // Client-side join: Works with Assets
  const worksExtended = useMemo(() => {
    if (!allWorks || !allAssets) return [];
    return allWorks.map((work) => ({
      ...work,
      assets: allAssets.filter((asset: any) => asset.workId === work.id),
    }));
  }, [allWorks, allAssets]);

  // Get selected entities
  const selectedPreset = allPresets.find(
    (p: Preset) => p.id === selectedPresetId
  );
  const selectedWork = worksExtended.find((w: any) => w.id === selectedWorkId);

  // Group presets by system/user
  const systemPresets = allPresets.filter((p: Preset) => p.isSystem);
  const userPresets = allPresets.filter((p: Preset) => !p.isSystem);

  // Filter presets for work target
  const systemPresetsFiltered = systemPresets.filter(
    (p: Preset) => p.targetEntity === "work"
  );
  const userPresetsFiltered = userPresets.filter(
    (p: Preset) => p.targetEntity === "work"
  );

  // Debug: Log preset filtering
  console.log("[LinkBlobDialog] All presets:", allPresets.length);
  console.log(
    "[LinkBlobDialog] System presets (work):",
    systemPresetsFiltered.length
  );
  console.log(
    "[LinkBlobDialog] User presets (work):",
    userPresetsFiltered.length
  );
  console.log(
    "[LinkBlobDialog] User presets details:",
    userPresets.map((p) => ({ name: p.name, target: p.targetEntity }))
  );

  // Extract initial values from blob pdfMetadata or prefillValues
  const initialValues =
    Object.keys(prefillValues).length > 0
      ? prefillValues
      : blob.pdfMetadata
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

  // Handle BibTeX import
  const handleBibtexImport = async (entry: BibtexEntry, presetName: string) => {
    // Find preset by name
    const preset = allPresets.find((p: Preset) => p.name === presetName);
    if (!preset) {
      console.error(`Preset not found: ${presetName}`);
      return;
    }

    // Convert BibTeX to form values
    const formValues = operations.bibtexToWorkFormValues(entry);

    // Parse and create authors if present
    const newAuthorIds: string[] = [];
    if (formValues.authors && typeof formValues.authors === "string") {
      const parsedAuthors = operations.parseAuthorList(formValues.authors);

      for (const parsed of parsedAuthors) {
        try {
          const author = await findOrCreateAuthor.mutateAsync({
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            middleName: parsed.middleName,
            orcid: parsed.orcid,
          });
          newAuthorIds.push(author.id);
        } catch (error) {
          console.error("Failed to create author:", error);
        }
      }

      // Remove authors from form values (we'll use authorIds)
      delete formValues.authors;
    }

    // Set preset, authors, and prefill values
    setSelectedPresetId(preset.id);
    setAuthorIds(newAuthorIds);
    setPrefillValues(formValues);
    setStep("form");
    setBibtexModalOpen(false);
  };

  // Handle form submission - Create Work + Asset
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

      // Create Work first
      const work = await createWork.mutateAsync({
        title: (coreFields.title as string) || "Untitled",
        subtitle: coreFields.subtitle as string | undefined,
        authorIds,
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
      });

      // Then create Asset linked to the work
      await createAsset.mutateAsync({
        workId: work.id,
        sha256: blob.sha256,
        filename: blob.filename || "unknown.pdf",
        bytes: typeof blob.size === "bigint" ? Number(blob.size) : blob.size,
        mime: blob.mime,
        role: "main",
        pageCount: blob.pageCount,
        favorite: false,
      });

      console.log("✅ Work + Asset created successfully!");
      onSuccess();
    } catch (error) {
      console.error("❌ Failed to create work:", error);
      alert(
        `Failed to create work: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  // Handle linking to existing work
  const handleLinkToExisting = async () => {
    if (!selectedWork || !selectedWorkId) return;

    try {
      // Create asset linked directly to the work
      await createAsset.mutateAsync({
        workId: selectedWorkId,
        sha256: blob.sha256,
        filename: blob.filename || "unknown.pdf",
        bytes: typeof blob.size === "bigint" ? Number(blob.size) : blob.size,
        mime: blob.mime,
        role: "main",
        pageCount: blob.pageCount,
        favorite: false,
      });

      console.log("✅ Asset linked to work successfully!");
      onSuccess();
    } catch (error) {
      console.error("❌ Failed to link asset:", error);
      alert(
        `Failed to link asset: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md">
      {/* BibTeX Import Modal */}
      <BibtexImportModal
        isOpen={bibtexModalOpen}
        onClose={() => setBibtexModalOpen(false)}
        operations={{
          ...bibtexOps,
          onImport: handleBibtexImport,
        }}
      />

      {/* Dialog - 90% of viewport */}
      <div className="bg-neutral-900/80 rounded-xl shadow-2xl w-[90vw] h-[90vh] flex flex-col border border-neutral-700/50">
        {/* Fixed Header */}
        <div className="shrink-0 px-6 py-4 border-b border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-neutral-100">
                Link File to Library
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Linking:{" "}
                <span className="text-neutral-300 font-medium">
                  {blob.filename || blob.sha256.slice(0, 16)}
                </span>
              </p>
            </div>
            <button
              onClick={onCancel}
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

          {/* Mode Tabs - Only show on select step */}
          {step === "select" && (
            <div className="flex gap-2 mt-4 border-b border-neutral-800">
              <button
                onClick={() => setMode("link-to-existing")}
                className={`flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg transition-all font-medium ${
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
                className={`flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg transition-all font-medium ${
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

        {/* Scrollable Content Area - Horizontal Split */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left: Form Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 border-r border-neutral-800">
            {/* Mode: Link to Existing Work */}
            {mode === "link-to-existing" && step === "select" && (
              <div className="space-y-4">
                <WorkSelector
                  value={selectedWorkId}
                  onChange={(workId: string | null) => {
                    setSelectedWorkId(workId);
                  }}
                  works={worksExtended}
                  operations={workSelectorOps}
                />

                {worksExtended && worksExtended.length === 0 && (
                  <div className="border-2 border-dashed border-neutral-700 rounded-xl p-8 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-neutral-800 text-neutral-400 mb-3">
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
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                    </div>
                    <p className="text-neutral-300 mb-2 text-lg font-semibold">
                      No works yet
                    </p>
                    <p className="text-sm text-neutral-500 mb-4">
                      Create your first work to link files to it
                    </p>
                    <button
                      onClick={() => setMode("create-new")}
                      className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                    >
                      Create New Work
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mode: Create New Work - Step 1: Select Preset */}
            {mode === "create-new" && step === "select" && (
              <div className="space-y-5">
                {allPresets.length > 0 ? (
                  <>
                    {/* System Templates */}
                    {systemPresetsFiltered.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-neutral-200 flex items-center gap-2">
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
                          <button
                            onClick={() => setBibtexModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            <FileCode className="w-4 h-4" />
                            Add from bib
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {systemPresetsFiltered.map((preset: Preset) => (
                            <button
                              key={preset.id}
                              onClick={() => handlePresetSelect(preset.id)}
                              className={`group relative bg-neutral-800/50 border rounded-xl p-4 text-left transition-all hover:bg-neutral-800 hover:border-neutral-600 hover:shadow-lg ${
                                selectedPresetId === preset.id
                                  ? "border-blue-500 bg-blue-950/20"
                                  : "border-neutral-700"
                              }`}
                            >
                              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-xl opacity-50 group-hover:opacity-100 transition-opacity" />

                              <div className="pl-3">
                                <h4 className="font-semibold text-neutral-100 mb-1 text-sm">
                                  {preset.name}
                                </h4>
                                {preset.description && (
                                  <p className="text-xs text-neutral-400 line-clamp-2 mb-2">
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
                        <h3 className="text-base font-semibold text-neutral-200 mb-3 flex items-center gap-2">
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {userPresetsFiltered.map((preset: Preset) => (
                            <button
                              key={preset.id}
                              onClick={() => handlePresetSelect(preset.id)}
                              className={`group relative bg-neutral-800/50 border rounded-xl p-4 text-left transition-all hover:bg-neutral-800 hover:border-neutral-600 hover:shadow-lg ${
                                selectedPresetId === preset.id
                                  ? "border-emerald-500 bg-emerald-950/20"
                                  : "border-neutral-700"
                              }`}
                            >
                              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 rounded-l-xl opacity-50 group-hover:opacity-100 transition-opacity" />

                              <div className="pl-3">
                                <h4 className="font-semibold text-neutral-100 mb-1 text-sm">
                                  {preset.name}
                                </h4>
                                {preset.description && (
                                  <p className="text-xs text-neutral-400 line-clamp-2 mb-2">
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
                      <h3 className="text-base font-semibold text-neutral-200 mb-3 flex items-center gap-2">
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
                        className="w-full border-2 border-dashed border-neutral-700 rounded-xl p-6 text-center hover:border-neutral-600 hover:bg-neutral-800/30 transition-all group"
                      >
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-neutral-800 text-neutral-400 group-hover:bg-neutral-700 group-hover:text-neutral-300 transition-colors mb-2">
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
                        </div>
                        <p className="text-neutral-300 font-medium text-sm mb-1">
                          Create Custom Template
                        </p>
                        <p className="text-xs text-neutral-500">
                          Design your own template with custom fields
                        </p>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="border-2 border-dashed border-neutral-700 rounded-xl p-8 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-neutral-800 text-neutral-400 mb-3">
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
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <p className="text-neutral-300 mb-2 text-lg font-semibold">
                      No templates available yet
                    </p>
                    <p className="text-sm text-neutral-500 mb-4">
                      Create your first template to get started
                    </p>
                    <button
                      onClick={() => setStep("create-preset")}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
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
                  onSuccess={(presetId: string) => {
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

                {/* Authors Field */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Authors
                  </label>
                  <AuthorInput
                    value={authorIds}
                    authors={selectedAuthors}
                    onChange={setAuthorIds}
                    authorOps={authorOps}
                    placeholder="Search or add authors (e.g., 'Smith, John and Doe, Jane')..."
                  />
                </div>

                {/* Form */}
                <DynamicForm
                  preset={selectedPreset}
                  initialValues={initialValues}
                  onSubmit={handleSubmit}
                  onCancel={onCancel}
                  submitLabel="Create Work"
                  isSubmitting={createWork.isPending || createAsset.isPending}
                />
              </div>
            )}
          </div>

          {/* Right: PDF Preview */}
          <div className="w-[45%] flex flex-col bg-neutral-950">
            {blob.mime === "application/pdf" ? (
              <PDFPreview
                source={getBlobUrl(blob.sha256)}
                sha256={blob.sha256}
                showToolbar={true}
                autoFitToHeight={true}
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
                  <p className="text-sm">No PDF preview available</p>
                  <p className="text-xs text-neutral-600 mt-1">
                    File type: {blob.mime}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fixed Footer - Show on select step */}
        {step === "select" && (
          <div className="shrink-0 px-6 py-3 border-t border-neutral-800 bg-neutral-900/50">
            <div className="flex justify-between items-center">
              <div className="text-xs text-neutral-500">
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
              <div className="flex gap-2">
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-sm bg-neutral-800 text-neutral-200 rounded-lg hover:bg-neutral-750 transition-colors font-medium"
                >
                  Cancel
                </button>
                {mode === "link-to-existing" && selectedWorkId && (
                  <button
                    onClick={handleLinkToExisting}
                    disabled={createAsset.isPending}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-blue-800 disabled:cursor-not-allowed"
                  >
                    {createAsset.isPending ? "Linking..." : "Continue"}
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

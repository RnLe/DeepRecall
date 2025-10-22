/**
 * PresetFormBuilder Component
 * Full-featured form builder for creating presets with core and custom fields
 */

"use client";

import { useState } from "react";
import { useCreatePreset } from "@/src/hooks/usePresets";
import type {
  PresetTarget,
  FieldType,
  CustomFieldDefinition,
} from "@deeprecall/core";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";

interface PresetFormBuilderProps {
  targetEntity: PresetTarget;
  onSuccess: (presetId: string) => void;
  onCancel: () => void;
}

// Define core fields for each entity type (similar to old SupportedFields)
const CORE_FIELDS = {
  work: {
    title: { label: "Title", type: "text", alwaysRequired: true },
    subtitle: { label: "Subtitle", type: "text" },
    authors: { label: "Authors", type: "text", helpText: "Comma-separated" },
    workType: { label: "Work Type", type: "select" },
    topics: { label: "Topics/Tags", type: "tags" },
    favorite: { label: "Favorite", type: "boolean" },
  },
  version: {
    versionNumber: { label: "Version Number", type: "number" },
    versionTitle: { label: "Version Title", type: "text" },
    year: { label: "Year", type: "number" },
    publishingDate: { label: "Publishing Date", type: "date" },
    publisher: { label: "Publisher", type: "text" },
    journal: { label: "Journal", type: "text" },
    volume: { label: "Volume", type: "text" },
    issue: { label: "Issue", type: "text" },
    pages: { label: "Pages", type: "text" },
    doi: { label: "DOI", type: "text" },
    arxivId: { label: "arXiv ID", type: "text" },
    isbn: { label: "ISBN", type: "text" },
    notes: { label: "Notes", type: "textarea" },
    read: { label: "Read Date", type: "date" },
    favorite: { label: "Favorite", type: "boolean" },
  },
  asset: {
    filename: { label: "Filename", type: "text", alwaysRequired: true },
    role: { label: "Role", type: "select" },
    pageCount: { label: "Page Count", type: "number" },
  },
} as const;

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Text Area" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Checkbox" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "multiselect", label: "Multi-select" },
];

export function PresetFormBuilder({
  targetEntity,
  onSuccess,
  onCancel,
}: PresetFormBuilderProps) {
  const createPreset = useCreatePreset();

  // Basic info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Core fields configuration
  const [enabledCoreFields, setEnabledCoreFields] = useState<
    Record<string, boolean>
  >({});
  const [requiredCoreFields, setRequiredCoreFields] = useState<
    Record<string, boolean>
  >({});
  const [showCoreFields, setShowCoreFields] = useState(true);

  // Custom fields
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  // Store raw option text to preserve newlines while typing
  const [optionTexts, setOptionTexts] = useState<Record<number, string>>({});
  const [showCustomFields, setShowCustomFields] = useState(false);

  const coreFieldsForEntity = CORE_FIELDS[targetEntity];

  const toggleCoreField = (fieldName: string) => {
    setEnabledCoreFields((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }));
  };

  const toggleRequired = (fieldName: string) => {
    setRequiredCoreFields((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }));
  };

  const addCustomField = () => {
    const newField: CustomFieldDefinition = {
      key: `custom_${Date.now()}`,
      label: "New Field",
      type: "text",
      required: false,
      options: [],
    };
    setCustomFields([...customFields, newField]);
    setShowCustomFields(true);
  };

  const updateCustomField = (
    index: number,
    updates: Partial<CustomFieldDefinition>
  ) => {
    const updated = [...customFields];
    updated[index] = { ...updated[index], ...updates };
    setCustomFields(updated);
  };

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
    // Clean up stored option text
    setOptionTexts((prev) => {
      const newTexts = { ...prev };
      delete newTexts[index];
      return newTexts;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("Please enter a template name");
      return;
    }

    // Build coreFieldConfig
    const coreFieldConfig: Record<
      string,
      { required?: boolean; hidden?: boolean }
    > = {};
    Object.entries(coreFieldsForEntity).forEach(([fieldName, fieldDef]) => {
      const isEnabled = enabledCoreFields[fieldName];
      const isRequired = requiredCoreFields[fieldName];

      if (fieldDef.alwaysRequired) {
        // Always show required fields like title
        coreFieldConfig[fieldName] = { required: true };
      } else if (isEnabled) {
        coreFieldConfig[fieldName] = { required: isRequired };
      } else {
        coreFieldConfig[fieldName] = { hidden: true };
      }
    });

    try {
      const preset = await createPreset.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        targetEntity,
        coreFieldConfig,
        customFields: customFields.map((field) => ({
          ...field,
          key: field.key.replace(/\s+/g, "_").toLowerCase(),
        })),
        formLayout: "single-column",
        isSystem: false,
      });

      onSuccess(preset.id);
    } catch (error) {
      console.error("Failed to create preset:", error);
      alert("Failed to create template. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info - Compact Card */}
      <div className="bg-neutral-800/30 border border-neutral-700 rounded-xl p-5">
        <h3 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
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
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Template Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Template Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Academic Paper, Textbook, Thesis"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe when to use this template..."
            />
          </div>
        </div>
      </div>

      {/* Core Fields Section - Compact Card */}
      <div className="bg-neutral-800/30 border border-neutral-700 rounded-xl p-5">
        <button
          type="button"
          onClick={() => setShowCoreFields(!showCoreFields)}
          className="flex items-center justify-between w-full group mb-4"
        >
          <h3 className="text-lg font-semibold text-neutral-100 flex items-center gap-2">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Core Fields
            <span className="text-sm text-neutral-400 font-normal">
              (Standard fields for {targetEntity})
            </span>
          </h3>
          {showCoreFields ? (
            <ChevronDown className="w-5 h-5 text-neutral-400 group-hover:text-neutral-300" />
          ) : (
            <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-neutral-300" />
          )}
        </button>

        {showCoreFields && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
            {Object.entries(coreFieldsForEntity).map(
              ([fieldName, fieldDef]) => {
                const isEnabled = enabledCoreFields[fieldName] ?? false;
                const isRequired = requiredCoreFields[fieldName] ?? false;
                const isAlwaysRequired = fieldDef.alwaysRequired ?? false;

                return (
                  <div
                    key={fieldName}
                    className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-neutral-800/50 transition-colors"
                  >
                    <label className="flex items-center gap-2 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAlwaysRequired || isEnabled}
                        onChange={() =>
                          !isAlwaysRequired && toggleCoreField(fieldName)
                        }
                        disabled={isAlwaysRequired}
                        className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-emerald-500 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-sm text-neutral-300">
                        {fieldDef.label}
                        {isAlwaysRequired && (
                          <span className="text-red-400 ml-1">*</span>
                        )}
                      </span>
                    </label>
                    {(isEnabled || isAlwaysRequired) && !isAlwaysRequired && (
                      <label className="flex items-center gap-1.5 text-xs text-neutral-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isRequired}
                          onChange={() => toggleRequired(fieldName)}
                          className="w-3 h-3 rounded border-neutral-600 bg-neutral-800 text-blue-500 cursor-pointer"
                        />
                        Required
                      </label>
                    )}
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* Custom Fields Section - Compact Card */}
      <div className="bg-neutral-800/30 border border-neutral-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setShowCustomFields(!showCustomFields)}
            className="flex items-center gap-2 group"
          >
            <h3 className="text-lg font-semibold text-neutral-100 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
              Custom Fields
              <span className="text-sm text-neutral-400 font-normal">
                ({customFields.length})
              </span>
            </h3>
            {showCustomFields ? (
              <ChevronDown className="w-5 h-5 text-neutral-400 group-hover:text-neutral-300" />
            ) : (
              <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-neutral-300" />
            )}
          </button>
          <button
            type="button"
            onClick={addCustomField}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Field
          </button>
        </div>

        {showCustomFields && customFields.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {customFields.map((field, index) => {
              const needsOptions =
                field.type === "select" || field.type === "multiselect";
              return (
                <div
                  key={index}
                  className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-4 space-y-3"
                >
                  {/* Header with field name and type */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) =>
                          updateCustomField(index, { label: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Field label"
                      />
                      <select
                        value={field.type}
                        onChange={(e) => {
                          const newType = e.target.value as FieldType;
                          const needsOpts =
                            newType === "select" || newType === "multiselect";
                          updateCustomField(index, {
                            type: newType,
                            options: needsOpts
                              ? field.options || []
                              : undefined,
                          });
                        }}
                        className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {FIELD_TYPES.map((ft) => (
                          <option key={ft.value} value={ft.value}>
                            {ft.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCustomField(index)}
                      className="p-2 text-neutral-400 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors"
                      title="Remove field"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Options for select/multiselect */}
                  {needsOptions && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-neutral-400 flex items-center gap-1">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                          />
                        </svg>
                        Options (one per line):
                      </label>
                      <textarea
                        value={
                          optionTexts[index] ??
                          (field.options || [])
                            .map((opt) => opt.label)
                            .join("\n")
                        }
                        onChange={(e) => {
                          const text = e.target.value;
                          setOptionTexts((prev) => ({
                            ...prev,
                            [index]: text,
                          }));

                          const lines = text.split("\n");
                          const options = lines
                            .filter((line) => line.trim().length > 0)
                            .map((line) => ({
                              value: line
                                .trim()
                                .toLowerCase()
                                .replace(/\s+/g, "_"),
                              label: line.trim(),
                            }));
                          updateCustomField(index, { options });
                        }}
                        onBlur={() => {
                          setOptionTexts((prev) => {
                            const newTexts = { ...prev };
                            delete newTexts[index];
                            return newTexts;
                          });
                        }}
                        className="w-full px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 resize-none font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Option 1&#10;Option 2&#10;Option 3"
                        rows={3}
                      />
                      <p className="text-xs text-neutral-500 flex items-center gap-1">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {(field.options || []).length} option(s) defined
                      </p>
                    </div>
                  )}

                  {/* Required checkbox */}
                  <label className="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer hover:text-neutral-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) =>
                        updateCustomField(index, { required: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-purple-500 focus:ring-2 focus:ring-purple-500 cursor-pointer"
                    />
                    Required field
                  </label>
                </div>
              );
            })}
          </div>
        )}

        {showCustomFields && customFields.length === 0 && (
          <div className="text-center py-8 text-neutral-500">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-neutral-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-sm mb-2">No custom fields yet</p>
            <p className="text-xs text-neutral-600">
              Click "Add Field" to create your first custom field
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-4 border-t border-neutral-800">
        <p className="text-sm text-neutral-500">
          {Object.values(enabledCoreFields).filter(Boolean).length} core fields
          enabled · {customFields.length} custom fields
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 bg-neutral-800 text-neutral-200 rounded-lg hover:bg-neutral-750 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createPreset.isPending}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
          >
            {createPreset.isPending ? (
              <>
                <svg
                  className="animate-spin w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creating...
              </>
            ) : (
              <>
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Create Template
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * TemplateEditorModal Component (Platform-Agnostic)
 *
 * Full editor for modifying preset/template configuration
 * Allows editing: name, description, icon, color, core fields, and custom fields
 *
 * Uses Electric hooks directly - fully hoisted!
 */

import { useState, useEffect, useMemo } from "react";
import { useWorks, useAssets, useUpdatePreset } from "@deeprecall/data";
import {
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Lock,
} from "lucide-react";

type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "date"
  | "select"
  | "multiselect"
  | "url"
  | "email";

type PresetTarget = "work" | "version" | "asset";

interface CoreFieldConfig {
  required?: boolean;
  helpText?: string;
}

interface CustomFieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  helpText?: string;
  order: number;
  options?: string[];
}

interface Preset {
  id: string;
  name: string;
  description?: string;
  color?: string;
  targetEntity: PresetTarget;
  coreFieldConfig?: Record<string, Partial<CoreFieldConfig>>;
  customFields?: CustomFieldDefinition[];
  [key: string]: any;
}

export interface TemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  preset: Preset;
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Text Area" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Checkbox" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "multiselect", label: "Multi-select" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
];

// Core fields available for each entity type
const AVAILABLE_CORE_FIELDS: Record<PresetTarget, Record<string, string>> = {
  work: {
    title: "Title",
    subtitle: "Subtitle",
    authors: "Authors",
    workType: "Work Type",
    topics: "Topics/Tags",
    favorite: "Favorite",
  },
  version: {
    versionNumber: "Version Number",
    versionTitle: "Version Title",
    year: "Year",
    publishingDate: "Publishing Date",
    publisher: "Publisher",
    journal: "Journal",
    volume: "Volume",
    issue: "Issue",
    pages: "Pages",
    doi: "DOI",
    arxivId: "arXiv ID",
    isbn: "ISBN",
    notes: "Notes",
    read: "Read Date",
    favorite: "Favorite",
  },
  asset: {
    filename: "Filename",
    role: "Role",
    pageCount: "Page Count",
  },
};

export function TemplateEditorModal({
  isOpen,
  onClose,
  preset,
}: TemplateEditorModalProps) {
  const allWorksQuery = useWorks();
  const allAssetsQuery = useAssets();
  const updatePresetMutation = useUpdatePreset();

  // Compute usage count client-side
  const usageCount = useMemo(() => {
    const works = (allWorksQuery.data || []).filter(
      (work) => work.presetId === preset.id
    ).length;
    const assets = (allAssetsQuery.data || []).filter(
      (asset) => asset.presetId === preset.id
    ).length;

    return {
      works,
      assets,
      total: works + assets,
    };
  }, [allWorksQuery.data, allAssetsQuery.data, preset.id]);
  const [name, setName] = useState(preset.name);
  const [description, setDescription] = useState(preset.description || "");
  const [color, setColor] = useState(preset.color || "#6b7280");

  // Core fields config
  const [coreFieldConfig, setCoreFieldConfig] = useState<
    Record<string, Partial<CoreFieldConfig>>
  >(preset.coreFieldConfig || {});

  // Custom fields
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>(
    preset.customFields || []
  );

  // UI state
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    coreFields: true,
    customFields: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Get usage count for this preset
  // usageCount is now computed above with useMemo
  const hasLinkedEntities = (usageCount?.total || 0) > 0;

  // Reset form when preset changes
  useEffect(() => {
    if (isOpen) {
      setName(preset.name);
      setDescription(preset.description || "");
      setColor(preset.color || "#6b7280");
      setCoreFieldConfig(preset.coreFieldConfig || {});
      setCustomFields(preset.customFields || []);
    }
  }, [isOpen, preset]);

  if (!isOpen) return null;

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCoreFieldToggle = (fieldKey: string) => {
    setCoreFieldConfig((prev) => {
      const newConfig = { ...prev };
      if (newConfig[fieldKey]) {
        delete newConfig[fieldKey];
      } else {
        newConfig[fieldKey] = {};
      }
      return newConfig;
    });
  };

  const handleCoreFieldUpdate = (
    fieldKey: string,
    updates: Partial<CoreFieldConfig>
  ) => {
    setCoreFieldConfig((prev) => ({
      ...prev,
      [fieldKey]: { ...(prev[fieldKey] || {}), ...updates },
    }));
  };

  const addCustomField = () => {
    const newField: CustomFieldDefinition = {
      key: `custom_${Date.now()}`,
      label: "New Field",
      type: "text",
      required: false,
      order: customFields.length,
    };
    setCustomFields([...customFields, newField]);
  };

  const updateCustomField = (
    index: number,
    updates: Partial<CustomFieldDefinition>
  ) => {
    setCustomFields((prev) =>
      prev.map((field, i) => (i === index ? { ...field, ...updates } : field))
    );
  };

  const removeCustomField = (index: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  };

  const moveCustomField = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === customFields.length - 1)
    ) {
      return;
    }

    const newFields = [...customFields];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newFields[index], newFields[targetIndex]] = [
      newFields[targetIndex],
      newFields[index],
    ];

    // Update order property
    newFields.forEach((field, i) => {
      field.order = i;
    });

    setCustomFields(newFields);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePresetMutation.mutateAsync({
        id: preset.id,
        updates: {
          name: name.trim(),
          description: description.trim(),
          color,
          coreFieldConfig,
          customFields: customFields as any,
        },
      });
      onClose();
    } catch (error) {
      console.error("Failed to save template:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const availableCoreFields = AVAILABLE_CORE_FIELDS[preset.targetEntity] || {};

  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-neutral-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-800">
          <div>
            <h2 className="text-2xl font-bold text-neutral-100">
              Edit Template
            </h2>
            <p className="text-sm text-neutral-400 mt-1">
              Modify template configuration and fields
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-neutral-400" />
          </button>
        </div>

        {/* Usage Count & Warning */}
        <div className="mx-6 mt-4 space-y-3">
          {/* Usage count info */}
          <div className="p-3 bg-neutral-850 border border-neutral-800 rounded-lg">
            <div className="text-sm">
              <p className="font-medium text-neutral-300 mb-1">
                Template Usage
              </p>
              <div className="text-neutral-400 space-y-1">
                <p>
                  Currently used by{" "}
                  <span className="font-semibold text-neutral-200">
                    {usageCount?.total || 0}
                  </span>{" "}
                  {usageCount?.total === 1 ? "entity" : "entities"}
                </p>
                {usageCount && usageCount.total > 0 && (
                  <p className="text-xs">
                    ({usageCount.works}{" "}
                    {usageCount.works === 1 ? "work" : "works"}
                    {usageCount.assets > 0 &&
                      `, ${usageCount.assets} ${
                        usageCount.assets === 1 ? "asset" : "assets"
                      }`}
                    )
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Warning or Lock message */}
          {hasLinkedEntities ? (
            <div className="p-3 bg-rose-900/20 border border-rose-700/40 rounded-lg flex items-start gap-3">
              <Lock className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-sm text-rose-200">
                <p className="font-medium">Editing Locked</p>
                <p className="text-rose-300/80 mt-1">
                  This template cannot be edited because it's currently used by{" "}
                  {usageCount?.total}{" "}
                  {usageCount?.total === 1 ? "entity" : "entities"}. You can
                  only rename the template or delete it (which will also remove
                  all links).
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-900/20 border border-amber-700/40 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-200">
                <p className="font-medium">Editing Warning</p>
                <p className="text-amber-300/80 mt-1">
                  Changes to fields may affect future works/versions/assets
                  created with this template.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info Section */}
          <div
            className={`border border-neutral-800 rounded-lg overflow-hidden ${
              hasLinkedEntities ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <button
              onClick={() => toggleSection("basic")}
              className="w-full flex items-center justify-between p-4 bg-neutral-850 hover:bg-neutral-800 transition-colors"
            >
              <h3 className="text-lg font-semibold text-neutral-100">
                Basic Information
              </h3>
              {expandedSections.basic ? (
                <ChevronUp className="w-5 h-5 text-neutral-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-neutral-400" />
              )}
            </button>

            {expandedSections.basic && (
              <div className="p-4 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-neutral-100"
                    placeholder="My Template"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-neutral-100 resize-none"
                    placeholder="Brief description of this template..."
                  />
                </div>

                {/* Color */}
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-12 h-10 rounded border border-neutral-700 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-neutral-100 font-mono text-sm"
                      placeholder="#6b7280"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Core Fields Section */}
          <div
            className={`border border-neutral-800 rounded-lg overflow-hidden ${
              hasLinkedEntities ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <button
              onClick={() => toggleSection("coreFields")}
              className="w-full flex items-center justify-between p-4 bg-neutral-850 hover:bg-neutral-800 transition-colors"
            >
              <h3 className="text-lg font-semibold text-neutral-100">
                Core Fields
              </h3>
              {expandedSections.coreFields ? (
                <ChevronUp className="w-5 h-5 text-neutral-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-neutral-400" />
              )}
            </button>

            {expandedSections.coreFields && (
              <div className="p-4 space-y-2">
                {Object.entries(availableCoreFields).map(
                  ([fieldKey, fieldLabel]) => {
                    const isEnabled = !!coreFieldConfig[fieldKey];
                    const config = coreFieldConfig[fieldKey] || {};

                    return (
                      <div
                        key={fieldKey}
                        className="border border-neutral-700 rounded-lg overflow-hidden"
                      >
                        <div className="flex items-center gap-3 p-3 bg-neutral-850">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleCoreFieldToggle(fieldKey)}
                            className="w-4 h-4 rounded border-neutral-600 bg-neutral-700 text-blue-600"
                          />
                          <span className="flex-1 text-sm font-medium text-neutral-200">
                            {fieldLabel}
                          </span>
                        </div>

                        {isEnabled && (
                          <div className="p-3 bg-neutral-900 border-t border-neutral-700 space-y-2">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={config.required || false}
                                onChange={(e) =>
                                  handleCoreFieldUpdate(fieldKey, {
                                    required: e.target.checked,
                                  })
                                }
                                className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-700 text-blue-600"
                              />
                              <span className="text-neutral-300">Required</span>
                            </label>

                            <input
                              type="text"
                              value={config.helpText || ""}
                              onChange={(e) =>
                                handleCoreFieldUpdate(fieldKey, {
                                  helpText: e.target.value,
                                })
                              }
                              placeholder="Help text..."
                              className="w-full px-2 py-1.5 text-sm bg-neutral-800 border border-neutral-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-neutral-100"
                            />
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>

          {/* Custom Fields Section */}
          <div
            className={`border border-neutral-800 rounded-lg overflow-hidden ${
              hasLinkedEntities ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <button
              onClick={() => toggleSection("customFields")}
              className="w-full flex items-center justify-between p-4 bg-neutral-850 hover:bg-neutral-800 transition-colors"
            >
              <h3 className="text-lg font-semibold text-neutral-100">
                Custom Fields ({customFields.length})
              </h3>
              {expandedSections.customFields ? (
                <ChevronUp className="w-5 h-5 text-neutral-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-neutral-400" />
              )}
            </button>

            {expandedSections.customFields && (
              <div className="p-4 space-y-3">
                {customFields.map((field, index) => (
                  <div
                    key={field.key}
                    className="border border-neutral-700 rounded-lg p-3 bg-neutral-850 space-y-3"
                  >
                    {/* Field header with move/delete */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) =>
                          updateCustomField(index, { label: e.target.value })
                        }
                        placeholder="Field Label"
                        className="flex-1 px-2 py-1.5 text-sm bg-neutral-800 border border-neutral-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-neutral-100 font-medium"
                      />

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveCustomField(index, "up")}
                          disabled={index === 0}
                          className="p-1 hover:bg-neutral-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <ChevronUp className="w-4 h-4 text-neutral-400" />
                        </button>
                        <button
                          onClick={() => moveCustomField(index, "down")}
                          disabled={index === customFields.length - 1}
                          className="p-1 hover:bg-neutral-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <ChevronDown className="w-4 h-4 text-neutral-400" />
                        </button>
                        <button
                          onClick={() => removeCustomField(index)}
                          className="p-1 hover:bg-red-900/30 rounded transition-colors"
                          title="Remove field"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>

                    {/* Field configuration */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">
                          Field Key
                        </label>
                        <input
                          type="text"
                          value={field.key}
                          onChange={(e) =>
                            updateCustomField(index, { key: e.target.value })
                          }
                          className="w-full px-2 py-1 text-xs bg-neutral-800 border border-neutral-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-neutral-100 font-mono"
                          placeholder="field_key"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">
                          Type
                        </label>
                        <select
                          value={field.type}
                          onChange={(e) =>
                            updateCustomField(index, {
                              type: e.target.value as FieldType,
                            })
                          }
                          className="w-full px-2 py-1 text-xs bg-neutral-800 border border-neutral-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-neutral-100"
                        >
                          {FIELD_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={field.required || false}
                          onChange={(e) =>
                            updateCustomField(index, {
                              required: e.target.checked,
                            })
                          }
                          className="w-3 h-3 rounded border-neutral-600 bg-neutral-700 text-blue-600"
                        />
                        <span className="text-neutral-300">Required</span>
                      </label>
                    </div>

                    <input
                      type="text"
                      value={field.helpText || ""}
                      onChange={(e) =>
                        updateCustomField(index, { helpText: e.target.value })
                      }
                      placeholder="Help text..."
                      className="w-full px-2 py-1 text-xs bg-neutral-800 border border-neutral-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-neutral-100"
                    />
                  </div>
                ))}

                <button
                  onClick={addCustomField}
                  className="w-full py-2 border-2 border-dashed border-neutral-700 rounded-lg hover:border-neutral-600 hover:bg-neutral-850 transition-colors flex items-center justify-center gap-2 text-neutral-400 hover:text-neutral-300"
                >
                  <Plus className="w-4 h-4" />
                  Add Custom Field
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-800 bg-neutral-900/50">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-neutral-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || isSaving || hasLinkedEntities}
            className="px-4 py-2 text-sm font-medium bg-slate-700/50 text-slate-300 border border-slate-600/50 rounded-lg hover:bg-slate-700/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {hasLinkedEntities
              ? "Locked"
              : isSaving
                ? "Saving..."
                : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

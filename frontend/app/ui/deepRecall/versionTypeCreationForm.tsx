// versionTypeCreationForm.tsx

import React, { useState } from "react";
import { useLiteratureTypes } from "../../customHooks/useLiterature";
import { Plus, X } from 'lucide-react';

type CustomFieldType = "string" | "number" | "dropdown";

interface CustomField {
  id: string;
  fieldName: string;
  fieldType: CustomFieldType;
  dropdownOptions?: string[];
}

interface VersionTypeCreationFormProps {
  className?: string;
  onSubmit: (payload: { name: string; versionMetadata: string }) => void;
  onCancel?: () => void;
  initialData?: {
    name: string;
    versionMetadata: string;
  };
  isEditing?: boolean;
}

// Define the preset core (native) fields with their defaults.
const coreFieldDefinitions: Record<string, { default: any }> = {
  publishingDate: { default: "" },
  versionTitle: { default: "" },
  editionNumber: { default: 0 },
  versionNumber: { default: 0 },
  literatureTypes: { default: [] },
};

const VersionTypeCreationForm: React.FC<VersionTypeCreationFormProps> = ({
  className,
  onSubmit,
  onCancel,
  initialData,
  isEditing = false,
}) => {
  // Parse initial data if editing
  const initialFields = React.useMemo(() => {
    if (!initialData?.versionMetadata) return {};
    try {
      return JSON.parse(initialData.versionMetadata);
    } catch {
      return {};
    }
  }, [initialData?.versionMetadata]);

  // State for the version type name.
  const [typeName, setTypeName] = useState(initialData?.name || "");

  // State for core (native) fields: whether to include each one.
  const [coreFieldsEnabled, setCoreFieldsEnabled] = useState<Record<string, boolean>>({
    publishingDate: initialFields?.publishingDate !== undefined || false,
    versionTitle: initialFields?.versionTitle !== undefined || false,
    editionNumber: initialFields?.editionNumber !== undefined || false,
    versionNumber: initialFields?.versionNumber !== undefined || true, // Default enabled
    literatureTypes: initialFields?.literatureTypes !== undefined || false,
  });

  // State for number field type selection (mutually exclusive)
  const [numberFieldType, setNumberFieldType] = useState<'versionNumber' | 'editionNumber'>(
    initialFields?.editionNumber !== undefined ? 'editionNumber' : 'versionNumber'
  );

  // State for selected literature types (multiple selection)
  const [selectedLiteratureTypes, setSelectedLiteratureTypes] = useState<string[]>(
    initialFields?.literatureTypes?.default_value || []
  );

  // State for custom fields.
  const [customFields, setCustomFields] = useState<CustomField[]>(() => {
    if (!initialFields) return [];
    
    // Extract custom fields from initial data
    return Object.entries(initialFields)
      .filter(([key]) => !['publishingDate', 'versionTitle', 'editionNumber', 'versionNumber', 'literatureTypes'].includes(key))
      .map(([key, value]: [string, any]) => ({
        id: Math.random().toString(36).substr(2, 9),
        fieldName: key,
        fieldType: value.type as CustomFieldType,
        dropdownOptions: value.options || undefined,
      }));
  });

  // Get available literature types
  const { data: literatureTypes } = useLiteratureTypes();

  // Update a core field's enabled state.
  const toggleCoreField = (key: string) => {
    setCoreFieldsEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Handle number field type selection (mutually exclusive)
  const handleNumberFieldTypeChange = (type: 'versionNumber' | 'editionNumber') => {
    setNumberFieldType(type);
    setCoreFieldsEnabled(prev => ({
      ...prev,
      versionNumber: type === 'versionNumber',
      editionNumber: type === 'editionNumber'
    }));
  };

  // Handle literature type selection
  const toggleLiteratureType = (literatureTypeName: string) => {
    setSelectedLiteratureTypes(prev => {
      if (prev.includes(literatureTypeName)) {
        return prev.filter(lt => lt !== literatureTypeName);
      } else {
        return [...prev, literatureTypeName];
      }
    });
  };

  // Custom field functions.
  const addCustomField = () => {
    const newField: CustomField = {
      id: Date.now().toString(),
      fieldName: "",
      fieldType: "string",
      dropdownOptions: [],
    };
    setCustomFields((prev) => [...prev, newField]);
  };

  const updateCustomField = (id: string, field: Partial<CustomField>) => {
    setCustomFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...field } : f))
    );
  };

  const removeCustomField = (id: string) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  };

  // For dropdown options: add an option (max 10).
  const addDropdownOption = (id: string) => {
    setCustomFields((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          const currentOptions = f.dropdownOptions || ["", ""];
          if (currentOptions.length < 10) {
            return { ...f, dropdownOptions: [...currentOptions, ""] };
          }
        }
        return f;
      })
    );
  };

  const updateDropdownOption = (fieldId: string, index: number, newValue: string) => {
    setCustomFields((prev) =>
      prev.map((f) => {
        if (f.id === fieldId && f.dropdownOptions) {
          const updatedOptions = [...f.dropdownOptions];
          updatedOptions[index] = newValue;
          return { ...f, dropdownOptions: updatedOptions };
        }
        return f;
      })
    );
  };

  const removeDropdownOption = (fieldId: string, index: number) => {
    setCustomFields((prev) =>
      prev.map((f) => {
        if (f.id === fieldId && f.dropdownOptions) {
          const updatedOptions = f.dropdownOptions.filter((_, i) => i !== index);
          return { ...f, dropdownOptions: updatedOptions };
        }
        return f;
      })
    );
  };

  // Build and submit the final payload.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!typeName.trim()) {
      alert("Type name is required");
      return;
    }

    // Build the payload template.
    const payloadTemplate: Record<string, any> = {};

    // For each core field:
    Object.keys(coreFieldDefinitions).forEach((key) => {
      if (key === "literatureTypes") {
        if (coreFieldsEnabled[key] && selectedLiteratureTypes.length > 0) {
          payloadTemplate[key] = selectedLiteratureTypes;
        }
      } else if (coreFieldsEnabled[key]) {
        payloadTemplate[key] = coreFieldDefinitions[key].default;
      }
    });

    // Build template for custom fields.
    const customTemplate: Record<string, any> = {};
    customFields.forEach((field) => {
      if (field.fieldName.trim()) {
        if (field.fieldType === "string") {
          customTemplate[field.fieldName] = "";
        } else if (field.fieldType === "number") {
          customTemplate[field.fieldName] = 0;
        } else if (field.fieldType === "dropdown") {
          if (
            field.dropdownOptions &&
            field.dropdownOptions.filter((opt) => opt.trim() !== "").length >= 2
          ) {
            customTemplate[field.fieldName] = field.dropdownOptions.filter(
              (opt) => opt.trim() !== ""
            );
          } else {
            console.warn(
              `Dropdown field "${field.fieldName}" does not have enough options; skipping.`
            );
          }
        }
      }
    });

    // Merge core and custom templates.
    const versionMetadata = { ...payloadTemplate, ...customTemplate };

    const finalPayload = {
      name: typeName.trim(),
      versionMetadata: JSON.stringify(versionMetadata),
    };

    onSubmit(finalPayload);

    // Reset form
    setTypeName("");
    setCoreFieldsEnabled({
      publishingDate: false,
      versionTitle: false,
      editionNumber: false,
      versionNumber: true,
      literatureTypes: false,
    });
    setNumberFieldType('versionNumber');
    setSelectedLiteratureTypes([]);
    setCustomFields([]);
  };

  return (
    <div className={`bg-slate-900 rounded-xl p-8 w-full max-w-7xl mx-auto ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-100">
            {isEditing ? 'Edit Version Type' : 'Create Version Type'}
          </h2>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Version Type Name - Full Width */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Version Type Name *
          </label>
          <input
            type="text"
            value={typeName}
            onChange={(e) => setTypeName(e.target.value)}
            placeholder="e.g., Draft, Final, Revised Edition"
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all duration-200"
            required
          />
        </div>

        {/* Literature Types Linking - Full Width */}
        <div>
          <h3 className="text-lg font-medium text-slate-200 mb-4">Literature Type Linking</h3>
          <div className="space-y-3">
            {literatureTypes && literatureTypes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {literatureTypes.map((literatureType) => (
                  <button
                    key={literatureType.documentId}
                    type="button"
                    onClick={() => toggleLiteratureType(literatureType.name)}
                    className={`text-left p-3 border rounded-lg transition-all duration-200 ${
                      selectedLiteratureTypes.includes(literatureType.name)
                        ? "bg-emerald-600/20 border-emerald-500 text-emerald-200"
                        : "bg-slate-800/30 border-slate-700/30 text-slate-300 hover:bg-slate-800/50 hover:border-slate-600/50"
                    }`}
                  >
                    <span className="capitalize">{literatureType.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <p className="text-yellow-300 text-sm">
                  No literature types available yet. Create literature types first to enable linking.
                </p>
              </div>
            )}
            {selectedLiteratureTypes.length > 0 && (
              <div className="mt-3 p-3 bg-emerald-900/20 border border-emerald-600/30 rounded-lg">
                <p className="text-emerald-300 text-sm">
                  Selected: {selectedLiteratureTypes.join(", ")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Main Content Grid: Core Fields | Custom Fields */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Core Fields Column */}
          <div>
            <h3 className="text-lg font-medium text-slate-200 mb-4">Core Fields</h3>
            
            {/* Version/Edition Number Selection - Special Case */}
            <div className="mb-4 p-3 bg-slate-800/30 border border-slate-700/30 rounded-lg">
              <div className="space-y-3">
                <span className="text-sm font-medium text-slate-300">Number Field Type</span>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => handleNumberFieldTypeChange('versionNumber')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-all duration-200 ${
                      numberFieldType === 'versionNumber'
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    Version Number
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNumberFieldTypeChange('editionNumber')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-all duration-200 ${
                      numberFieldType === 'editionNumber'
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    Edition Number
                  </button>
                </div>
              </div>
            </div>

            {/* Other Core Fields in 2-column grid within the core column */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(coreFieldDefinitions)
                .filter(([key]) => key !== "literatureTypes" && key !== "editionNumber" && key !== "versionNumber") // Number fields handled above
                .map(([key, fieldDef]) => {
                  const displayName = key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (str) => str.toUpperCase());

                  return (
                    <div key={key} className="p-3 bg-slate-800/30 border border-slate-700/30 rounded-lg">
                      <div className="flex flex-col space-y-2">
                        <span className="text-sm font-medium text-slate-300">{displayName}</span>
                        <button
                          type="button"
                          onClick={() => toggleCoreField(key)}
                          className={`px-3 py-1 rounded text-sm font-medium transition-all duration-200 ${
                            coreFieldsEnabled[key]
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                          }`}
                        >
                          {coreFieldsEnabled[key] ? "Enabled" : "Disabled"}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Custom Fields Column */}
          <div>
            <h3 className="text-lg font-medium text-slate-200 mb-4">Custom Fields</h3>
            <div className="space-y-3">
              {customFields.map((field) => (
                <div key={field.id} className="p-3 bg-slate-800/30 border border-slate-700/30 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={field.fieldName}
                      onChange={(e) => updateCustomField(field.id, { fieldName: e.target.value })}
                      placeholder="Field name"
                      className="flex-1 px-3 py-1 bg-slate-800/50 border border-slate-700/50 rounded text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomField(field.id)}
                      className="ml-2 p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <select
                    value={field.fieldType}
                    onChange={(e) => updateCustomField(field.id, { fieldType: e.target.value as CustomFieldType })}
                    className="w-full px-3 py-1 bg-slate-800/50 border border-slate-700/50 rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-sm"
                  >
                    <option value="string">Text</option>
                    <option value="number">Number</option>
                    <option value="dropdown">Dropdown</option>
                  </select>

                  {field.fieldType === "dropdown" && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">Dropdown Options:</p>
                      {(field.dropdownOptions || ["", ""]).map((option, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => updateDropdownOption(field.id, index, e.target.value)}
                            placeholder={`Option ${index + 1}`}
                            className="flex-1 px-2 py-1 bg-slate-800/50 border border-slate-700/50 rounded text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-xs"
                          />
                          {field.dropdownOptions && field.dropdownOptions.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeDropdownOption(field.id, index)}
                              className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addDropdownOption(field.id)}
                        disabled={field.dropdownOptions && field.dropdownOptions.length >= 10}
                        className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 text-xs disabled:text-slate-500 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Option</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addCustomField}
                className="w-full p-3 border border-dashed border-slate-600 text-slate-400 hover:text-slate-300 hover:border-slate-500 rounded-lg transition-all duration-200"
              >
                <div className="flex items-center justify-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>Add Custom Field</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-700/30">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-all duration-200"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all duration-200 font-medium"
            disabled={!typeName.trim()}
          >
            {isEditing ? 'Save Changes' : 'Create Version Type'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VersionTypeCreationForm;

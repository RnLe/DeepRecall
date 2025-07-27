// literatureTypeCreationForm.tsx

import React, { useState } from "react";
import { useVersionTypes } from "../../customHooks/useLiterature";
import VersionTypeCreationForm from "./versionTypeCreationForm";
import { 
  BookOpen, 
  FileText, 
  Microscope, 
  GraduationCap, 
  Presentation, 
  FileSearch, 
  Bookmark, 
  Plus,
  X
} from 'lucide-react';

type CustomFieldType = "string" | "number" | "dropdown";

interface CustomField {
  id: string;
  fieldName: string;
  fieldType: CustomFieldType;
  dropdownOptions?: string[];
}

interface LiteratureTypeCreationFormProps {
  className?: string;
  onSubmit: (payload: { name: string; typeMetadata: string }) => void;
  onCancel?: () => void;
  initialData?: {
    name: string;
    typeMetadata: string;
  };
  isEditing?: boolean;
}

// Define the preset core (native) fields with their defaults.
const coreFieldDefinitions: Record<string, { default: any }> = {
  subtitle: { default: "" },
  publisher: { default: "" },
  authors: { default: [] },
  journal: { default: "" },
  doi: { default: "" },
  versionsAreEqual: { default: false },
  icon: { default: "book-open" },
  linkedVersionType: { default: "" },
};

// Available icons for literature types
const availableIcons = [
  { value: "book-open", icon: <BookOpen className="w-5 h-5" /> },
  { value: "file-text", icon: <FileText className="w-5 h-5" /> },
  { value: "microscope", icon: <Microscope className="w-5 h-5" /> },
  { value: "graduation-cap", icon: <GraduationCap className="w-5 h-5" /> },
  { value: "presentation", icon: <Presentation className="w-5 h-5" /> },
  { value: "file-search", icon: <FileSearch className="w-5 h-5" /> },
  { value: "bookmark", icon: <Bookmark className="w-5 h-5" /> },
];

const LiteratureTypeCreationForm: React.FC<LiteratureTypeCreationFormProps> = ({
  className,
  onSubmit,
  onCancel,
  initialData,
  isEditing = false,
}) => {
  // Parse initial data if editing
  const initialFields = React.useMemo(() => {
    if (!initialData?.typeMetadata) return {};
    try {
      return JSON.parse(initialData.typeMetadata);
    } catch {
      return {};
    }
  }, [initialData?.typeMetadata]);

  // State for the literature type name.
  const [typeName, setTypeName] = useState(initialData?.name || "");

  // State for core (native) fields: whether to include each one.
  const [coreFieldsEnabled, setCoreFieldsEnabled] = useState<Record<string, boolean>>({
    subtitle: initialFields?.subtitle !== undefined || false,
    publisher: initialFields?.publisher !== undefined || false,
    authors: initialFields?.authors !== undefined || false,
    journal: initialFields?.journal !== undefined || false,
    doi: initialFields?.doi !== undefined || false,
    versionsAreEqual: true, // Always include this
    icon: true, // Always include icon
    linkedVersionType: initialFields?.linkedVersionType !== undefined || false,
  });

  // For the versionsAreEqual field, store its value; default false.
  const [versionsAreEqualValue, setVersionsAreEqualValue] = useState<boolean>(
    initialFields?.versionsAreEqual?.default_value ?? false
  );
  
  // For the icon field, store its value; default "book-open".
  const [selectedIcon, setSelectedIcon] = useState<string>(
    initialFields?.icon?.default_value || "book-open"
  );

  // State for selected version type (single selection)
  const [selectedVersionType, setSelectedVersionType] = useState<string>(
    initialFields?.linkedVersionType?.default_value || ""
  );

  // State for custom fields.
  const [customFields, setCustomFields] = useState<CustomField[]>(() => {
    if (!initialFields) return [];
    
    // Extract custom fields from initial data
    return Object.entries(initialFields)
      .filter(([key]) => !['subtitle', 'publisher', 'authors', 'journal', 'doi', 'versionsAreEqual', 'icon', 'linkedVersionType'].includes(key))
      .map(([key, value]: [string, any]) => ({
        id: Math.random().toString(36).substr(2, 9),
        fieldName: key,
        fieldType: value.type as CustomFieldType,
        dropdownOptions: value.options || undefined,
      }));
  });

  // Version type creation modal state
  const [showVersionTypeModal, setShowVersionTypeModal] = useState(false);

  // Get available version types
  const { data: versionTypes } = useVersionTypes();

  // Update a core field's enabled state for non-special fields.
  const toggleCoreField = (key: string) => {
    if (key === "versionsAreEqual" || key === "icon") return; // Don't toggle these special fields
    setCoreFieldsEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Handle version type selection (mutually exclusive)
  const handleVersionTypeSelect = (versionTypeName: string) => {
    if (selectedVersionType === versionTypeName) {
      // Deselect if already selected
      setSelectedVersionType("");
    } else {
      // Select the version type
      setSelectedVersionType(versionTypeName);
    }
  };

  // Handle creating a new version type
  const handleCreateVersionType = (payload: { name: string; versionMetadata: string }) => {
    setShowVersionTypeModal(false);
    // The version type will be automatically linked to this literature type
    setSelectedVersionType(payload.name);
    // You might want to refresh version types here or handle the creation through parent
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

  const removeCustomField = (id: string) => {
    setCustomFields((prev) => prev.filter((field) => field.id !== id));
  };

  const updateCustomField = (id: string, key: keyof CustomField, value: any) => {
    setCustomFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, [key]: value } : field))
    );
  };

  const addDropdownOption = (fieldId: string) => {
    setCustomFields((prev) =>
      prev.map((field) => {
        if (field.id === fieldId) {
          const options = field.dropdownOptions || [];
          return { ...field, dropdownOptions: [...options, ""] };
        }
        return field;
      })
    );
  };

  const removeDropdownOption = (fieldId: string, optionIndex: number) => {
    setCustomFields((prev) =>
      prev.map((field) => {
        if (field.id === fieldId) {
          const options = field.dropdownOptions || [];
          return {
            ...field,
            dropdownOptions: options.filter((_, index) => index !== optionIndex),
          };
        }
        return field;
      })
    );
  };

  const updateDropdownOption = (fieldId: string, optionIndex: number, value: string) => {
    setCustomFields((prev) =>
      prev.map((field) => {
        if (field.id === fieldId) {
          const options = [...(field.dropdownOptions || [])];
          options[optionIndex] = value;
          return { ...field, dropdownOptions: options };
        }
        return field;
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
      if (key === "versionsAreEqual") {
        // Always include versionsAreEqual with its chosen value.
        payloadTemplate[key] = versionsAreEqualValue;
      } else if (key === "icon") {
        // Always include icon with its chosen value.
        payloadTemplate[key] = selectedIcon;
      } else if (key === "linkedVersionType") {
        if (selectedVersionType) {
          payloadTemplate[key] = selectedVersionType;
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
          }
        }
      }
    });

    // Merge core and custom templates.
    const typeMetadata = { ...payloadTemplate, ...customTemplate };

    const finalPayload = {
      name: typeName.trim(),
      typeMetadata: JSON.stringify(typeMetadata),
    };

    onSubmit(finalPayload);

    // Reset form
    setTypeName("");
    setCoreFieldsEnabled({
      subtitle: false,
      publisher: false,
      authors: false,
      journal: false,
      doi: false,
      versionsAreEqual: true,
      icon: true,
      linkedVersionType: false,
    });
    setVersionsAreEqualValue(false);
    setSelectedIcon("book-open");
    setSelectedVersionType("");
    setCustomFields([]);
  };

  return (
    <>
      <div className={`bg-slate-900 rounded-xl p-8 w-full max-w-7xl mx-auto ${className}`}>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-100">
              {isEditing ? 'Edit Literature Type' : 'Create Literature Type'}
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

          {/* Literature Type Name - Full Width */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Literature Type Name *
            </label>
            <input
              type="text"
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
              placeholder="e.g., Paper, Textbook, Thesis"
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all duration-200"
              required
            />
          </div>

          {/* Icon Selection - Full Width */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Icon *
            </label>
            <div className="grid grid-cols-4 gap-2 max-w-sm">
              {availableIcons.map((iconOption) => (
                <button
                  key={iconOption.value}
                  type="button"
                  onClick={() => setSelectedIcon(iconOption.value)}
                  className={`flex items-center justify-center p-3 border rounded-lg transition-all duration-200 ${
                    selectedIcon === iconOption.value
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "bg-slate-800/30 border-slate-700/30 text-slate-400 hover:bg-slate-800/50 hover:border-slate-600/50"
                  }`}
                >
                  {iconOption.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content Grid: Core Fields | Custom Fields */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Core Fields Column */}
            <div>
              <h3 className="text-lg font-medium text-slate-200 mb-4">Core Fields</h3>
              
              {/* Versions Are Equal - Special Case */}
              <div className="mb-4 p-3 bg-slate-800/30 border border-slate-700/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-300">Versions Are Equal</span>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setVersionsAreEqualValue(true)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-all duration-200 ${
                        versionsAreEqualValue
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      True
                    </button>
                    <button
                      type="button"
                      onClick={() => setVersionsAreEqualValue(false)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-all duration-200 ${
                        !versionsAreEqualValue
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      False
                    </button>
                  </div>
                </div>
              </div>

              {/* Other Core Fields in 2-column grid within the core column */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(coreFieldDefinitions)
                  .filter(([key]) => key !== "versionsAreEqual" && key !== "icon" && key !== "linkedVersionType")
                  .map(([key, fieldDef]) => {
                    const displayName = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
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

              {/* Version Type Linking Section */}
              <div className="mt-6">
                <h4 className="text-md font-medium text-slate-200 mb-3">Version Type Linking</h4>
                <div className="space-y-2">
                  {versionTypes?.map((versionType) => (
                    <button
                      key={versionType.documentId}
                      type="button"
                      onClick={() => handleVersionTypeSelect(versionType.name)}
                      className={`w-full text-left p-3 border rounded-lg transition-all duration-200 ${
                        selectedVersionType === versionType.name
                          ? "bg-emerald-600/20 border-emerald-500 text-emerald-200"
                          : "bg-slate-800/30 border-slate-700/30 text-slate-300 hover:bg-slate-800/50 hover:border-slate-600/50"
                      }`}
                    >
                      {versionType.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowVersionTypeModal(true)}
                    disabled={!typeName.trim()}
                    className="w-full text-left p-3 border border-dashed border-slate-600 text-slate-400 hover:text-slate-300 hover:border-slate-500 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center space-x-2">
                      <Plus className="w-4 h-4" />
                      <span>Add New Version Type</span>
                    </div>
                    {!typeName.trim() && (
                      <div className="text-xs text-slate-500 mt-1">
                        Enter literature type name first
                      </div>
                    )}
                  </button>
                </div>
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
                        onChange={(e) => updateCustomField(field.id, "fieldName", e.target.value)}
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
                      onChange={(e) => updateCustomField(field.id, "fieldType", e.target.value as CustomFieldType)}
                      className="w-full px-3 py-1 bg-slate-800/50 border border-slate-700/50 rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-sm"
                    >
                      <option value="string">Text</option>
                      <option value="number">Number</option>
                      <option value="dropdown">Dropdown</option>
                    </select>

                    {field.fieldType === "dropdown" && (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-400">Dropdown Options:</p>
                        {field.dropdownOptions?.map((option, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => updateDropdownOption(field.id, index, e.target.value)}
                              placeholder={`Option ${index + 1}`}
                              className="flex-1 px-2 py-1 bg-slate-800/50 border border-slate-700/50 rounded text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => removeDropdownOption(field.id, index)}
                              className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addDropdownOption(field.id)}
                          className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 text-xs"
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
            >
              {isEditing ? 'Save Changes' : 'Create Literature Type'}
            </button>
          </div>
        </form>
      </div>

      {/* Version Type Creation Modal */}
      {showVersionTypeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl p-6 max-w-7xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-100">Create Version Type for "{typeName}"</h3>
              <p className="text-sm text-slate-400 mt-1">This version type will be automatically linked to the literature type.</p>
            </div>
            <VersionTypeCreationForm
              onSubmit={handleCreateVersionType}
              onCancel={() => setShowVersionTypeModal(false)}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default LiteratureTypeCreationForm;

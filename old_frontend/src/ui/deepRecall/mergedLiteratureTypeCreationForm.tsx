// mergedLiteratureTypeCreationForm.tsx

import React, { useState } from "react";
import { useLiteratureTypes } from "../../customHooks/useLiterature";
import { 
  BookOpen, 
  FileText, 
  Microscope, 
  GraduationCap,
  Presentation, 
  FileSearch, 
  Bookmark, 
  Plus,
  X,
  Calendar,
  Type,
  Hash,
  Clock,
  Users,
  Link,
  GitMerge
} from 'lucide-react';

type CustomFieldType = "string" | "number" | "dropdown";

interface CustomField {
  id: string;
  fieldName: string;
  fieldType: CustomFieldType;
  dropdownOptions?: string[];
}

interface MergedLiteratureTypeCreationFormProps {
  className?: string;
  onSubmit: (payload: { 
    literatureType: { name: string; typeMetadata: string };
    versionType: { name: string; versionMetadata: string };
  }) => void;
  onCancel?: () => void;
  initialData?: {
    literatureType?: {
      name: string;
      typeMetadata: string;
    };
    versionType?: {
      name: string;
      versionMetadata: string;
    };
  };
  isEditing?: boolean;
}

// Define the preset core (native) fields for literature with their default field types.
// These define what type of field it is, not what the default content should be.
const literatureCoreFieldDefinitions: Record<string, { fieldType: string; defaultValue?: any }> = {
  subtitle: { fieldType: "string" },
  publisher: { fieldType: "string" },
  authors: { fieldType: "array" }, // Array of strings for author names
  journal: { fieldType: "string" },
  doi: { fieldType: "string" },
  versionsAreEqual: { fieldType: "boolean", defaultValue: false }, // Configuration field
  icon: { fieldType: "string", defaultValue: "book-open" }, // Configuration field
};

// Define the preset core (native) fields for version with their defaults.
const versionCoreFieldDefinitions: Record<string, { default: any }> = {
  publishingDate: { default: "" },
  editionNumber: { default: 0 },
  versionNumber: { default: 0 },
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

const MergedLiteratureTypeCreationForm: React.FC<MergedLiteratureTypeCreationFormProps> = ({
  className,
  onSubmit,
  onCancel,
  initialData,
  isEditing = false,
}) => {
  // Parse initial data if editing
  const initialLiteratureFields = React.useMemo(() => {
    if (!initialData?.literatureType?.typeMetadata) return {};
    try {
      return JSON.parse(initialData.literatureType.typeMetadata);
    } catch {
      return {};
    }
  }, [initialData?.literatureType?.typeMetadata]);

  const initialVersionFields = React.useMemo(() => {
    if (!initialData?.versionType?.versionMetadata) return {};
    try {
      return JSON.parse(initialData.versionType.versionMetadata);
    } catch {
      return {};
    }
  }, [initialData?.versionType?.versionMetadata]);

  // State for the type name (shared between literature and version)
  const [typeName, setTypeName] = useState(initialData?.literatureType?.name || "");

  // Literature type states
  const [literatureCoreFieldsEnabled, setLiteratureCoreFieldsEnabled] = useState<Record<string, boolean>>({
    subtitle: false,
    publisher: false,
    authors: false,
    journal: false,
    doi: false,
    versionsAreEqual: true, // Always include this
    icon: true, // Always include icon
  });

  // Update field enabled state when initial data changes (for edit mode)
  React.useEffect(() => {
    if (isEditing && initialLiteratureFields) {
      const newState: Record<string, boolean> = {
        versionsAreEqual: true, // Always include this
        icon: true, // Always include icon
      };
      
      // Check each core field to see if it exists in the metadata
      Object.keys(literatureCoreFieldDefinitions).forEach(field => {
        if (field !== 'versionsAreEqual' && field !== 'icon') {
          newState[field] = initialLiteratureFields[field] !== undefined;
        }
      });
      
      setLiteratureCoreFieldsEnabled(newState);
    }
  }, [isEditing, initialLiteratureFields]);

  const [versionsAreEqualValue, setVersionsAreEqualValue] = useState<boolean>(() => {
    const versionsAreEqualField = initialLiteratureFields?.versionsAreEqual;
    if (versionsAreEqualField) {
      // Handle both default_value and default structures
      return versionsAreEqualField.default_value !== undefined 
        ? versionsAreEqualField.default_value 
        : versionsAreEqualField.default !== undefined
        ? versionsAreEqualField.default
        : versionsAreEqualField;
    }
    return false;
  });
  
  const [selectedIcon, setSelectedIcon] = useState<string>(() => {
    const iconField = initialLiteratureFields?.icon;
    if (iconField) {
      // Handle both default_value and default structures
      return iconField.default_value !== undefined 
        ? iconField.default_value 
        : iconField.default !== undefined
        ? iconField.default
        : iconField;
    }
    return "book-open";
  });

  const [literatureCustomFields, setLiteratureCustomFields] = useState<CustomField[]>(() => {
    const customFields: CustomField[] = [];
    if (initialLiteratureFields) {
      Object.entries(initialLiteratureFields).forEach(([key, value]: [string, any]) => {
        if (!literatureCoreFieldDefinitions[key]) {
          // Handle both default_value and default structures
          const fieldValue = value?.default_value !== undefined ? value.default_value : 
                            value?.default !== undefined ? value.default : value;
          customFields.push({
            id: Math.random().toString(36).substr(2, 9),
            fieldName: key,
            fieldType: Array.isArray(fieldValue) ? "dropdown" : typeof fieldValue === "number" ? "number" : "string",
            dropdownOptions: Array.isArray(fieldValue) ? fieldValue : undefined,
          });
        }
      });
    }
    return customFields;
  });

  // Version type states
  const [versionCoreFieldsEnabled, setVersionCoreFieldsEnabled] = useState<Record<string, boolean>>({
    publishingDate: false,
    editionNumber: false,
    versionNumber: false,
  });

  // Update version field enabled state when initial data changes (for edit mode)
  React.useEffect(() => {
    if (isEditing && initialVersionFields) {
      const newState: Record<string, boolean> = {};
      
      // Check each core field to see if it exists in the metadata
      Object.keys(versionCoreFieldDefinitions).forEach(field => {
        newState[field] = initialVersionFields[field] !== undefined;
      });
      
      setVersionCoreFieldsEnabled(newState);
    }
  }, [isEditing, initialVersionFields]);

  const [versionCustomFields, setVersionCustomFields] = useState<CustomField[]>(() => {
    const customFields: CustomField[] = [];
    if (initialVersionFields) {
      Object.entries(initialVersionFields).forEach(([key, value]: [string, any]) => {
        if (!versionCoreFieldDefinitions[key] && key !== 'literatureTypes') {
          // Handle both default_value and default structures
          const fieldValue = value?.default_value !== undefined ? value.default_value : 
                            value?.default !== undefined ? value.default : value;
          customFields.push({
            id: Math.random().toString(36).substr(2, 9),
            fieldName: key,
            fieldType: Array.isArray(fieldValue) ? "dropdown" : typeof fieldValue === "number" ? "number" : "string",
            dropdownOptions: Array.isArray(fieldValue) ? fieldValue : undefined,
          });
        }
      });
    }
    return customFields;
  });

  // Helper functions for literature fields
  const addLiteratureCustomField = () => {
    const newField: CustomField = {
      id: Math.random().toString(36).substr(2, 9),
      fieldName: "",
      fieldType: "string",
    };
    setLiteratureCustomFields([...literatureCustomFields, newField]);
  };

  const updateLiteratureCustomField = (id: string, updates: Partial<CustomField>) => {
    setLiteratureCustomFields(fields =>
      fields.map(field => field.id === id ? { ...field, ...updates } : field)
    );
  };

  const removeLiteratureCustomField = (id: string) => {
    setLiteratureCustomFields(fields => fields.filter(field => field.id !== id));
  };

  // Helper functions for version fields
  const addVersionCustomField = () => {
    const newField: CustomField = {
      id: Math.random().toString(36).substr(2, 9),
      fieldName: "",
      fieldType: "string",
    };
    setVersionCustomFields([...versionCustomFields, newField]);
  };

  const updateVersionCustomField = (id: string, updates: Partial<CustomField>) => {
    setVersionCustomFields(fields =>
      fields.map(field => field.id === id ? { ...field, ...updates } : field)
    );
  };

  const removeVersionCustomField = (id: string) => {
    setVersionCustomFields(fields => fields.filter(field => field.id !== id));
  };

  // Helper function to capitalize and format field names
  const formatFieldName = (fieldName: string): string => {
    // Convert camelCase to Title Case
    const formatted = fieldName
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before capital letters
      .replace(/^./, str => str.toUpperCase()); // Capitalize first letter
    
    return formatted;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!typeName.trim()) {
      alert("Please enter a type name.");
      return;
    }

    // Build literature type metadata
    const literatureMetadata: any = {};
    
    // Add enabled core fields for literature
    Object.entries(literatureCoreFieldsEnabled).forEach(([field, enabled]) => {
      if (enabled) {
        if (field === "versionsAreEqual") {
          literatureMetadata[field] = { default_value: versionsAreEqualValue };
        } else if (field === "icon") {
          literatureMetadata[field] = { default_value: selectedIcon };
        } else {
          // For other fields, just indicate they are available (no pre-filled value)
          const fieldDef = literatureCoreFieldDefinitions[field];
          if (fieldDef.fieldType === "array") {
            literatureMetadata[field] = { field_type: "array", default_value: [] };
          } else if (fieldDef.fieldType === "string") {
            literatureMetadata[field] = { field_type: "string", default_value: "" };
          } else {
            literatureMetadata[field] = { field_type: fieldDef.fieldType, default_value: "" };
          }
        }
      }
    });

    // Add custom fields for literature
    literatureCustomFields.forEach(field => {
      if (field.fieldName.trim()) {
        literatureMetadata[field.fieldName] = {
          default_value: field.fieldType === "dropdown" ? (field.dropdownOptions || []) : 
                        field.fieldType === "number" ? 0 : ""
        };
      }
    });

    // Build version type metadata
    const versionMetadata: any = {};
    
    // Add enabled core fields for version
    Object.entries(versionCoreFieldsEnabled).forEach(([field, enabled]) => {
      if (enabled) {
        versionMetadata[field] = versionCoreFieldDefinitions[field];
      }
    });

    // Add custom fields for version
    versionCustomFields.forEach(field => {
      if (field.fieldName.trim()) {
        versionMetadata[field.fieldName] = {
          default_value: field.fieldType === "dropdown" ? (field.dropdownOptions || []) : 
                        field.fieldType === "number" ? 0 : ""
        };
      }
    });

    // Add the literature type link to version metadata
    versionMetadata.literatureTypes = { default_value: [typeName] };

    onSubmit({
      literatureType: {
        name: typeName,
        typeMetadata: JSON.stringify(literatureMetadata),
      },
      versionType: {
        name: typeName, // Same name as literature type
        versionMetadata: JSON.stringify(versionMetadata),
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
      {/* Type Name */}
      <div>
        <label htmlFor="typeName" className="block text-sm font-medium text-slate-300 mb-2">
          Type Name
        </label>
        <input
          type="text"
          id="typeName"
          value={typeName}
          onChange={(e) => setTypeName(e.target.value)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          placeholder="e.g., Paper, Book, Thesis..."
          required
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Literature Metadata Section */}
        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-blue-600 rounded-full"></div>
            <h3 className="text-lg font-semibold text-slate-200">Literature Metadata</h3>
          </div>

          {/* Icon Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Icon</label>
            <div className="grid grid-cols-4 gap-2">
              {availableIcons.map((iconOption) => (
                <button
                  key={iconOption.value}
                  type="button"
                  onClick={() => setSelectedIcon(iconOption.value)}
                  className={`p-3 rounded-lg border-2 transition-all duration-200 flex items-center justify-center ${
                    selectedIcon === iconOption.value
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                      : "border-slate-600 bg-slate-700/50 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  {iconOption.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Literature Core Fields */}
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-3">Core Fields</h4>
            <div className="space-y-2">
              {Object.entries(literatureCoreFieldDefinitions).map(([field, _]) => {
                if (field === "icon") return null; // Skip icon as it's handled separately
                if (field === "versionsAreEqual") {
                  return (
                    <div 
                      key={field} 
                      onClick={() => setVersionsAreEqualValue(!versionsAreEqualValue)}
                      className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/30 cursor-pointer hover:bg-slate-700/40 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300 font-medium">{formatFieldName(field)}</span>
                        <div
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                            versionsAreEqualValue ? 'bg-emerald-600' : 'bg-slate-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                              versionsAreEqualValue ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={field}
                    onClick={() => setLiteratureCoreFieldsEnabled(prev => ({
                      ...prev,
                      [field]: !prev[field]
                    }))}
                    className={`block p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                      literatureCoreFieldsEnabled[field]
                        ? 'bg-emerald-900/20 border-emerald-600/50 shadow-md'
                        : 'bg-slate-700/30 border-slate-600/30 hover:border-slate-500/50 hover:bg-slate-700/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${
                        literatureCoreFieldsEnabled[field] ? 'text-emerald-300' : 'text-slate-300'
                      }`}>
                        {formatFieldName(field)}
                      </span>
                      <div className={`w-4 h-4 rounded border-2 transition-all duration-200 flex items-center justify-center ${
                        literatureCoreFieldsEnabled[field]
                          ? 'bg-emerald-600 border-emerald-600'
                          : 'bg-transparent border-slate-500'
                      }`}>
                        {literatureCoreFieldsEnabled[field] && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Literature Custom Fields */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-slate-300">Custom Fields</h4>
              <button
                type="button"
                onClick={addLiteratureCustomField}
                className="flex items-center space-x-1 px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            </div>
            <div className="space-y-2">
              {literatureCustomFields.map((field) => (
                <div key={field.id} className="flex items-center space-x-2 p-2 bg-slate-700/30 rounded-lg">
                  <input
                    type="text"
                    value={field.fieldName}
                    onChange={(e) => updateLiteratureCustomField(field.id, { fieldName: e.target.value })}
                    placeholder="Field name"
                    className="flex-1 px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                  />
                  <select
                    value={field.fieldType}
                    onChange={(e) => updateLiteratureCustomField(field.id, { fieldType: e.target.value as CustomFieldType })}
                    className="px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="dropdown">Dropdown</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeLiteratureCustomField(field.id)}
                    className="p-1 text-red-400 hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Version Metadata Section */}
        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
            <h3 className="text-lg font-semibold text-slate-200">Version Metadata</h3>
          </div>

          {/* Version Core Fields */}
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-3">Core Fields</h4>
            <div className="space-y-2">
              {/* Publishing Date Field */}
              <div
                onClick={() => setVersionCoreFieldsEnabled(prev => ({
                  ...prev,
                  publishingDate: !prev.publishingDate
                }))}
                className={`block p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                  versionCoreFieldsEnabled.publishingDate
                    ? 'bg-blue-900/20 border-blue-600/50 shadow-md'
                    : 'bg-slate-700/30 border-slate-600/30 hover:border-slate-500/50 hover:bg-slate-700/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${
                    versionCoreFieldsEnabled.publishingDate ? 'text-blue-300' : 'text-slate-300'
                  }`}>
                    {formatFieldName('publishingDate')}
                  </span>
                  <div className={`w-4 h-4 rounded border-2 transition-all duration-200 flex items-center justify-center ${
                    versionCoreFieldsEnabled.publishingDate
                      ? 'bg-blue-600 border-blue-600'
                      : 'bg-transparent border-slate-500'
                  }`}>
                    {versionCoreFieldsEnabled.publishingDate && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>

              {/* Edition/Version Number Toggle */}
              <div className={`p-3 rounded-lg border transition-all duration-200 ${
                versionsAreEqualValue 
                  ? 'bg-slate-800/30 border-slate-700/30 opacity-50'
                  : 'bg-slate-700/30 border-slate-600/30'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${
                    versionsAreEqualValue ? 'text-slate-500' : 'text-slate-300'
                  }`}>
                    Numbering System
                  </span>
                  <div className="flex space-x-1">
                    <button
                      type="button"
                      disabled={versionsAreEqualValue}
                      onClick={() => setVersionCoreFieldsEnabled(prev => ({
                        ...prev,
                        editionNumber: false,
                        versionNumber: false
                      }))}
                      className={`px-2 py-1.5 text-xs rounded-md transition-all duration-200 ${
                        versionsAreEqualValue
                          ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                          : !versionCoreFieldsEnabled.editionNumber && !versionCoreFieldsEnabled.versionNumber
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                    >
                      None
                    </button>
                    <button
                      type="button"
                      disabled={versionsAreEqualValue}
                      onClick={() => setVersionCoreFieldsEnabled(prev => ({
                        ...prev,
                        editionNumber: true,
                        versionNumber: false
                      }))}
                      className={`px-2 py-1.5 text-xs rounded-md transition-all duration-200 ${
                        versionsAreEqualValue
                          ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                          : versionCoreFieldsEnabled.editionNumber
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                    >
                      Edition
                    </button>
                    <button
                      type="button"
                      disabled={versionsAreEqualValue}
                      onClick={() => setVersionCoreFieldsEnabled(prev => ({
                        ...prev,
                        versionNumber: true,
                        editionNumber: false
                      }))}
                      className={`px-2 py-1.5 text-xs rounded-md transition-all duration-200 ${
                        versionsAreEqualValue
                          ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                          : versionCoreFieldsEnabled.versionNumber
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                    >
                      Version
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Version Custom Fields */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-slate-300">Custom Fields</h4>
              <button
                type="button"
                onClick={addVersionCustomField}
                className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            </div>
            <div className="space-y-2">
              {versionCustomFields.map((field) => (
                <div key={field.id} className="flex items-center space-x-2 p-2 bg-slate-700/30 rounded-lg">
                  <input
                    type="text"
                    value={field.fieldName}
                    onChange={(e) => updateVersionCustomField(field.id, { fieldName: e.target.value })}
                    placeholder="Field name"
                    className="flex-1 px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                  />
                  <select
                    value={field.fieldType}
                    onChange={(e) => updateVersionCustomField(field.id, { fieldType: e.target.value as CustomFieldType })}
                    className="px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="dropdown">Dropdown</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeVersionCustomField(field.id)}
                    className="p-1 text-red-400 hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-lg hover:from-emerald-700 hover:to-blue-700 transition-all duration-200"
        >
          {isEditing ? "Update" : "Create"} Literature Type
        </button>
      </div>
    </form>
  );
};

export default MergedLiteratureTypeCreationForm;

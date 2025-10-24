/**
 * Preset utilities
 * Helpers for working with presets and form generation
 */

import type {
  Preset,
  CustomFieldDefinition,
  CoreFieldConfig,
  PresetExpanded,
  FieldType,
} from "@deeprecall/core";

/**
 * Expand a preset into all fields for form rendering
 * Merges core field config with custom field definitions
 */
export function expandPreset(preset: Preset): PresetExpanded {
  const allFields: PresetExpanded["allFields"] = [];

  // Add core fields first
  Object.entries(preset.coreFieldConfig).forEach(([key, config]) => {
    // Skip hidden fields
    if (config.hidden) return;

    allFields.push({
      key,
      label: formatFieldLabel(key),
      type: "core" as const,
      required: config.required ?? false,
      isCustom: false,
      config: {
        required: config.required ?? false,
        hidden: config.hidden ?? false,
        defaultValue: config.defaultValue,
        helpText: config.helpText,
        placeholder: config.placeholder,
      },
    });
  });

  // Add custom fields
  preset.customFields.forEach((field) => {
    allFields.push({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      isCustom: true,
      config: field,
    });
  });

  // Sort by order if specified
  if (preset.fieldOrder) {
    allFields.sort((a, b) => {
      const aIndex = preset.fieldOrder?.indexOf(a.key) ?? 999;
      const bIndex = preset.fieldOrder?.indexOf(b.key) ?? 999;
      return aIndex - bIndex;
    });
  } else {
    // Sort by custom field order, then by key
    allFields.sort((a, b) => {
      if (a.isCustom && b.isCustom) {
        const aOrder = (a.config as CustomFieldDefinition).order ?? 999;
        const bOrder = (b.config as CustomFieldDefinition).order ?? 999;
        return aOrder - bOrder;
      }
      return 0;
    });
  }

  return {
    ...preset,
    allFields,
  };
}

/**
 * Format a camelCase field key into a readable label
 */
function formatFieldLabel(key: string): string {
  // Handle common field names
  const labelMap: Record<string, string> = {
    id: "ID",
    workId: "Work ID",
    versionId: "Version ID",
    workType: "Type",
    sha256: "SHA-256",
    doi: "DOI",
    isbn: "ISBN",
    arxivId: "arXiv ID",
    orcid: "ORCID",
  };

  if (labelMap[key]) return labelMap[key];

  // Convert camelCase to Title Case
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Get default value for a field based on its type
 */
export function getFieldDefaultValue(
  type: FieldType | "core",
  defaultValue?: unknown
): unknown {
  if (defaultValue !== undefined) return defaultValue;

  switch (type) {
    case "boolean":
      return false;
    case "number":
      return 0;
    case "multiselect":
      return [];
    case "text":
    case "textarea":
    case "select":
    case "date":
    case "url":
    case "email":
    default:
      return "";
  }
}

/**
 * Validate a field value against its definition
 */
export function validateField(
  value: unknown,
  field: CustomFieldDefinition | CoreFieldConfig,
  isCustom: boolean
): string | null {
  // Check required
  const required = field.required ?? false;
  if (required && (value === undefined || value === null || value === "")) {
    return "This field is required";
  }

  // Skip further validation if empty and not required
  if (!value) return null;

  // Custom field validation
  if (isCustom) {
    const customField = field as CustomFieldDefinition;
    const validation = customField.validation;

    if (!validation) return null;

    // Number validation
    if (customField.type === "number" && typeof value === "number") {
      if (validation.min !== undefined && value < validation.min) {
        return `Must be at least ${validation.min}`;
      }
      if (validation.max !== undefined && value > validation.max) {
        return `Must be at most ${validation.max}`;
      }
    }

    // String validation
    if (typeof value === "string") {
      if (validation.minLength && value.length < validation.minLength) {
        return `Must be at least ${validation.minLength} characters`;
      }
      if (validation.maxLength && value.length > validation.maxLength) {
        return `Must be at most ${validation.maxLength} characters`;
      }
      if (validation.pattern) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          return "Invalid format";
        }
      }
      if (validation.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return "Invalid email address";
        }
      }
      if (validation.url) {
        try {
          new URL(value);
        } catch {
          return "Invalid URL";
        }
      }
    }
  }

  return null;
}

/**
 * Group fields by their group property
 * Core Fields always appear first
 */
export function groupFieldsByGroup(
  fields: PresetExpanded["allFields"]
): Map<string, PresetExpanded["allFields"]> {
  const groups = new Map<string, PresetExpanded["allFields"]>();

  // Separate core fields first
  const coreFields: PresetExpanded["allFields"] = [];
  const otherFields: PresetExpanded["allFields"] = [];

  fields.forEach((field) => {
    if (!field.isCustom) {
      coreFields.push(field);
    } else {
      otherFields.push(field);
    }
  });

  // Add core fields first if they exist
  if (coreFields.length > 0) {
    groups.set("Core Fields", coreFields);
  }

  // Then add custom fields by their groups
  otherFields.forEach((field) => {
    const group = (field.config as CustomFieldDefinition).group || "General";

    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(field);
  });

  return groups;
}

/**
 * Split form data into core fields and metadata
 */
export function splitFormData(
  formData: Record<string, unknown>,
  preset: Preset
): {
  coreFields: Record<string, unknown>;
  metadata: Record<string, unknown>;
} {
  const coreFields: Record<string, unknown> = {};
  const metadata: Record<string, unknown> = {};

  Object.entries(formData).forEach(([key, value]) => {
    if (preset.coreFieldConfig[key]) {
      coreFields[key] = value;
    } else {
      metadata[key] = value;
    }
  });

  return { coreFields, metadata };
}

/**
 * Merge core fields and metadata back into a single object
 */
export function mergeFormData(
  coreFields: Record<string, unknown>,
  metadata: Record<string, unknown>
): Record<string, unknown> {
  return { ...coreFields, metadata };
}

/**
 * Get icon component name from icon string
 */
export function getIconName(icon: string | undefined): string {
  return icon || "FileText";
}

/**
 * Get preset color with fallback
 */
export function getPresetColor(color: string | undefined): string {
  return color || "#6b7280"; // neutral-500
}

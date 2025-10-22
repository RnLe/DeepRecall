/**
 * Preset schema for dynamic form templates
 * Allows users to define custom fields and form configurations
 */

import { z } from "zod";
import { Id, ISODate, IconName, HexColor } from "./library";

// ============================================================================
// Custom Field Definitions
// ============================================================================

/**
 * Field types supported in dynamic forms
 */
export const FieldTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "boolean",
  "select",
  "multiselect",
  "date",
  "url",
  "email",
]);

export type FieldType = z.infer<typeof FieldTypeSchema>;

/**
 * Validation rules for custom fields
 */
export const FieldValidationSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(1).optional(),
    pattern: z.string().optional(), // Regex pattern
    email: z.boolean().optional(),
    url: z.boolean().optional(),
  })
  .optional();

export type FieldValidation = z.infer<typeof FieldValidationSchema>;

/**
 * Option for select/multiselect fields
 */
export const SelectOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  color: HexColor.optional(),
  icon: IconName.optional(),
});

export type SelectOption = z.infer<typeof SelectOptionSchema>;

/**
 * Definition for a custom field in metadata
 */
export const CustomFieldDefinitionSchema = z.object({
  key: z.string(), // Key in metadata object
  label: z.string(), // Display label
  type: FieldTypeSchema,
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),

  // For select/multiselect
  options: z.array(SelectOptionSchema).optional(),

  // Validation rules
  validation: FieldValidationSchema,

  // UI hints
  group: z.string().optional(), // Group related fields
  order: z.number().int().min(0).optional(), // Display order
});

export type CustomFieldDefinition = z.infer<typeof CustomFieldDefinitionSchema>;

// ============================================================================
// Core Field Configuration
// ============================================================================

/**
 * Configuration for a core schema field
 */
export const CoreFieldConfigSchema = z.object({
  required: z.boolean(),
  hidden: z.boolean().optional().default(false),
  defaultValue: z.unknown().optional(),
  helpText: z.string().optional(),
  placeholder: z.string().optional(),
});

export type CoreFieldConfig = z.infer<typeof CoreFieldConfigSchema>;

// ============================================================================
// Preset Entity
// ============================================================================

/**
 * Target entity type for preset
 */
export const PresetTargetSchema = z.enum(["work", "version", "asset"]);
export type PresetTarget = z.infer<typeof PresetTargetSchema>;

/**
 * Form layout options
 */
export const FormLayoutSchema = z
  .enum(["single-column", "two-column"])
  .optional();
export type FormLayout = z.infer<typeof FormLayoutSchema>;

/**
 * Preset for dynamic entity creation forms
 */
export const PresetSchema = z.object({
  id: Id,
  kind: z.literal("preset"),

  // Identity
  name: z.string(),
  description: z.string().optional(),
  icon: IconName.optional(),
  color: HexColor.optional(),

  // What entity this preset is for
  targetEntity: PresetTargetSchema,

  // Configuration for core schema fields
  // Keys are field names from the target schema (e.g., "title", "authors")
  coreFieldConfig: z
    .record(z.string(), CoreFieldConfigSchema.partial())
    .default({}),

  // Custom fields to add to metadata
  customFields: z.array(CustomFieldDefinitionSchema).default([]),

  // UI layout hints
  formLayout: FormLayoutSchema,
  fieldOrder: z.array(z.string()).optional(), // Order of fields in form

  // System preset (cannot be edited/deleted by user)
  isSystem: z.boolean().default(false),

  // Timestamps
  createdAt: ISODate,
  updatedAt: ISODate,
});

export type Preset = z.infer<typeof PresetSchema>;

// ============================================================================
// Preset with resolved data (for forms)
// ============================================================================

/**
 * Preset with all fields expanded for form rendering
 */
export interface PresetExpanded extends Preset {
  allFields: Array<{
    key: string;
    label: string;
    type: FieldType | "core";
    required: boolean;
    isCustom: boolean;
    config: CoreFieldConfig | CustomFieldDefinition;
  }>;
}

// ============================================================================
// Form Data
// ============================================================================

/**
 * Form data structure when creating entity from preset
 */
export interface PresetFormData {
  presetId: string;
  coreFields: Record<string, unknown>; // Core schema fields
  metadata: Record<string, unknown>; // Custom fields
}

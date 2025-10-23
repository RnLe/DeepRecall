/**
 * DynamicForm Component
 * Renders a form based on a preset configuration
 * Handles both core fields and custom metadata fields
 */

"use client";

import { useState, useEffect } from "react";
import type { Preset } from "@deeprecall/core";
import {
  expandPreset,
  groupFieldsByGroup,
  validateField,
  splitFormData,
} from "../utils/presets";
import { FieldRenderer } from "./FieldRenderer";

interface DynamicFormProps {
  /** Preset to render form for */
  preset: Preset;
  /** Initial form values (optional) */
  initialValues?: Record<string, unknown>;
  /** Callback when form is submitted */
  onSubmit: (data: {
    coreFields: Record<string, unknown>;
    metadata: Record<string, unknown>;
  }) => void | Promise<void>;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Submit button text */
  submitLabel?: string;
  /** Cancel button text */
  cancelLabel?: string;
  /** Whether form is currently submitting */
  isSubmitting?: boolean;
  /** Optional className */
  className?: string;
}

export function DynamicForm({
  preset,
  initialValues = {},
  onSubmit,
  onCancel,
  submitLabel = "Create",
  cancelLabel = "Cancel",
  isSubmitting = false,
  className = "",
}: DynamicFormProps) {
  // Expand preset into all fields
  const expanded = expandPreset(preset);

  // Form state
  const [formData, setFormData] =
    useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Update form data when initialValues change
  useEffect(() => {
    setFormData(initialValues);
  }, [initialValues]);

  // Handle field change
  const handleFieldChange = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));

    // Clear error when user starts typing
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: null }));
    }
  };

  // Handle field blur (for validation)
  const handleFieldBlur = (key: string) => {
    setTouched((prev) => ({ ...prev, [key]: true }));

    // Validate field
    const field = expanded.allFields.find((f) => f.key === key);
    if (field) {
      const error = validateField(formData[key], field.config, field.isCustom);
      setErrors((prev) => ({ ...prev, [key]: error }));
    }
  };

  // Validate all fields
  const validateForm = (): boolean => {
    const newErrors: Record<string, string | null> = {};
    let hasErrors = false;

    expanded.allFields.forEach((field) => {
      const error = validateField(
        formData[field.key],
        field.config,
        field.isCustom
      );
      if (error) {
        newErrors[field.key] = error;
        hasErrors = true;
      }
    });

    setErrors(newErrors);
    setTouched(
      Object.fromEntries(expanded.allFields.map((f) => [f.key, true]))
    );

    return !hasErrors;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    if (!validateForm()) {
      return;
    }

    // Split into core fields and metadata
    const { coreFields, metadata } = splitFormData(formData, preset);

    // Call onSubmit
    await onSubmit({ coreFields, metadata });
  };

  // Group fields
  const fieldGroups = groupFieldsByGroup(expanded.allFields);

  // Determine if a field should take full width
  const isFullWidthField = (fieldKey: string) => {
    const fullWidthFields = [
      "title",
      "subtitle",
      "description",
      "abstract",
      "notes",
      "url",
    ];
    return fullWidthFields.includes(fieldKey);
  };

  // Get icon for group
  const getGroupIcon = (groupName: string) => {
    if (
      groupName.toLowerCase().includes("basic") ||
      groupName.toLowerCase().includes("core")
    ) {
      return (
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
      );
    }
    if (
      groupName.toLowerCase().includes("publication") ||
      groupName.toLowerCase().includes("version")
    ) {
      return (
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
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      );
    }
    return (
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
    );
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
      {/* Preset info - Compact Header */}
      <div className="bg-neutral-800/30 border border-neutral-700 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
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
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-neutral-100">
              {preset.name}
            </h2>
            {preset.description && (
              <p className="text-sm text-neutral-400 mt-1">
                {preset.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Field groups */}
      {Array.from(fieldGroups.entries()).map(([groupName, fields]) => {
        // Separate full-width and regular fields
        const fullWidthFields = fields.filter((f) => isFullWidthField(f.key));
        const regularFields = fields.filter((f) => !isFullWidthField(f.key));

        return (
          <div
            key={groupName}
            className="bg-neutral-800/30 border border-neutral-700 rounded-xl p-5"
          >
            {/* Group header */}
            <h3 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
              {getGroupIcon(groupName)}
              {groupName}
            </h3>

            {/* Fields in group */}
            <div className="space-y-4">
              {/* Full-width fields first */}
              {fullWidthFields.map((field) => (
                <div key={field.key} onBlur={() => handleFieldBlur(field.key)}>
                  {field.isCustom ? (
                    <FieldRenderer
                      field={field.config as any}
                      value={formData[field.key]}
                      onChange={(value) => handleFieldChange(field.key, value)}
                      error={touched[field.key] ? errors[field.key] : null}
                    />
                  ) : (
                    <CoreFieldRenderer
                      fieldKey={field.key}
                      label={field.label}
                      required={field.required}
                      value={formData[field.key]}
                      onChange={(value) => handleFieldChange(field.key, value)}
                      error={touched[field.key] ? errors[field.key] : null}
                      placeholder={field.config.placeholder}
                      helpText={field.config.helpText}
                    />
                  )}
                </div>
              ))}

              {/* Regular fields in grid */}
              {regularFields.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {regularFields.map((field) => (
                    <div
                      key={field.key}
                      onBlur={() => handleFieldBlur(field.key)}
                    >
                      {field.isCustom ? (
                        <FieldRenderer
                          field={field.config as any}
                          value={formData[field.key]}
                          onChange={(value) =>
                            handleFieldChange(field.key, value)
                          }
                          error={touched[field.key] ? errors[field.key] : null}
                        />
                      ) : (
                        <CoreFieldRenderer
                          fieldKey={field.key}
                          label={field.label}
                          required={field.required}
                          value={formData[field.key]}
                          onChange={(value) =>
                            handleFieldChange(field.key, value)
                          }
                          error={touched[field.key] ? errors[field.key] : null}
                          placeholder={field.config.placeholder}
                          helpText={field.config.helpText}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Form actions */}
      <div className="flex items-center justify-between pt-4 border-t border-neutral-700">
        <p className="text-sm text-neutral-500">
          {expanded.allFields.filter((f) => formData[f.key]).length} of{" "}
          {expanded.allFields.length} fields filled
        </p>
        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-neutral-800 text-neutral-200 rounded-lg hover:bg-neutral-750 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
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
                Submitting...
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
                {submitLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * Renderer for core schema fields
 * Simple text/textarea inputs for core fields
 */
interface CoreFieldRendererProps {
  fieldKey: string;
  label: string;
  required: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string | null;
  placeholder?: string;
  helpText?: string;
}

function CoreFieldRenderer({
  fieldKey,
  label,
  required,
  value,
  onChange,
  error,
  placeholder,
  helpText,
}: CoreFieldRendererProps) {
  const fieldId = `core-field-${fieldKey}`;
  const inputClass = `w-full px-3 py-2 bg-neutral-800 border rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 transition-colors ${
    error
      ? "border-red-500 focus:ring-red-500/50"
      : "border-neutral-700 focus:ring-blue-500/50"
  }`;

  // Determine input type based on field key
  const isTextarea =
    fieldKey === "description" ||
    fieldKey === "notes" ||
    fieldKey === "abstract";

  // Special handling for certain field types
  const isNumber =
    fieldKey === "year" ||
    fieldKey === "versionNumber" ||
    fieldKey === "pageCount";
  const isDate = fieldKey === "publishingDate" || fieldKey === "read";
  const isUrl = fieldKey === "url" || fieldKey === "doi";

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label */}
      <label
        htmlFor={fieldId}
        className="text-sm font-medium text-neutral-300 flex items-center gap-1"
      >
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>

      {/* Input */}
      {isTextarea ? (
        <textarea
          id={fieldId}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`${inputClass} resize-none`}
        />
      ) : isNumber ? (
        <input
          id={fieldId}
          type="number"
          value={(value as number) || ""}
          onChange={(e) =>
            onChange(e.target.value ? Number(e.target.value) : "")
          }
          placeholder={placeholder}
          className={inputClass}
        />
      ) : isDate ? (
        <input
          id={fieldId}
          type="date"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      ) : (
        <input
          id={fieldId}
          type={isUrl ? "url" : "text"}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClass}
        />
      )}

      {/* Help text or error */}
      {error ? (
        <p className="text-xs text-red-400 flex items-center gap-1">
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
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {error}
        </p>
      ) : helpText ? (
        <p className="text-xs text-neutral-500">{helpText}</p>
      ) : null}
    </div>
  );
}

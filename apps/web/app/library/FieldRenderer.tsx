/**
 * FieldRenderer Component
 * Renders individual form fields based on field type
 */

"use client";

import type { CustomFieldDefinition, FieldType } from "@deeprecall/core/schemas/presets";
import { getFieldDefaultValue } from "@/src/utils/presets";

interface FieldRendererProps {
  /** Field definition */
  field: CustomFieldDefinition;
  /** Current value */
  value: unknown;
  /** Change handler */
  onChange: (value: unknown) => void;
  /** Validation error message */
  error?: string | null;
  /** Optional className */
  className?: string;
}

export function FieldRenderer({
  field,
  value,
  onChange,
  error,
  className = "",
}: FieldRendererProps) {
  const fieldId = `field-${field.key}`;

  // Ensure value has default if undefined
  const currentValue =
    value ?? getFieldDefaultValue(field.type, field.defaultValue);

  // Base input classes
  const baseInputClass =
    "w-full px-3 py-2 bg-neutral-800 border rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 transition-colors";
  const normalBorder = "border-neutral-700 focus:ring-blue-500/50";
  const errorBorder = "border-red-500 focus:ring-red-500/50";
  const inputClass = `${baseInputClass} ${error ? errorBorder : normalBorder}`;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {/* Label */}
      <label
        htmlFor={fieldId}
        className="text-sm font-medium text-neutral-300 flex items-center gap-1"
      >
        {field.label}
        {field.required && <span className="text-red-400">*</span>}
      </label>

      {/* Field based on type */}
      {field.type === "text" && (
        <input
          id={fieldId}
          type="text"
          value={(currentValue as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
        />
      )}

      {field.type === "textarea" && (
        <textarea
          id={fieldId}
          value={(currentValue as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={`${inputClass} resize-none`}
        />
      )}

      {field.type === "number" && (
        <input
          id={fieldId}
          type="number"
          value={(currentValue as number) || ""}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder={field.placeholder}
          min={field.validation?.min}
          max={field.validation?.max}
          className={inputClass}
        />
      )}

      {field.type === "boolean" && (
        <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-neutral-800/50 transition-colors">
          <input
            id={fieldId}
            type="checkbox"
            checked={(currentValue as boolean) || false}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 bg-neutral-800 border border-neutral-700 rounded focus:ring-2 focus:ring-blue-500 text-blue-500 cursor-pointer"
          />
          <span className="text-sm text-neutral-300">
            {field.helpText || "Enable this option"}
          </span>
        </label>
      )}

      {field.type === "date" && (
        <input
          id={fieldId}
          type="date"
          value={(currentValue as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}

      {field.type === "url" && (
        <input
          id={fieldId}
          type="url"
          value={(currentValue as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "https://example.com"}
          className={inputClass}
        />
      )}

      {field.type === "email" && (
        <input
          id={fieldId}
          type="email"
          value={(currentValue as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "user@example.com"}
          className={inputClass}
        />
      )}

      {field.type === "select" && field.options && (
        <select
          id={fieldId}
          value={(currentValue as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">Select an option...</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {field.type === "multiselect" && field.options && (
        <MultiSelectField
          options={field.options}
          value={(currentValue as string[]) || []}
          onChange={onChange}
          inputClass={inputClass}
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
      ) : field.helpText && field.type !== "boolean" ? (
        <p className="text-xs text-neutral-500">{field.helpText}</p>
      ) : null}
    </div>
  );
}

/**
 * Multi-select field component
 */
import { useState } from "react";
import type { SelectOption } from "@deeprecall/core/schemas/presets";

interface MultiSelectFieldProps {
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  inputClass: string;
}

function MultiSelectField({
  options,
  value,
  onChange,
  inputClass,
}: MultiSelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  // Get labels for selected values
  const selectedLabels = value
    .map((v) => options.find((o) => o.value === v)?.label || v)
    .filter(Boolean);

  return (
    <div className="relative">
      {/* Display selected values */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`${inputClass} flex items-center justify-between gap-2 min-h-[40px]`}
      >
        <div className="flex flex-wrap gap-1.5 flex-1">
          {selectedLabels.length > 0 ? (
            selectedLabels.map((label, index) => (
              <span
                key={index}
                className="px-2 py-0.5 text-xs bg-blue-600/20 text-blue-300 rounded border border-blue-600/30"
              >
                {label}
              </span>
            ))
          ) : (
            <span className="text-neutral-500">Select options...</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-neutral-400 flex-shrink-0 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 w-full mt-2 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-neutral-750 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={value.includes(option.value)}
                  onChange={() => handleToggle(option.value)}
                  className="w-4 h-4 bg-neutral-800 border border-neutral-700 rounded focus:ring-2 focus:ring-blue-500 text-blue-500 cursor-pointer"
                />
                <span className="text-sm text-neutral-200">{option.label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

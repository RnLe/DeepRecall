/**
 * PresetSelector Component
 * Dropdown to select a preset for creating a new entity
 */

"use client";

import { useState } from "react";
import type { Preset, PresetTarget } from "@deeprecall/core/schemas/presets";
import { getPresetColor } from "@/src/utils/presets";

interface PresetSelectorProps {
  /** Target entity type */
  targetEntity: PresetTarget;
  /** Available presets */
  presets: Preset[];
  /** Selected preset ID */
  value: string | null;
  /** Callback when preset is selected */
  onChange: (presetId: string | null) => void;
  /** Optional className for styling */
  className?: string;
}

export function PresetSelector({
  targetEntity,
  presets,
  value,
  onChange,
  className = "",
}: PresetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedPreset = presets.find((p) => p.id === value);

  // Filter presets for target entity
  const filteredPresets = presets.filter(
    (p) => p.targetEntity === targetEntity
  );

  // Group by system/user
  const systemPresets = filteredPresets.filter((p) => p.isSystem);
  const userPresets = filteredPresets.filter((p) => !p.isSystem);

  const handleSelect = (presetId: string) => {
    onChange(presetId);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-left flex items-center justify-between hover:bg-neutral-750 transition-colors"
      >
        {selectedPreset ? (
          <div className="flex items-center gap-3">
            {/* Color indicator */}
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: getPresetColor(selectedPreset.color),
              }}
            />
            {/* Preset info */}
            <div>
              <div className="font-medium text-neutral-100">
                {selectedPreset.name}
              </div>
              {selectedPreset.description && (
                <div className="text-sm text-neutral-400">
                  {selectedPreset.description}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-neutral-400">Select a template...</div>
        )}

        {/* Chevron icon */}
        <svg
          className={`w-5 h-5 text-neutral-400 transition-transform ${
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

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute z-20 w-full mt-2 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl max-h-96 overflow-y-auto">
            {/* System Presets */}
            {systemPresets.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider border-b border-neutral-700">
                  System Templates
                </div>
                <div className="py-1">
                  {systemPresets.map((preset) => (
                    <PresetOption
                      key={preset.id}
                      preset={preset}
                      isSelected={preset.id === value}
                      onClick={() => handleSelect(preset.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* User Presets */}
            {userPresets.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider border-b border-neutral-700">
                  My Templates
                </div>
                <div className="py-1">
                  {userPresets.map((preset) => (
                    <PresetOption
                      key={preset.id}
                      preset={preset}
                      isSelected={preset.id === value}
                      onClick={() => handleSelect(preset.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {filteredPresets.length === 0 && (
              <div className="px-4 py-8 text-center text-neutral-400">
                <p className="mb-2">
                  No templates available for {targetEntity}
                </p>
                <p className="text-xs text-neutral-500">
                  Create your first template in the Preset Manager
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Individual preset option in dropdown
 */
interface PresetOptionProps {
  preset: Preset;
  isSelected: boolean;
  onClick: () => void;
}

function PresetOption({ preset, isSelected, onClick }: PresetOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-neutral-750 transition-colors ${
        isSelected ? "bg-neutral-750" : ""
      }`}
    >
      {/* Color indicator */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: getPresetColor(preset.color) }}
      />

      {/* Preset info */}
      <div className="flex-1 text-left">
        <div className="font-medium text-neutral-100">{preset.name}</div>
        {preset.description && (
          <div className="text-sm text-neutral-400 line-clamp-1">
            {preset.description}
          </div>
        )}
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <svg
          className="w-5 h-5 text-green-500 flex-shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
}

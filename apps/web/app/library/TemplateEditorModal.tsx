/**
 * TemplateEditorModal Wrapper (Next.js)
 *
 * Implements TemplateEditorOperations for the Next.js platform
 */

"use client";

import { useMemo } from "react";
import {
  TemplateEditorModal as TemplateEditorModalUI,
  TemplateEditorOperations,
} from "@deeprecall/ui";
import type { Preset } from "@deeprecall/core/schemas/presets";
import { useWorks } from "@deeprecall/data/hooks/useWorks";
import { useAssets } from "@deeprecall/data/hooks/useAssets";
import { updatePreset } from "@deeprecall/data/repos/presets.electric";

interface TemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  preset: Preset;
}

export function TemplateEditorModal({
  isOpen,
  onClose,
  preset,
}: TemplateEditorModalProps) {
  // Get all works and assets from Electric
  const allWorks = useWorks();
  const allAssets = useAssets();

  // Compute usage count client-side
  const usageCount = useMemo(() => {
    const works = (allWorks.data || []).filter(
      (work) => work.presetId === preset.id
    ).length;
    const assets = (allAssets.data || []).filter(
      (asset) => asset.presetId === preset.id
    ).length;

    return {
      works,
      assets,
      total: works + assets,
    };
  }, [allWorks.data, allAssets.data, preset.id]);

  const operations: TemplateEditorOperations = {
    getPresetUsageCount: (presetId: string) => {
      // Return usage count for the current preset
      if (presetId === preset.id) {
        return usageCount;
      }
      return undefined;
    },

    onSave: async (presetId: string, updates: any) => {
      await updatePreset(presetId, updates);
    },
  };

  return (
    <TemplateEditorModalUI
      isOpen={isOpen}
      onClose={onClose}
      preset={preset as any}
      operations={operations}
    />
  );
}

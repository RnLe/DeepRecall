/**
 * WorkSelector Wrapper (Next.js)
 * Provides works data and utilities
 */

"use client";

import { WorkSelector as WorkSelectorUI } from "@deeprecall/ui/library/WorkSelector";
import type { WorkSelectorOperations } from "@deeprecall/ui/library/WorkSelector";
import { useWorksExtended } from "@/src/hooks/useLibrary";
import { getPrimaryAuthors, getDisplayYear } from "@/src/utils/library";
import { useAuthorsByIds } from "@deeprecall/data/hooks";

interface WorkSelectorProps {
  value: string | null;
  onChange: (workId: string | null) => void;
}

export function WorkSelector({ value, onChange }: WorkSelectorProps) {
  const works = useWorksExtended();

  const operations: WorkSelectorOperations = {
    useAuthorsByIds,
    getPrimaryAuthors,
    getDisplayYear,
  };

  return (
    <WorkSelectorUI
      value={value}
      onChange={onChange}
      works={works || []}
      operations={operations}
    />
  );
}

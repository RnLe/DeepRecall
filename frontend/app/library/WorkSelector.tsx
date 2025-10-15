/**
 * WorkSelector Component
 * Displays existing works in a grid for selection
 */

"use client";

import { useWorksExtended } from "@/src/hooks/useLibrary";
import type { WorkExtended } from "@/src/schema/library";
import { BookOpen, Users } from "lucide-react";
import { getPrimaryAuthors, getDisplayYear } from "@/src/utils/library";

interface WorkSelectorProps {
  value: string | null;
  onChange: (workId: string | null) => void;
}

export function WorkSelector({ value, onChange }: WorkSelectorProps) {
  const works = useWorksExtended();

  if (!works || works.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500">
        <BookOpen className="w-8 h-8 mx-auto mb-2 text-neutral-600" />
        <p className="text-sm">No works in library yet</p>
        <p className="text-xs text-neutral-600 mt-1">
          Create a new work using the templates below
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
      {works.map((work) => {
        const isSelected = value === work.id;
        const authors = getPrimaryAuthors(work, 2);
        const year = getDisplayYear(work);

        return (
          <button
            key={work.id}
            onClick={() => onChange(isSelected ? null : work.id)}
            className={`text-left p-4 rounded-lg border-2 transition-all ${
              isSelected
                ? "border-blue-500 bg-blue-900/20"
                : "border-neutral-700 bg-neutral-800/50 hover:border-neutral-600 hover:bg-neutral-800"
            }`}
          >
            <div className="flex items-start gap-3">
              <BookOpen
                className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  isSelected ? "text-blue-400" : "text-neutral-400"
                }`}
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-neutral-100 text-sm line-clamp-2 mb-1">
                  {work.title}
                </h3>
                {work.subtitle && (
                  <p className="text-xs text-neutral-500 line-clamp-1 mb-2">
                    {work.subtitle}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <Users className="w-3 h-3" />
                  <span className="truncate">{authors}</span>
                  {year && (
                    <>
                      <span>·</span>
                      <span>{year}</span>
                    </>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 bg-neutral-700/50 text-neutral-400 rounded">
                    {work.workType}
                  </span>
                  <span className="text-neutral-600">
                    {work.versions?.length || 0} version(s)
                  </span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

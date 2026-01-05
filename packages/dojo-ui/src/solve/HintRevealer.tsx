/**
 * HintRevealer - Progressive hint disclosure component
 */

"use client";

import { Lightbulb, ChevronRight } from "lucide-react";
import { MathRenderer } from "../components/MathRenderer";
import { Button } from "../components/Button";

export interface HintRevealerProps {
  /** Array of hint strings (in order) */
  hints: string[];
  /** Number of hints currently revealed */
  revealedCount: number;
  /** Callback to reveal next hint */
  onRevealNext: () => void;
  /** Whether the component is disabled */
  disabled?: boolean;
}

/**
 * Progressively reveals hints one at a time
 */
export function HintRevealer({
  hints,
  revealedCount,
  onRevealNext,
  disabled = false,
}: HintRevealerProps) {
  const hasMoreHints = revealedCount < hints.length;
  const revealedHints = hints.slice(0, revealedCount);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb size={14} className="text-blue-400" />
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Hints
          </span>
          <span className="text-xs text-gray-500">
            ({revealedCount}/{hints.length})
          </span>
        </div>
        {hasMoreHints && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRevealNext}
            disabled={disabled}
            iconRight={<ChevronRight size={14} />}
          >
            Next Hint
          </Button>
        )}
      </div>

      {/* Revealed hints */}
      {revealedHints.length > 0 && (
        <div className="space-y-2">
          {revealedHints.map((hint, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 animate-in fade-in slide-in-from-top-1 duration-200"
            >
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-medium text-blue-400">
                  {idx + 1}
                </span>
                <MathRenderer content={hint} className="text-gray-300 flex-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Placeholder for unrevealed hints */}
      {revealedCount === 0 && (
        <div className="p-3 rounded-lg border border-dashed border-gray-700 text-center">
          <p className="text-sm text-gray-500">
            {hints.length} hint{hints.length !== 1 ? "s" : ""} available
          </p>
        </div>
      )}
    </div>
  );
}

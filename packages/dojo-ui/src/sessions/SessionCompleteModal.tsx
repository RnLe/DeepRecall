/**
 * SessionCompleteModal - Modal for completing a session with reflection
 *
 * Allows user to:
 * - Add a reflection note
 * - Rate their end mood
 * - Rate session difficulty
 */

"use client";

import { useState } from "react";
import { X, Send, Smile, Meh, Frown } from "lucide-react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

export interface SessionCompleteModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Session duration in seconds */
  durationSeconds: number;
  /** Number of exercises completed */
  exercisesCompleted: number;
  /** Callback to complete with data */
  onComplete: (data: SessionCompleteData) => void;
  /** Callback to cancel */
  onCancel: () => void;
}

export interface SessionCompleteData {
  reflectionNote?: string;
  endMoodRating?: number;
  sessionDifficulty?: number;
}

/**
 * Modal for session completion
 */
export function SessionCompleteModal({
  isOpen,
  durationSeconds,
  exercisesCompleted,
  onComplete,
  onCancel,
}: SessionCompleteModalProps) {
  const [reflectionNote, setReflectionNote] = useState("");
  const [endMoodRating, setEndMoodRating] = useState<number | undefined>();
  const [sessionDifficulty, setSessionDifficulty] = useState<
    number | undefined
  >();

  if (!isOpen) return null;

  const handleComplete = () => {
    onComplete({
      reflectionNote: reflectionNote.trim() || undefined,
      endMoodRating,
      sessionDifficulty,
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <Card variant="elevated" padding="lg" className="max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-100">
            Complete Session
          </h2>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Session stats summary */}
        <div className="flex justify-center gap-8 mb-6 py-4 bg-gray-800/50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-100 tabular-nums">
              {formatTime(durationSeconds)}
            </div>
            <div className="text-xs text-gray-500">Duration</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-100">
              {exercisesCompleted}
            </div>
            <div className="text-xs text-gray-500">Exercises</div>
          </div>
        </div>

        {/* End mood rating */}
        <div className="mb-5">
          <label className="text-sm text-gray-400 mb-2 block">
            How do you feel after this session?
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                onClick={() =>
                  setEndMoodRating(
                    endMoodRating === rating ? undefined : rating
                  )
                }
                className={`flex-1 py-3 rounded-lg text-lg transition-colors ${
                  endMoodRating === rating
                    ? "bg-emerald-500/20 border border-emerald-500/30"
                    : "bg-gray-800 border border-gray-700 hover:border-gray-600"
                }`}
              >
                {rating === 1
                  ? "😫"
                  : rating === 2
                    ? "😕"
                    : rating === 3
                      ? "😐"
                      : rating === 4
                        ? "🙂"
                        : "😊"}
              </button>
            ))}
          </div>
        </div>

        {/* Session difficulty rating */}
        <div className="mb-5">
          <label className="text-sm text-gray-400 mb-2 block">
            How difficult was this session?
          </label>
          <div className="flex gap-2">
            {[
              { value: 1, label: "Easy", color: "emerald" },
              { value: 2, label: "Moderate", color: "blue" },
              { value: 3, label: "Challenging", color: "amber" },
              { value: 4, label: "Hard", color: "orange" },
              { value: 5, label: "Very Hard", color: "red" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  setSessionDifficulty(
                    sessionDifficulty === opt.value ? undefined : opt.value
                  )
                }
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                  sessionDifficulty === opt.value
                    ? `bg-${opt.color}-500/20 border border-${opt.color}-500/30 text-${opt.color}-400`
                    : "bg-gray-800 border border-gray-700 hover:border-gray-600 text-gray-400"
                }`}
                style={
                  sessionDifficulty === opt.value
                    ? {
                        backgroundColor: `rgb(var(--${opt.color}-500) / 0.2)`,
                        borderColor: `rgb(var(--${opt.color}-500) / 0.3)`,
                      }
                    : undefined
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reflection note */}
        <div className="mb-6">
          <label className="text-sm text-gray-400 mb-2 block">
            Quick reflection (optional)
          </label>
          <textarea
            value={reflectionNote}
            onChange={(e) => setReflectionNote(e.target.value)}
            placeholder="What went well? What could be improved?"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:border-gray-600"
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={handleComplete}
            iconRight={<Send size={16} />}
          >
            Complete
          </Button>
        </div>
      </Card>
    </div>
  );
}

/**
 * CreateActivityDialog Component
 * Dialog for creating a new Activity (course, project, etc.)
 */

"use client";

import { useState } from "react";
import { useCreateActivity } from "@/src/hooks/useLibrary";
import type { ActivityType } from "@deeprecall/core/schemas/library";
import { Calendar, Users, X } from "lucide-react";

interface CreateActivityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: string }[] = [
  { value: "course", label: "Course", icon: "📚" },
  { value: "workshop", label: "Workshop", icon: "🛠️" },
  { value: "project", label: "Project", icon: "🚀" },
  { value: "thesis", label: "Thesis", icon: "🎓" },
  { value: "seminar", label: "Seminar", icon: "💡" },
  { value: "reading_group", label: "Reading Group", icon: "📖" },
  { value: "conference", label: "Conference", icon: "🎤" },
];

export function CreateActivityDialog({
  isOpen,
  onClose,
  onSuccess,
}: CreateActivityDialogProps) {
  const createActivityMutation = useCreateActivity();

  const [title, setTitle] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("course");
  const [description, setDescription] = useState("");
  const [institution, setInstitution] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert("Please enter a title");
      return;
    }

    // Convert YYYY-MM-DD to ISO datetime string (YYYY-MM-DDTHH:MM:SSZ)
    const startsAtISO = startsAt ? `${startsAt}T00:00:00Z` : undefined;
    const endsAtISO = endsAt ? `${endsAt}T23:59:59Z` : undefined;

    try {
      await createActivityMutation.mutateAsync({
        kind: "activity" as const,
        title: title.trim(),
        activityType,
        description: description.trim() || undefined,
        institution: institution.trim() || undefined,
        participants: [],
        startsAt: startsAtISO,
        endsAt: endsAtISO,
      });

      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Failed to create activity:", error);
      alert(
        `Failed to create activity: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const handleClose = () => {
    setTitle("");
    setActivityType("course");
    setDescription("");
    setInstitution("");
    setStartsAt("");
    setEndsAt("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {/* Dialog - 70% of viewport */}
      <div className="bg-neutral-900 rounded-xl shadow-2xl w-[70vw] max-h-[80vh] flex flex-col border border-neutral-800">
        {/* Fixed Header */}
        <div className="shrink-0 px-8 py-6 border-b border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-neutral-100">
                Create New Activity
              </h2>
              <p className="text-sm text-neutral-400 mt-1.5">
                Create a course, project, workshop, or other learning activity
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-8 py-6 min-h-0"
        >
          <div className="space-y-6">
            {/* Basic Information Card */}
            <div className="bg-neutral-800/30 border border-neutral-700 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-amber-400"
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
                Basic Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Title */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    placeholder="e.g., Machine Learning Fundamentals, Thesis Research"
                    required
                  />
                </div>

                {/* Activity Type */}
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Type *
                  </label>
                  <select
                    value={activityType}
                    onChange={(e) =>
                      setActivityType(e.target.value as ActivityType)
                    }
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  >
                    {ACTIVITY_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Institution */}
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Institution
                  </label>
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    placeholder="e.g., Stanford University, MIT"
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                    placeholder="Describe the activity, its goals, and what it covers..."
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Time Period Card */}
            <div className="bg-neutral-800/30 border border-neutral-700 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                Time Period
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              <p className="text-xs text-neutral-500 mt-3">
                <span className="text-neutral-400">Tip:</span> Set dates to help
                organize and filter activities by time period
              </p>
            </div>
          </div>
        </form>

        {/* Fixed Footer */}
        <div className="shrink-0 px-8 py-4 border-t border-neutral-800 bg-neutral-900/50">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 bg-neutral-800 text-neutral-200 rounded-lg hover:bg-neutral-750 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={createActivityMutation.isPending}
              className="px-6 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              {createActivityMutation.isPending ? (
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
                  Creating...
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
                  Create Activity
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  AlertCircle,
  Plus,
  X,
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import {
  DOMAIN_LABELS,
  DIFFICULTY_LEVELS,
  DIFFICULTY_LABELS,
  IMPORTANCE_LEVELS,
  IMPORTANCE_LABELS,
  EXERCISE_TAGS,
  EXERCISE_TAG_LABELS,
} from "@deeprecall/dojo-core";

interface SubtaskForm {
  tempId: string;
  id?: string;
  label: string;
  prompt: string;
  hintSteps: string[];
  solutionSketch: string;
  fullSolution: string;
}

interface ExerciseForm {
  title: string;
  domainId: string;
  description: string;
  problemStatement: string;
  difficulty: string;
  importance: string;
  tags: string[];
  primaryConceptIds: string[];
  subtasks: SubtaskForm[];
  isParameterized: boolean;
  variantGenerationNote: string;
  source: string;
  authorNotes: string;
}

interface Concept {
  id: string;
  name: string;
  domainId: string;
}

interface Exercise {
  id: string;
  title: string;
  domainId: string;
  description?: string;
  problemStatement?: string;
  difficulty: string;
  importance: string;
  tags: string[];
  primaryConceptIds: string[];
  supportingConceptIds?: string[];
  subtasks: {
    id: string;
    label?: string;
    prompt: string;
    hintSteps?: string[];
    solutionSketch?: string;
    fullSolution?: string;
  }[];
  isParameterized: boolean;
  variantGenerationNote?: string;
  source?: string;
  authorNotes?: string;
  isGlobal: boolean;
}

const DOMAINS = Object.entries(DOMAIN_LABELS);

export default function EditExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [form, setForm] = useState<ExerciseForm | null>(null);
  const [allConcepts, setAllConcepts] = useState<Concept[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSubtask, setExpandedSubtask] = useState<string | null>(null);
  const [newHint, setNewHint] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/dojo/exercises/${id}`, {
        headers: { "X-Admin-Password": "deeprecall4815" },
      }).then((res) => res.json()),
      fetch("/api/admin/dojo/concepts", {
        headers: { "X-Admin-Password": "deeprecall4815" },
      }).then((res) => res.json()),
    ])
      .then(([exerciseData, conceptsData]) => {
        if (exerciseData.exercise) {
          const e = exerciseData.exercise;
          setExercise(e);
          setForm({
            title: e.title,
            domainId: e.domainId,
            description: e.description || "",
            problemStatement: e.problemStatement || "",
            difficulty: e.difficulty,
            importance: e.importance,
            tags: e.tags || [],
            primaryConceptIds: e.primaryConceptIds || [],
            subtasks: e.subtasks.map((s: Exercise["subtasks"][0]) => ({
              tempId: crypto.randomUUID(),
              id: s.id,
              label: s.label || "",
              prompt: s.prompt,
              hintSteps: s.hintSteps || [],
              solutionSketch: s.solutionSketch || "",
              fullSolution: s.fullSolution || "",
            })),
            isParameterized: e.isParameterized || false,
            variantGenerationNote: e.variantGenerationNote || "",
            source: e.source || "",
            authorNotes: e.authorNotes || "",
          });
        }
        setAllConcepts(conceptsData.concepts || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    setIsSaving(true);
    setError(null);

    try {
      const subtasks = form.subtasks
        .filter((s) => s.prompt.trim())
        .map((s, i) => ({
          id: s.id,
          label: s.label || `(${String.fromCharCode(97 + i)})`,
          prompt: s.prompt,
          hintSteps: s.hintSteps.filter((h) => h.trim()),
          solutionSketch: s.solutionSketch || undefined,
          fullSolution: s.fullSolution || undefined,
        }));

      const res = await fetch(`/api/admin/dojo/exercises/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": "deeprecall4815",
        },
        body: JSON.stringify({
          ...form,
          subtasks,
          primaryConceptIds: form.primaryConceptIds,
          description: form.description || undefined,
          problemStatement: form.problemStatement || undefined,
          variantGenerationNote: form.variantGenerationNote || undefined,
          source: form.source || undefined,
          authorNotes: form.authorNotes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update exercise");
      }

      router.push("/admin/dojo/exercises");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update exercise"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const addSubtask = () => {
    const newSubtask: SubtaskForm = {
      tempId: crypto.randomUUID(),
      label: "",
      prompt: "",
      hintSteps: [],
      solutionSketch: "",
      fullSolution: "",
    };
    setForm((f) => f && { ...f, subtasks: [...f.subtasks, newSubtask] });
    setExpandedSubtask(newSubtask.tempId);
  };

  const removeSubtask = (tempId: string) => {
    setForm(
      (f) =>
        f && {
          ...f,
          subtasks: f.subtasks.filter((s) => s.tempId !== tempId),
        }
    );
  };

  const updateSubtask = (tempId: string, updates: Partial<SubtaskForm>) => {
    setForm(
      (f) =>
        f && {
          ...f,
          subtasks: f.subtasks.map((s) =>
            s.tempId === tempId ? { ...s, ...updates } : s
          ),
        }
    );
  };

  const addHint = (tempId: string) => {
    if (!form) return;
    const hint = newHint[tempId]?.trim();
    if (hint) {
      updateSubtask(tempId, {
        hintSteps: [
          ...form.subtasks.find((s) => s.tempId === tempId)!.hintSteps,
          hint,
        ],
      });
      setNewHint((h) => ({ ...h, [tempId]: "" }));
    }
  };

  const removeHint = (tempId: string, index: number) => {
    if (!form) return;
    const subtask = form.subtasks.find((s) => s.tempId === tempId)!;
    updateSubtask(tempId, {
      hintSteps: subtask.hintSteps.filter((_, i) => i !== index),
    });
  };

  const toggleTag = (tag: string) => {
    setForm(
      (f) =>
        f && {
          ...f,
          tags: f.tags.includes(tag)
            ? f.tags.filter((t) => t !== tag)
            : [...f.tags, tag],
        }
    );
  };

  const toggleConcept = (conceptId: string) => {
    setForm(
      (f) =>
        f && {
          ...f,
          primaryConceptIds: f.primaryConceptIds.includes(conceptId)
            ? f.primaryConceptIds.filter((c) => c !== conceptId)
            : [...f.primaryConceptIds, conceptId],
        }
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 flex items-center gap-2 text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (!exercise || !form) {
    return (
      <div className="p-4">
        <div className="text-red-400">Exercise not found</div>
        <Link href="/admin/dojo/exercises" className="text-blue-400 text-sm">
          Back to exercises
        </Link>
      </div>
    );
  }

  if (!exercise.isGlobal) {
    return (
      <div className="p-4">
        <div className="text-yellow-400 mb-2">
          This is a user-owned exercise and cannot be edited via admin.
        </div>
        <Link href="/admin/dojo/exercises" className="text-blue-400 text-sm">
          Back to exercises
        </Link>
      </div>
    );
  }

  const domainConcepts = allConcepts.filter(
    (c) => c.domainId === form.domainId
  );

  return (
    <div className="p-4 max-w-3xl">
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/admin/dojo/exercises"
          className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-gray-100">Edit Exercise</h1>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-900/20 border border-red-800/50 rounded text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title & Domain */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) =>
                setForm((f) => f && { ...f, title: e.target.value })
              }
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-gray-600"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Domain *
            </label>
            <select
              value={form.domainId}
              onChange={(e) =>
                setForm(
                  (f) =>
                    f && {
                      ...f,
                      domainId: e.target.value,
                      primaryConceptIds: [],
                    }
                )
              }
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-gray-600"
            >
              {DOMAINS.map(([domainId, label]) => (
                <option key={domainId} value={domainId}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Description
          </label>
          <input
            type="text"
            value={form.description}
            onChange={(e) =>
              setForm((f) => f && { ...f, description: e.target.value })
            }
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-gray-600"
          />
        </div>

        {/* Problem Statement */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Problem Statement
          </label>
          <textarea
            value={form.problemStatement}
            onChange={(e) =>
              setForm((f) => f && { ...f, problemStatement: e.target.value })
            }
            rows={3}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 font-mono focus:outline-none focus:border-gray-600 resize-none"
          />
        </div>

        {/* Difficulty & Importance */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Difficulty *
            </label>
            <select
              value={form.difficulty}
              onChange={(e) =>
                setForm((f) => f && { ...f, difficulty: e.target.value })
              }
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-gray-600"
            >
              {DIFFICULTY_LEVELS.map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Importance *
            </label>
            <select
              value={form.importance}
              onChange={(e) =>
                setForm((f) => f && { ...f, importance: e.target.value })
              }
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-gray-600"
            >
              {IMPORTANCE_LEVELS.map((i) => (
                <option key={i} value={i}>
                  {IMPORTANCE_LABELS[i]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Tags
          </label>
          <div className="flex flex-wrap gap-1">
            {EXERCISE_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  form.tags.includes(tag)
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {EXERCISE_TAG_LABELS[tag] || tag}
              </button>
            ))}
          </div>
        </div>

        {/* Concepts */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Target Concepts
          </label>
          {domainConcepts.length === 0 ? (
            <div className="text-xs text-gray-500">
              No concepts in this domain
            </div>
          ) : (
            <div className="max-h-24 overflow-y-auto space-y-0.5 bg-gray-800/50 rounded p-2">
              {domainConcepts.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-700/50 px-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={form.primaryConceptIds.includes(c.id)}
                    onChange={() => toggleConcept(c.id)}
                    className="w-3 h-3 rounded border-gray-600 bg-gray-700 text-blue-500"
                  />
                  <span className="text-gray-200">{c.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Subtasks */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-400">
              Subtasks ({form.subtasks.length})
            </label>
            <button
              type="button"
              onClick={addSubtask}
              className="flex items-center gap-1 px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>
          <div className="space-y-2">
            {form.subtasks.map((subtask, idx) => {
              const isExpanded = expandedSubtask === subtask.tempId;
              return (
                <div
                  key={subtask.tempId}
                  className="bg-gray-800/50 border border-gray-700 rounded"
                >
                  <div
                    className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                    onClick={() =>
                      setExpandedSubtask(isExpanded ? null : subtask.tempId)
                    }
                  >
                    <GripVertical className="w-3 h-3 text-gray-600" />
                    <span className="text-xs text-gray-400 w-6">
                      {subtask.label || `(${String.fromCharCode(97 + idx)})`}
                    </span>
                    <span className="flex-1 text-xs text-gray-200 truncate">
                      {subtask.prompt || "(empty)"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSubtask(subtask.tempId);
                      }}
                      className="p-0.5 text-gray-500 hover:text-red-400"
                      disabled={form.subtasks.length === 1}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-3 h-3 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-gray-500" />
                    )}
                  </div>
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2 border-t border-gray-700">
                      <div className="grid grid-cols-6 gap-2 pt-2">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">
                            Label
                          </label>
                          <input
                            type="text"
                            value={subtask.label}
                            onChange={(e) =>
                              updateSubtask(subtask.tempId, {
                                label: e.target.value,
                              })
                            }
                            className="w-full px-1.5 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-100"
                            placeholder="(a)"
                          />
                        </div>
                        <div className="col-span-5">
                          <label className="block text-[10px] text-gray-500 mb-0.5">
                            Prompt *
                          </label>
                          <textarea
                            value={subtask.prompt}
                            onChange={(e) =>
                              updateSubtask(subtask.tempId, {
                                prompt: e.target.value,
                              })
                            }
                            rows={2}
                            className="w-full px-1.5 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-100 font-mono resize-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">
                          Hints ({subtask.hintSteps.length})
                        </label>
                        <div className="space-y-1">
                          {subtask.hintSteps.map((hint, hi) => (
                            <div key={hi} className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-600 w-4">
                                {hi + 1}.
                              </span>
                              <span className="flex-1 text-xs text-gray-300 truncate">
                                {hint}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeHint(subtask.tempId, hi)}
                                className="text-gray-500 hover:text-red-400"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-1 mt-1">
                          <input
                            type="text"
                            value={newHint[subtask.tempId] || ""}
                            onChange={(e) =>
                              setNewHint((h) => ({
                                ...h,
                                [subtask.tempId]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) =>
                              e.key === "Enter" &&
                              (e.preventDefault(), addHint(subtask.tempId))
                            }
                            className="flex-1 px-1.5 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs text-gray-100"
                            placeholder="Add hint..."
                          />
                          <button
                            type="button"
                            onClick={() => addHint(subtask.tempId)}
                            className="px-1.5 py-0.5 bg-gray-600 hover:bg-gray-500 rounded text-xs text-gray-200"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">
                            Solution Sketch
                          </label>
                          <textarea
                            value={subtask.solutionSketch}
                            onChange={(e) =>
                              updateSubtask(subtask.tempId, {
                                solutionSketch: e.target.value,
                              })
                            }
                            rows={2}
                            className="w-full px-1.5 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-100 font-mono resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">
                            Full Solution
                          </label>
                          <textarea
                            value={subtask.fullSolution}
                            onChange={(e) =>
                              updateSubtask(subtask.tempId, {
                                fullSolution: e.target.value,
                              })
                            }
                            rows={2}
                            className="w-full px-1.5 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-100 font-mono resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Advanced */}
        <details className="group">
          <summary className="text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-300">
            Advanced Options
          </summary>
          <div className="mt-2 space-y-3 pl-2 border-l border-gray-700">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Source
              </label>
              <input
                type="text"
                value={form.source}
                onChange={(e) =>
                  setForm((f) => f && { ...f, source: e.target.value })
                }
                className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Author Notes
              </label>
              <textarea
                value={form.authorNotes}
                onChange={(e) =>
                  setForm((f) => f && { ...f, authorNotes: e.target.value })
                }
                rows={2}
                className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-100 resize-none"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={form.isParameterized}
                onChange={(e) =>
                  setForm(
                    (f) => f && { ...f, isParameterized: e.target.checked }
                  )
                }
                className="w-3 h-3 rounded border-gray-600 bg-gray-700"
              />
              Parameterized
            </label>
            {form.isParameterized && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Variant Generation Note
                </label>
                <textarea
                  value={form.variantGenerationNote}
                  onChange={(e) =>
                    setForm(
                      (f) =>
                        f && { ...f, variantGenerationNote: e.target.value }
                    )
                  }
                  rows={2}
                  className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-100 resize-none"
                />
              </div>
            )}
          </div>
        </details>

        {/* Submit */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={isSaving || !form.title}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors"
          >
            <Save className="w-3 h-3" />
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
          <Link
            href="/admin/dojo/exercises"
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import {
  DOMAIN_LABELS,
  DIFFICULTY_LEVELS,
  DIFFICULTY_LABELS,
  IMPORTANCE_LEVELS,
  IMPORTANCE_LABELS,
  EXERCISE_TAGS,
  EXERCISE_TAG_LABELS,
  DISCIPLINE_IDS,
  DISCIPLINE_LABELS,
  MATH_AREAS,
  MATH_AREA_LABELS,
  PHYSICS_AREAS,
  PHYSICS_AREA_LABELS,
  CS_AREAS,
  CS_AREA_LABELS,
  EXERCISE_KINDS,
  EXERCISE_KIND_LABELS,
  type DisciplineId,
  type ExerciseKind,
} from "@deeprecall/dojo-core";

interface SubtaskForm {
  tempId: string;
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
  exerciseKind: ExerciseKind;
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

// Legacy flat domains for backwards compatibility
const LEGACY_DOMAINS = Object.entries(DOMAIN_LABELS);

// Get areas for a discipline
function getAreasForDiscipline(discipline: DisciplineId): readonly string[] {
  switch (discipline) {
    case "math":
      return MATH_AREAS;
    case "physics":
      return PHYSICS_AREAS;
    case "cs":
      return CS_AREAS;
    default:
      return [];
  }
}

function getAreaLabel(discipline: DisciplineId, area: string): string {
  switch (discipline) {
    case "math":
      return MATH_AREA_LABELS[area as keyof typeof MATH_AREA_LABELS] || area;
    case "physics":
      return (
        PHYSICS_AREA_LABELS[area as keyof typeof PHYSICS_AREA_LABELS] || area
      );
    case "cs":
      return CS_AREA_LABELS[area as keyof typeof CS_AREA_LABELS] || area;
    default:
      return area;
  }
}

const createEmptySubtask = (): SubtaskForm => ({
  tempId: crypto.randomUUID(),
  label: "",
  prompt: "",
  hintSteps: [],
  solutionSketch: "",
  fullSolution: "",
});

const initialForm: ExerciseForm = {
  title: "",
  domainId: "math.algebra",
  description: "",
  problemStatement: "",
  difficulty: "core",
  importance: "fundamental",
  exerciseKind: "calculation",
  tags: [],
  primaryConceptIds: [],
  subtasks: [createEmptySubtask()],
  isParameterized: false,
  variantGenerationNote: "",
  source: "",
  authorNotes: "",
};

export default function NewExercisePage() {
  const router = useRouter();
  const [form, setForm] = useState<ExerciseForm>(initialForm);
  const [allConcepts, setAllConcepts] = useState<Concept[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [useLegacyDomain, setUseLegacyDomain] = useState(false);

  // Parse domain ID into discipline/area/subarea
  const parsedDomain = {
    discipline: form.domainId.split(".")[0] as DisciplineId,
    area: form.domainId.split(".")[1] || "",
    subarea: form.domainId.split(".")[2] || "",
  };
  const [error, setError] = useState<string | null>(null);
  const [expandedSubtask, setExpandedSubtask] = useState<string | null>(null);
  const [newHint, setNewHint] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/admin/dojo/concepts", {
      headers: { "X-Admin-Password": "deeprecall4815" },
    })
      .then((res) => res.json())
      .then((data) => setAllConcepts(data.concepts || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      // Validate at least one subtask with prompt
      if (!form.subtasks.some((s) => s.prompt.trim())) {
        throw new Error("At least one subtask with a prompt is required");
      }

      // Transform subtasks
      const subtasks = form.subtasks
        .filter((s) => s.prompt.trim())
        .map((s, i) => ({
          label: s.label || `(${String.fromCharCode(97 + i)})`,
          prompt: s.prompt,
          hintSteps: s.hintSteps.filter((h) => h.trim()),
          solutionSketch: s.solutionSketch || undefined,
          fullSolution: s.fullSolution || undefined,
        }));

      const res = await fetch("/api/admin/dojo/exercises", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": "deeprecall4815",
        },
        body: JSON.stringify({
          ...form,
          subtasks,
          primaryConceptIds: form.primaryConceptIds,
          supportingConceptIds: undefined,
          description: form.description || undefined,
          problemStatement: form.problemStatement || undefined,
          variantGenerationNote: form.variantGenerationNote || undefined,
          source: form.source || undefined,
          authorNotes: form.authorNotes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create exercise");
      }

      router.push("/admin/dojo/exercises");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create exercise"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const addSubtask = () => {
    const newSubtask = createEmptySubtask();
    setForm((f) => ({ ...f, subtasks: [...f.subtasks, newSubtask] }));
    setExpandedSubtask(newSubtask.tempId);
  };

  const removeSubtask = (tempId: string) => {
    setForm((f) => ({
      ...f,
      subtasks: f.subtasks.filter((s) => s.tempId !== tempId),
    }));
  };

  const updateSubtask = (tempId: string, updates: Partial<SubtaskForm>) => {
    setForm((f) => ({
      ...f,
      subtasks: f.subtasks.map((s) =>
        s.tempId === tempId ? { ...s, ...updates } : s
      ),
    }));
  };

  const addHint = (tempId: string) => {
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
    const subtask = form.subtasks.find((s) => s.tempId === tempId)!;
    updateSubtask(tempId, {
      hintSteps: subtask.hintSteps.filter((_, i) => i !== index),
    });
  };

  const toggleTag = (tag: string) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag)
        ? f.tags.filter((t) => t !== tag)
        : [...f.tags, tag],
    }));
  };

  const toggleConcept = (id: string) => {
    setForm((f) => ({
      ...f,
      primaryConceptIds: f.primaryConceptIds.includes(id)
        ? f.primaryConceptIds.filter((c) => c !== id)
        : [...f.primaryConceptIds, id],
    }));
  };

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
        <h1 className="text-lg font-semibold text-gray-100">New Exercise</h1>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-900/20 border border-red-800/50 rounded text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Title *
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-gray-600"
            placeholder="e.g. Diagonalize a 2×2 Symmetric Matrix"
            required
          />
        </div>

        {/* Domain - Hierarchical Selection */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-400">
              Domain *
            </label>
            <button
              type="button"
              onClick={() => setUseLegacyDomain(!useLegacyDomain)}
              className="text-[10px] text-gray-500 hover:text-gray-400"
            >
              {useLegacyDomain ? "Use hierarchical" : "Use legacy flat"}
            </button>
          </div>

          {useLegacyDomain ? (
            <select
              value={form.domainId}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  domainId: e.target.value,
                  primaryConceptIds: [],
                }))
              }
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-gray-600"
            >
              {LEGACY_DOMAINS.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {/* Discipline */}
              <select
                value={parsedDomain.discipline}
                onChange={(e) => {
                  const newDiscipline = e.target.value as DisciplineId;
                  const areas = getAreasForDiscipline(newDiscipline);
                  const newArea = areas[0] || "misc";
                  setForm((f) => ({
                    ...f,
                    domainId: `${newDiscipline}.${newArea}`,
                    primaryConceptIds: [],
                  }));
                }}
                className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-gray-600"
              >
                {DISCIPLINE_IDS.map((d) => (
                  <option key={d} value={d}>
                    {DISCIPLINE_LABELS[d]}
                  </option>
                ))}
              </select>

              {/* Area */}
              <select
                value={parsedDomain.area}
                onChange={(e) => {
                  const newArea = e.target.value;
                  setForm((f) => ({
                    ...f,
                    domainId: parsedDomain.subarea
                      ? `${parsedDomain.discipline}.${newArea}.${parsedDomain.subarea}`
                      : `${parsedDomain.discipline}.${newArea}`,
                    primaryConceptIds: [],
                  }));
                }}
                className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-gray-600"
              >
                {getAreasForDiscipline(parsedDomain.discipline).map((area) => (
                  <option key={area} value={area}>
                    {getAreaLabel(parsedDomain.discipline, area)}
                  </option>
                ))}
                {getAreasForDiscipline(parsedDomain.discipline).length ===
                  0 && <option value="misc">Misc</option>}
              </select>

              {/* Subarea (optional) */}
              <input
                type="text"
                value={parsedDomain.subarea}
                onChange={(e) => {
                  const subarea = e.target.value
                    .toLowerCase()
                    .replace(/\s+/g, "-");
                  setForm((f) => ({
                    ...f,
                    domainId: subarea
                      ? `${parsedDomain.discipline}.${parsedDomain.area}.${subarea}`
                      : `${parsedDomain.discipline}.${parsedDomain.area}`,
                  }));
                }}
                className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-gray-600"
                placeholder="Subarea (optional)"
              />
            </div>
          )}
          <div className="mt-1 text-[10px] text-gray-500">
            Domain ID: <code className="text-gray-400">{form.domainId}</code>
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
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-gray-600"
            placeholder="Short description of the exercise"
          />
        </div>

        {/* Problem Statement */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Problem Statement (LaTeX/Markdown)
          </label>
          <textarea
            value={form.problemStatement}
            onChange={(e) =>
              setForm((f) => ({ ...f, problemStatement: e.target.value }))
            }
            rows={3}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 font-mono focus:outline-none focus:border-gray-600 resize-none"
            placeholder="Let $A = \begin{pmatrix} 1 & 2 \\ 2 & 4 \end{pmatrix}$..."
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
                setForm((f) => ({ ...f, difficulty: e.target.value }))
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
                setForm((f) => ({ ...f, importance: e.target.value }))
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

        {/* Exercise Kind */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Exercise Kind *
          </label>
          <select
            value={form.exerciseKind}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                exerciseKind: e.target.value as ExerciseKind,
              }))
            }
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-gray-600"
          >
            {EXERCISE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {EXERCISE_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
          <div className="mt-1 text-[10px] text-gray-500">
            {form.exerciseKind === "calculation" &&
              "Compute something concrete (e.g., find eigenvalues)"}
            {form.exerciseKind === "concept-check" &&
              "Short conceptual questions, definitions"}
            {form.exerciseKind === "proof-construction" &&
              "Write a proof from scratch"}
            {form.exerciseKind === "fill-in-proof" &&
              "Complete a guided proof with gaps"}
            {form.exerciseKind === "multiple-choice" && "Select from options"}
            {form.exerciseKind === "true-false" &&
              "True/false with justification"}
            {form.exerciseKind === "error-analysis" &&
              "Find and fix errors in given work"}
            {form.exerciseKind === "derivation" && "Derive a formula or result"}
            {form.exerciseKind === "application" &&
              "Apply concepts to real-world problem"}
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
            Target Concepts ({domainConcepts.length} in domain)
          </label>
          {domainConcepts.length === 0 ? (
            <div className="text-xs text-gray-500">
              No concepts in this domain yet.{" "}
              <Link href="/admin/dojo/concepts/new" className="text-blue-400">
                Create one
              </Link>
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
                            placeholder="Find the eigenvalues of $A$..."
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
                            placeholder="Brief outline..."
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
                            placeholder="Complete worked solution..."
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
                  setForm((f) => ({ ...f, source: e.target.value }))
                }
                className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-100"
                placeholder="e.g. Textbook Ch. 3, Problem 5"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Author Notes
              </label>
              <textarea
                value={form.authorNotes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, authorNotes: e.target.value }))
                }
                rows={2}
                className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-100 resize-none"
                placeholder="Internal notes (not shown to learners)"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={form.isParameterized}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isParameterized: e.target.checked }))
                }
                className="w-3 h-3 rounded border-gray-600 bg-gray-700"
              />
              Parameterized (supports variants)
            </label>
            {form.isParameterized && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Variant Generation Note
                </label>
                <textarea
                  value={form.variantGenerationNote}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      variantGenerationNote: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-100 resize-none"
                  placeholder="How to generate variants..."
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
            {isSaving ? "Saving..." : "Create Exercise"}
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

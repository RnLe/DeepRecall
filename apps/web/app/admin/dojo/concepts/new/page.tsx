"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, AlertCircle, Plus, X } from "lucide-react";
import {
  DOMAIN_LABELS,
  DIFFICULTY_LEVELS,
  DIFFICULTY_LABELS,
  IMPORTANCE_LEVELS,
  IMPORTANCE_LABELS,
  DISCIPLINE_IDS,
  DISCIPLINE_LABELS,
  MATH_AREAS,
  MATH_AREA_LABELS,
  PHYSICS_AREAS,
  PHYSICS_AREA_LABELS,
  CS_AREAS,
  CS_AREA_LABELS,
  CONCEPT_KINDS,
  CONCEPT_KIND_LABELS,
  type DisciplineId,
  type ConceptKind,
} from "@deeprecall/dojo-core";

interface ConceptForm {
  name: string;
  slug: string;
  domainId: string;
  description: string;
  difficulty: string;
  importance: string;
  conceptKind: ConceptKind;
  prerequisiteIds: string[];
  tagIds: string[];
}

interface Concept {
  id: string;
  name: string;
  domainId: string;
  slug: string;
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

const initialForm: ConceptForm = {
  name: "",
  slug: "",
  domainId: "math.algebra",
  description: "",
  difficulty: "core",
  importance: "fundamental",
  conceptKind: "object",
  prerequisiteIds: [],
  tagIds: [],
};

export default function NewConceptPage() {
  const router = useRouter();
  const [form, setForm] = useState<ConceptForm>(initialForm);
  const [allConcepts, setAllConcepts] = useState<Concept[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTag, setNewTag] = useState("");
  const [useLegacyDomain, setUseLegacyDomain] = useState(false);

  // Parse domain ID into discipline/area/subarea
  const parsedDomain = {
    discipline: form.domainId.split(".")[0] as DisciplineId,
    area: form.domainId.split(".")[1] || "",
    subarea: form.domainId.split(".")[2] || "",
  };

  // Fetch all concepts for prerequisites
  useEffect(() => {
    fetch("/api/admin/dojo/concepts", {
      headers: { "X-Admin-Password": "deeprecall4815" },
    })
      .then((res) => res.json())
      .then((data) => setAllConcepts(data.concepts || []))
      .catch(() => {});
  }, []);

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setForm((f) => ({
      ...f,
      name,
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-"),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/dojo/concepts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": "deeprecall4815",
        },
        body: JSON.stringify({
          ...form,
          tagIds: form.tagIds.length > 0 ? form.tagIds : undefined,
          prerequisiteIds:
            form.prerequisiteIds.length > 0 ? form.prerequisiteIds : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create concept");
      }

      router.push("/admin/dojo/concepts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create concept");
    } finally {
      setIsSaving(false);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !form.tagIds.includes(newTag.trim())) {
      setForm((f) => ({ ...f, tagIds: [...f.tagIds, newTag.trim()] }));
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setForm((f) => ({ ...f, tagIds: f.tagIds.filter((t) => t !== tag) }));
  };

  const togglePrerequisite = (id: string) => {
    setForm((f) => ({
      ...f,
      prerequisiteIds: f.prerequisiteIds.includes(id)
        ? f.prerequisiteIds.filter((p) => p !== id)
        : [...f.prerequisiteIds, id],
    }));
  };

  // Filter concepts by same domain for prerequisites
  const domainConcepts = allConcepts.filter(
    (c) => c.domainId === form.domainId
  );

  return (
    <div className="p-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/admin/dojo/concepts"
          className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-gray-100">New Concept</h1>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-900/20 border border-red-800/50 rounded text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name & Slug */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-gray-600"
              placeholder="e.g. Matrix Multiplication"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Slug
            </label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-gray-600"
              placeholder="auto-generated"
            />
          </div>
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
                  prerequisiteIds: [],
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
                    prerequisiteIds: [],
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
                    prerequisiteIds: [],
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

        {/* Concept Kind */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Concept Kind *
          </label>
          <select
            value={form.conceptKind}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                conceptKind: e.target.value as ConceptKind,
              }))
            }
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-gray-600"
          >
            {CONCEPT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {CONCEPT_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
          <div className="mt-1 text-[10px] text-gray-500">
            {form.conceptKind === "object" &&
              "A mathematical/physical object (e.g., symmetric matrix, Hilbert space)"}
            {form.conceptKind === "definition" && "A formal definition"}
            {form.conceptKind === "property" &&
              "A property of objects (e.g., symmetric matrices are diagonalizable)"}
            {form.conceptKind === "theorem" && "A major theorem"}
            {form.conceptKind === "lemma" && "A supporting lemma"}
            {form.conceptKind === "corollary" && "A consequence of a theorem"}
            {form.conceptKind === "axiom" && "A foundational axiom"}
            {form.conceptKind === "technique" &&
              "A method or technique (e.g., Gaussian elimination)"}
            {form.conceptKind === "heuristic" &&
              "A rule of thumb or problem-solving strategy"}
            {form.conceptKind === "example" && "A canonical example"}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            rows={3}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-gray-600 resize-none"
            placeholder="Optional description (Markdown/LaTeX supported)"
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

        {/* Tags */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Tags
          </label>
          <div className="flex flex-wrap gap-1 mb-2">
            {form.tagIds.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-700 rounded text-xs text-gray-200"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), addTag())
              }
              className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-100 focus:outline-none focus:border-gray-600"
              placeholder="Add tag..."
            />
            <button
              type="button"
              onClick={addTag}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Prerequisites */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Prerequisites (same domain)
          </label>
          {domainConcepts.length === 0 ? (
            <div className="text-xs text-gray-500">
              No other concepts in this domain yet
            </div>
          ) : (
            <div className="max-h-32 overflow-y-auto space-y-1 bg-gray-800/50 rounded p-2">
              {domainConcepts.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-700/50 px-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={form.prerequisiteIds.includes(c.id)}
                    onChange={() => togglePrerequisite(c.id)}
                    className="w-3 h-3 rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500/20"
                  />
                  <span className="text-gray-200">{c.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={isSaving || !form.name}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white text-xs font-medium rounded transition-colors"
          >
            <Save className="w-3 h-3" />
            {isSaving ? "Saving..." : "Create Concept"}
          </button>
          <Link
            href="/admin/dojo/concepts"
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

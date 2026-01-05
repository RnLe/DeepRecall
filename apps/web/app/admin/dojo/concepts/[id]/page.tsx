"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, AlertCircle, Plus, X, Loader2 } from "lucide-react";
import {
  DOMAIN_LABELS,
  DIFFICULTY_LEVELS,
  DIFFICULTY_LABELS,
  IMPORTANCE_LEVELS,
  IMPORTANCE_LABELS,
} from "@deeprecall/dojo-core";

interface ConceptForm {
  name: string;
  slug: string;
  domainId: string;
  description: string;
  difficulty: string;
  importance: string;
  prerequisiteIds: string[];
  tagIds: string[];
}

interface Concept {
  id: string;
  name: string;
  domainId: string;
  slug: string;
  description?: string;
  difficulty: string;
  importance: string;
  prerequisiteIds: string[];
  tagIds?: string[];
  isGlobal: boolean;
}

const DOMAINS = Object.entries(DOMAIN_LABELS);

export default function EditConceptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [concept, setConcept] = useState<Concept | null>(null);
  const [form, setForm] = useState<ConceptForm | null>(null);
  const [allConcepts, setAllConcepts] = useState<Concept[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTag, setNewTag] = useState("");

  // Fetch concept
  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/dojo/concepts/${id}`, {
        headers: { "X-Admin-Password": "deeprecall4815" },
      }).then((res) => res.json()),
      fetch("/api/admin/dojo/concepts", {
        headers: { "X-Admin-Password": "deeprecall4815" },
      }).then((res) => res.json()),
    ])
      .then(([conceptData, allData]) => {
        if (conceptData.concept) {
          const c = conceptData.concept;
          setConcept(c);
          setForm({
            name: c.name,
            slug: c.slug,
            domainId: c.domainId,
            description: c.description || "",
            difficulty: c.difficulty,
            importance: c.importance,
            prerequisiteIds: c.prerequisiteIds || [],
            tagIds: c.tagIds || [],
          });
        }
        setAllConcepts(allData.concepts || []);
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
      const res = await fetch(`/api/admin/dojo/concepts/${id}`, {
        method: "PUT",
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
        throw new Error(data.error || "Failed to update concept");
      }

      router.push("/admin/dojo/concepts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update concept");
    } finally {
      setIsSaving(false);
    }
  };

  const addTag = () => {
    if (form && newTag.trim() && !form.tagIds.includes(newTag.trim())) {
      setForm((f) => f && { ...f, tagIds: [...f.tagIds, newTag.trim()] });
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setForm((f) => f && { ...f, tagIds: f.tagIds.filter((t) => t !== tag) });
  };

  const togglePrerequisite = (prereqId: string) => {
    setForm(
      (f) =>
        f && {
          ...f,
          prerequisiteIds: f.prerequisiteIds.includes(prereqId)
            ? f.prerequisiteIds.filter((p) => p !== prereqId)
            : [...f.prerequisiteIds, prereqId],
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

  if (!concept || !form) {
    return (
      <div className="p-4">
        <div className="text-red-400">Concept not found</div>
        <Link href="/admin/dojo/concepts" className="text-blue-400 text-sm">
          Back to concepts
        </Link>
      </div>
    );
  }

  if (!concept.isGlobal) {
    return (
      <div className="p-4">
        <div className="text-yellow-400 mb-2">
          This is a user-owned concept and cannot be edited via admin.
        </div>
        <Link href="/admin/dojo/concepts" className="text-blue-400 text-sm">
          Back to concepts
        </Link>
      </div>
    );
  }

  // Filter concepts by same domain for prerequisites (excluding self)
  const domainConcepts = allConcepts.filter(
    (c) => c.domainId === form.domainId && c.id !== id
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
        <h1 className="text-lg font-semibold text-gray-100">Edit Concept</h1>
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
              onChange={(e) =>
                setForm((f) => f && { ...f, name: e.target.value })
              }
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-gray-600"
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
              onChange={(e) =>
                setForm((f) => f && { ...f, slug: e.target.value })
              }
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-gray-600"
            />
          </div>
        </div>

        {/* Domain */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Domain *
          </label>
          <select
            value={form.domainId}
            onChange={(e) =>
              setForm(
                (f) =>
                  f && { ...f, domainId: e.target.value, prerequisiteIds: [] }
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

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) =>
              setForm((f) => f && { ...f, description: e.target.value })
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
              No other concepts in this domain
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
            {isSaving ? "Saving..." : "Save Changes"}
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

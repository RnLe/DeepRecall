"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  RefreshCw,
  AlertCircle,
  Pencil,
  Trash2,
  ChevronDown,
  Search,
  X,
  ArrowUpDown,
  ListTree,
} from "lucide-react";
import {
  DOMAIN_LABELS,
  DIFFICULTY_LABELS,
  IMPORTANCE_LABELS,
} from "@deeprecall/dojo-core";

interface Subtask {
  id: string;
  label?: string;
  prompt: string;
}

interface Exercise {
  id: string;
  domainId: string;
  title: string;
  description?: string;
  problemStatement?: string;
  subtasks: Subtask[];
  primaryConceptIds: string[];
  supportingConceptIds?: string[];
  difficulty: string;
  importance: string;
  tags: string[];
  isGlobal: boolean;
  createdAt: string;
}

export default function ExercisesAdminPage() {
  const searchParams = useSearchParams();
  const domainFilter = searchParams.get("domain");
  const conceptFilter = searchParams.get("concept");

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string>(
    domainFilter || ""
  );
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [sortField, setSortField] = useState<
    "title" | "domain" | "difficulty" | "subtasks"
  >("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const fetchExercises = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedDomain) params.set("domainId", selectedDomain);
      if (conceptFilter) params.set("conceptId", conceptFilter);

      const res = await fetch(`/api/admin/dojo/exercises?${params}`, {
        headers: { "X-Admin-Password": "deeprecall4815" },
      });
      if (!res.ok) throw new Error("Failed to fetch exercises");
      const data = await res.json();
      setExercises(data.exercises);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDomain, conceptFilter]);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/dojo/exercises/${id}`, {
        method: "DELETE",
        headers: { "X-Admin-Password": "deeprecall4815" },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      setExercises((prev) => prev.filter((e) => e.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete exercise"
      );
    }
  };

  const domains = Array.from(new Set(exercises.map((e) => e.domainId))).sort();

  const filteredExercises = exercises
    .filter((e) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.problemStatement?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "domain":
          cmp = a.domainId.localeCompare(b.domainId);
          break;
        case "difficulty":
          const diffOrder = { intro: 0, core: 1, advanced: 2 };
          cmp =
            (diffOrder[a.difficulty as keyof typeof diffOrder] || 0) -
            (diffOrder[b.difficulty as keyof typeof diffOrder] || 0);
          break;
        case "subtasks":
          cmp = a.subtasks.length - b.subtasks.length;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold text-gray-100">Exercises</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchExercises}
            disabled={isLoading}
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
          <Link
            href="/admin/dojo/exercises/new"
            className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors"
          >
            <Plus className="w-3 h-3" />
            New
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-900/20 border border-red-800/50 rounded text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="w-3 h-3" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
          <input
            type="text"
            placeholder="Search exercises..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gray-600"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="relative">
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="appearance-none pl-2 pr-6 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-100 focus:outline-none focus:border-gray-600 cursor-pointer"
          >
            <option value="">All domains</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {DOMAIN_LABELS[d] || d}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
        </div>
        <div className="text-xs text-gray-500">
          {filteredExercises.length} of {exercises.length} exercises
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        {isLoading && exercises.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            Loading...
          </div>
        ) : filteredExercises.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            {searchQuery || selectedDomain
              ? "No matching exercises"
              : "No exercises yet"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-800 bg-gray-900/50">
                  <th className="px-2 py-1.5 font-medium">
                    <button
                      onClick={() => toggleSort("title")}
                      className="flex items-center gap-1 hover:text-gray-300"
                    >
                      Title
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-2 py-1.5 font-medium">
                    <button
                      onClick={() => toggleSort("domain")}
                      className="flex items-center gap-1 hover:text-gray-300"
                    >
                      Domain
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-2 py-1.5 font-medium">
                    <button
                      onClick={() => toggleSort("difficulty")}
                      className="flex items-center gap-1 hover:text-gray-300"
                    >
                      Difficulty
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-2 py-1.5 font-medium">
                    <button
                      onClick={() => toggleSort("subtasks")}
                      className="flex items-center gap-1 hover:text-gray-300"
                    >
                      <ListTree className="w-3 h-3" />
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-2 py-1.5 font-medium">Tags</th>
                  <th className="px-2 py-1.5 font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredExercises.map((exercise) => (
                  <tr
                    key={exercise.id}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30"
                  >
                    <td className="px-2 py-1.5">
                      <div
                        className="font-medium text-gray-200 truncate max-w-[250px]"
                        title={exercise.title}
                      >
                        {exercise.title}
                      </div>
                      {exercise.description && (
                        <div
                          className="text-gray-500 truncate max-w-[250px]"
                          title={exercise.description}
                        >
                          {exercise.description.slice(0, 60)}...
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-300">
                        {DOMAIN_LABELS[exercise.domainId] || exercise.domainId}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          exercise.difficulty === "intro"
                            ? "bg-green-900/50 text-green-300"
                            : exercise.difficulty === "core"
                              ? "bg-yellow-900/50 text-yellow-300"
                              : "bg-red-900/50 text-red-300"
                        }`}
                      >
                        {DIFFICULTY_LABELS[
                          exercise.difficulty as keyof typeof DIFFICULTY_LABELS
                        ] || exercise.difficulty}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-gray-300">
                      {exercise.subtasks.length}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap gap-0.5 max-w-[150px]">
                        {exercise.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-1 py-0.5 bg-gray-700/50 rounded text-[10px] text-gray-400"
                          >
                            {tag}
                          </span>
                        ))}
                        {exercise.tags.length > 3 && (
                          <span className="text-gray-500 text-[10px]">
                            +{exercise.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/dojo/exercises/${exercise.id}`}
                          className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded"
                          title="Edit"
                        >
                          <Pencil className="w-3 h-3" />
                        </Link>
                        {deleteConfirm === exercise.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(exercise.id)}
                              className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[10px] rounded"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-[10px] rounded"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(exercise.id)}
                            className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
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
} from "lucide-react";
import {
  DOMAIN_LABELS,
  DIFFICULTY_LABELS,
  IMPORTANCE_LABELS,
} from "@deeprecall/dojo-core";

interface Concept {
  id: string;
  domainId: string;
  name: string;
  slug: string;
  description?: string;
  difficulty: string;
  importance: string;
  prerequisiteIds: string[];
  tagIds?: string[];
  isGlobal: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ConceptsAdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const domainFilter = searchParams.get("domain");

  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string>(
    domainFilter || ""
  );
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [sortField, setSortField] = useState<
    "name" | "domain" | "difficulty" | "created"
  >("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const fetchConcepts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedDomain) {
        params.set("domainId", selectedDomain);
      }
      const res = await fetch(`/api/admin/dojo/concepts?${params}`, {
        headers: {
          "X-Admin-Password": "deeprecall4815",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch concepts");
      const data = await res.json();
      setConcepts(data.concepts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDomain]);

  useEffect(() => {
    fetchConcepts();
  }, [fetchConcepts]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/dojo/concepts/${id}`, {
        method: "DELETE",
        headers: {
          "X-Admin-Password": "deeprecall4815",
        },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      setConcepts((prev) => prev.filter((c) => c.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete concept");
    }
  };

  // Get unique domains from concepts
  const domains = Array.from(new Set(concepts.map((c) => c.domainId))).sort();

  // Filter and sort concepts
  const filteredConcepts = concepts
    .filter((c) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
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
        case "created":
          cmp =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
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
        <h1 className="text-lg font-semibold text-gray-100">Concepts</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchConcepts}
            disabled={isLoading}
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
          <Link
            href="/admin/dojo/concepts/new"
            className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded transition-colors"
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
            placeholder="Search concepts..."
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
          {filteredConcepts.length} of {concepts.length} concepts
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        {isLoading && concepts.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            Loading...
          </div>
        ) : filteredConcepts.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            {searchQuery || selectedDomain
              ? "No matching concepts"
              : "No concepts yet"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-800 bg-gray-900/50">
                  <th className="px-2 py-1.5 font-medium">
                    <button
                      onClick={() => toggleSort("name")}
                      className="flex items-center gap-1 hover:text-gray-300"
                    >
                      Name
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
                  <th className="px-2 py-1.5 font-medium">Importance</th>
                  <th className="px-2 py-1.5 font-medium">Prerequisites</th>
                  <th className="px-2 py-1.5 font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredConcepts.map((concept) => (
                  <tr
                    key={concept.id}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30"
                  >
                    <td className="px-2 py-1.5">
                      <div
                        className="font-medium text-gray-200 truncate max-w-[200px]"
                        title={concept.name}
                      >
                        {concept.name}
                      </div>
                      <div
                        className="text-gray-500 truncate max-w-[200px]"
                        title={concept.slug}
                      >
                        {concept.slug}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-300">
                        {DOMAIN_LABELS[concept.domainId] || concept.domainId}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          concept.difficulty === "intro"
                            ? "bg-green-900/50 text-green-300"
                            : concept.difficulty === "core"
                              ? "bg-yellow-900/50 text-yellow-300"
                              : "bg-red-900/50 text-red-300"
                        }`}
                      >
                        {DIFFICULTY_LABELS[
                          concept.difficulty as keyof typeof DIFFICULTY_LABELS
                        ] || concept.difficulty}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          concept.importance === "fundamental"
                            ? "bg-purple-900/50 text-purple-300"
                            : concept.importance === "supporting"
                              ? "bg-blue-900/50 text-blue-300"
                              : "bg-gray-800 text-gray-400"
                        }`}
                      >
                        {IMPORTANCE_LABELS[
                          concept.importance as keyof typeof IMPORTANCE_LABELS
                        ] || concept.importance}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-gray-400">
                      {concept.prerequisiteIds.length || "-"}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/dojo/concepts/${concept.id}`}
                          className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded"
                          title="Edit"
                        >
                          <Pencil className="w-3 h-3" />
                        </Link>
                        {deleteConfirm === concept.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(concept.id)}
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
                            onClick={() => setDeleteConfirm(concept.id)}
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

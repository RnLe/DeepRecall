"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  FileText,
  TrendingUp,
  Clock,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface DomainOverview {
  domainId: string;
  domainLabel: string;
  conceptCount: number;
  exerciseCount: number;
}

interface OverviewStats {
  totalConcepts: number;
  totalExercises: number;
  domains: DomainOverview[];
  recentActivity: {
    conceptsLast7Days: number;
    exercisesLast7Days: number;
  };
}

export default function DojoAdminPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/dojo/overview", {
        headers: {
          "X-Admin-Password": "deeprecall4815",
        },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch stats");
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-100">Overview</h1>
        <button
          onClick={fetchStats}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-800/50 rounded text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {isLoading && !stats ? (
        <div className="text-gray-500 text-sm">Loading stats...</div>
      ) : stats ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <BookOpen className="w-4 h-4" />
                <span className="text-xs">Concepts</span>
              </div>
              <div className="text-2xl font-bold text-gray-100">
                {stats.totalConcepts}
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <FileText className="w-4 h-4" />
                <span className="text-xs">Exercises</span>
              </div>
              <div className="text-2xl font-bold text-gray-100">
                {stats.totalExercises}
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs">Domains</span>
              </div>
              <div className="text-2xl font-bold text-gray-100">
                {stats.domains.length}
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs">Last 7 days</span>
              </div>
              <div className="text-lg font-bold text-gray-100">
                <span className="text-emerald-400">
                  +{stats.recentActivity.conceptsLast7Days}
                </span>
                {" / "}
                <span className="text-blue-400">
                  +{stats.recentActivity.exercisesLast7Days}
                </span>
              </div>
              <div className="text-[10px] text-gray-500">
                concepts / exercises
              </div>
            </div>
          </div>

          {/* Domains table */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-800">
              <h2 className="text-sm font-medium text-gray-200">Domains</h2>
            </div>
            {stats.domains.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No domains yet. Create your first concept to get started.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-800">
                    <th className="px-3 py-2 font-medium">Domain</th>
                    <th className="px-3 py-2 font-medium text-right">
                      Concepts
                    </th>
                    <th className="px-3 py-2 font-medium text-right">
                      Exercises
                    </th>
                    <th className="px-3 py-2 font-medium text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.domains.map((domain) => (
                    <tr
                      key={domain.domainId}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-200">
                          {domain.domainLabel}
                        </div>
                        <div className="text-gray-500">{domain.domainId}</div>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300">
                        {domain.conceptCount}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300">
                        {domain.exerciseCount}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/admin/dojo/concepts?domain=${domain.domainId}`}
                          className="text-blue-400 hover:text-blue-300 mr-2"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Quick actions */}
          <div className="mt-4 flex gap-2">
            <Link
              href="/admin/dojo/concepts/new"
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded transition-colors"
            >
              + New Concept
            </Link>
            <Link
              href="/admin/dojo/exercises/new"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors"
            >
              + New Exercise
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

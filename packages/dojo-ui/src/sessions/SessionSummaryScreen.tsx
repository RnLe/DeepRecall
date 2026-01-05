/**
 * SessionSummaryScreen - Post-session summary and statistics
 *
 * Displays:
 * - Session duration and exercise count
 * - Accuracy breakdown
 * - Concepts covered
 * - Successes and struggles
 * - Option to view details or return to dashboard
 */

"use client";

import { useMemo } from "react";
import {
  Clock,
  Target,
  TrendingUp,
  TrendingDown,
  Trophy,
  Flame,
  Zap,
  CheckCircle,
  XCircle,
  ArrowRight,
  RotateCcw,
  BookOpen,
} from "lucide-react";
import type {
  SessionSummary,
  ConceptNode,
  ExerciseTemplate,
  AttemptMode,
} from "@deeprecall/dojo-core";
import { formatDuration, DOMAIN_LABELS } from "@deeprecall/dojo-core";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { ProgressRing } from "../components/ProgressRing";

export interface SessionSummaryScreenProps {
  /** Session summary data */
  summary: SessionSummary;
  /** All concepts (for displaying names) */
  concepts: ConceptNode[];
  /** All exercises (for displaying titles) */
  exercises: ExerciseTemplate[];
  /** Callback to start another session */
  onStartNew?: () => void;
  /** Callback to start cram on struggles */
  onCramStruggles?: () => void;
  /** Callback to return to dashboard */
  onDashboard: () => void;
  /** Callback to view detailed stats */
  onViewDetails?: () => void;
}

const modeLabels: Record<AttemptMode, string> = {
  normal: "Practice Session",
  cram: "Cram Session",
  "exam-sim": "Exam Simulation",
};

const modeIcons: Record<AttemptMode, typeof Trophy> = {
  normal: BookOpen,
  cram: Zap,
  "exam-sim": Target,
};

/**
 * Session summary screen component
 */
export function SessionSummaryScreen({
  summary,
  concepts,
  exercises,
  onStartNew,
  onCramStruggles,
  onDashboard,
  onViewDetails,
}: SessionSummaryScreenProps) {
  const { session } = summary;
  const ModeIcon = modeIcons[session.mode];

  // Compute accuracy percentage
  const accuracyPercent = Math.round(summary.averageAccuracy * 100);
  const isGoodResult = accuracyPercent >= 70;
  const isPerfect = accuracyPercent === 100;

  // Get concept names
  const conceptsMap = useMemo(() => {
    const map = new Map<string, ConceptNode>();
    for (const c of concepts) {
      map.set(c.id, c);
    }
    return map;
  }, [concepts]);

  // Get exercise titles
  const exercisesMap = useMemo(() => {
    const map = new Map<string, ExerciseTemplate>();
    for (const e of exercises) {
      map.set(e.id, e);
    }
    return map;
  }, [exercises]);

  // Group concepts by domain
  const conceptsByDomain = useMemo(() => {
    const grouped = new Map<string, ConceptNode[]>();
    for (const cid of summary.conceptsCovered) {
      const concept = conceptsMap.get(cid);
      if (concept) {
        const list = grouped.get(concept.domainId) || [];
        list.push(concept);
        grouped.set(concept.domainId, list);
      }
    }
    return grouped;
  }, [summary.conceptsCovered, conceptsMap]);

  // Determine header style based on result
  const headerStyle = isPerfect
    ? "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30"
    : isGoodResult
      ? "from-blue-500/20 to-blue-600/10 border-blue-500/30"
      : "from-amber-500/20 to-amber-600/10 border-amber-500/30";

  const resultMessage = isPerfect
    ? "Perfect session!"
    : isGoodResult
      ? "Great work!"
      : "Keep practicing!";

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header with result banner */}
      <header className={`bg-gradient-to-b ${headerStyle} border-b`}>
        <div className="max-w-3xl mx-auto px-4 py-8 text-center">
          {/* Result icon */}
          <div className="mb-4">
            {isPerfect ? (
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20">
                <Trophy className="w-10 h-10 text-emerald-400" />
              </div>
            ) : isGoodResult ? (
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-500/20">
                <CheckCircle className="w-10 h-10 text-blue-400" />
              </div>
            ) : (
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/20">
                <Flame className="w-10 h-10 text-amber-400" />
              </div>
            )}
          </div>

          {/* Result message */}
          <h1 className="text-2xl font-bold text-gray-100 mb-2">
            {resultMessage}
          </h1>

          {/* Session type badge */}
          <Badge
            variant={
              session.mode === "cram"
                ? "warning"
                : session.mode === "exam-sim"
                  ? "primary"
                  : "default"
            }
            size="sm"
          >
            <ModeIcon size={14} className="mr-1" />
            {modeLabels[session.mode]}
          </Badge>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {/* Key stats grid */}
          <div className="grid grid-cols-3 gap-4">
            {/* Time */}
            <Card variant="default" padding="md" className="text-center">
              <Clock size={24} className="mx-auto mb-2 text-gray-400" />
              <div className="text-2xl font-bold text-gray-100 tabular-nums">
                {formatDuration(summary.totalActiveSeconds)}
              </div>
              <div className="text-sm text-gray-500">Time</div>
            </Card>

            {/* Accuracy */}
            <Card variant="default" padding="md" className="text-center">
              <ProgressRing
                value={accuracyPercent}
                size={48}
                showValue
                className="mx-auto mb-2"
              />
              <div className="text-sm text-gray-500">Accuracy</div>
            </Card>

            {/* Exercises */}
            <Card variant="default" padding="md" className="text-center">
              <Target size={24} className="mx-auto mb-2 text-gray-400" />
              <div className="text-2xl font-bold text-gray-100">
                {summary.totalAttempts}
              </div>
              <div className="text-sm text-gray-500">Exercises</div>
            </Card>
          </div>

          {/* Accuracy breakdown */}
          <Card variant="default" padding="md">
            <h3 className="font-medium text-gray-200 mb-4">
              Results Breakdown
            </h3>
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle size={18} />
                  <span className="text-2xl font-bold">
                    {summary.correctAttempts}
                  </span>
                </div>
                <div className="text-sm text-gray-500">correct</div>
              </div>
              <div className="h-12 w-px bg-gray-700" />
              <div className="text-center">
                <div className="flex items-center gap-2 text-amber-400">
                  <XCircle size={18} />
                  <span className="text-2xl font-bold">
                    {summary.totalAttempts - summary.correctAttempts}
                  </span>
                </div>
                <div className="text-sm text-gray-500">needs work</div>
              </div>
            </div>
          </Card>

          {/* Concepts covered */}
          {summary.conceptsCovered.length > 0 && (
            <Card variant="default" padding="md">
              <h3 className="font-medium text-gray-200 mb-4">
                Concepts Covered
              </h3>
              <div className="space-y-4">
                {Array.from(conceptsByDomain.entries()).map(
                  ([domainId, domainConcepts]) => (
                    <div key={domainId}>
                      <div className="text-xs text-gray-500 mb-2">
                        {DOMAIN_LABELS[domainId] || domainId}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {domainConcepts.map((concept) => (
                          <Badge key={concept.id} variant="default" size="sm">
                            {concept.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </Card>
          )}

          {/* Successes & Struggles */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Successes */}
            {summary.successes.length > 0 && (
              <Card variant="default" padding="md">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={18} className="text-emerald-400" />
                  <h3 className="font-medium text-gray-200">Successes</h3>
                </div>
                <div className="space-y-2">
                  {summary.successes.slice(0, 5).map((templateId) => {
                    const exercise = exercisesMap.get(templateId);
                    return (
                      <div
                        key={templateId}
                        className="text-sm text-gray-400 truncate"
                      >
                        {exercise?.title || templateId}
                      </div>
                    );
                  })}
                  {summary.successes.length > 5 && (
                    <div className="text-xs text-gray-500">
                      +{summary.successes.length - 5} more
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Struggles */}
            {summary.struggles.length > 0 && (
              <Card
                variant="outlined"
                padding="md"
                className="border-amber-500/20"
              >
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown size={18} className="text-amber-400" />
                  <h3 className="font-medium text-gray-200">Needs Practice</h3>
                </div>
                <div className="space-y-2">
                  {summary.struggles.slice(0, 5).map((templateId) => {
                    const exercise = exercisesMap.get(templateId);
                    return (
                      <div
                        key={templateId}
                        className="text-sm text-gray-400 truncate"
                      >
                        {exercise?.title || templateId}
                      </div>
                    );
                  })}
                  {summary.struggles.length > 5 && (
                    <div className="text-xs text-gray-500">
                      +{summary.struggles.length - 5} more
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Reflection note (if any) */}
          {session.reflectionNote && (
            <Card variant="outlined" padding="md">
              <h4 className="text-sm font-medium text-gray-400 mb-2">
                Your Reflection
              </h4>
              <p className="text-gray-300">{session.reflectionNote}</p>
            </Card>
          )}
        </div>
      </main>

      {/* Footer with actions */}
      <footer className="sticky bottom-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex flex-col gap-3">
            {/* Primary action */}
            <Button
              variant="primary"
              fullWidth
              onClick={onDashboard}
              iconRight={<ArrowRight size={16} />}
            >
              Back to Dashboard
            </Button>

            {/* Secondary actions */}
            <div className="flex gap-2">
              {onStartNew && (
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={onStartNew}
                  iconLeft={<RotateCcw size={16} />}
                >
                  New Session
                </Button>
              )}
              {summary.struggles.length > 0 && onCramStruggles && (
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={onCramStruggles}
                  iconLeft={<Zap size={16} />}
                >
                  Cram Struggles
                </Button>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

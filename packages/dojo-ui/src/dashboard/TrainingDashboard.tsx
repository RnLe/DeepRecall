/**
 * TrainingDashboard - Main dashboard for the Dojo training mode
 * Shows today's agenda, quick stats, streak, and session controls
 */

"use client";

import { useMemo, useState } from "react";
import {
  Flame,
  Clock,
  Target,
  TrendingUp,
  Zap,
  Play,
  BarChart3,
  Map as MapIcon,
  Settings,
} from "lucide-react";
import type {
  ExerciseTemplate,
  ConceptNode,
  SchedulerItem,
  ExerciseBrickState,
  ConceptBrickState,
  Session,
  AttemptMode,
} from "@deeprecall/dojo-core";
import { computePriority } from "@deeprecall/dojo-core";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { Badge } from "../components/Badge";
import { StatsCard } from "./StatsCard";
import { StreakDisplay } from "./StreakDisplay";
import { SessionCard } from "./SessionCard";
import { AgendaList, type AgendaItem } from "./AgendaList";

export interface DashboardStats {
  /** Current streak in days */
  streak: number;
  /** Best streak in days */
  bestStreak?: number;
  /** Whether today's goal is complete */
  todayComplete?: boolean;
  /** Weekly activity (7 booleans, starting from Sunday) */
  weeklyActivity?: boolean[];
  /** Total focus time this week (seconds) */
  weeklyFocusTime: number;
  /** Total exercises completed this week */
  weeklyExercises: number;
  /** Average mastery across all concepts */
  averageMastery: number;
  /** Number of concepts mastered (>70%) */
  masteredConcepts: number;
  /** Total concepts */
  totalConcepts: number;
  /** Concept with biggest recent improvement */
  mostImprovedConcept?: ConceptNode;
  /** Improvement amount for most improved */
  improvementAmount?: number;
}

export interface TrainingDashboardProps {
  /** All exercises */
  exercises: ExerciseTemplate[];
  /** All concepts */
  concepts: ConceptNode[];
  /** Exercise brick states */
  exerciseBricks: Map<string, ExerciseBrickState>;
  /** Concept brick states */
  conceptBricks: Map<string, ConceptBrickState>;
  /** Scheduled items */
  scheduledItems: SchedulerItem[];
  /** Recommended exercise IDs */
  recommendedIds?: string[];
  /** Dashboard stats */
  stats: DashboardStats;
  /** Active session (if any) */
  activeSession?: Session;
  /** Handler to start normal session */
  onStartNormalSession: () => void;
  /** Handler to start cram session */
  onStartCramSession: () => void;
  /** Handler to select an exercise */
  onSelectExercise: (exercise: ExerciseTemplate) => void;
  /** Handler to view all exercises */
  onViewAllExercises: () => void;
  /** Handler to view concept map */
  onViewConceptMap: () => void;
  /** Handler to view stats */
  onViewStats?: () => void;
  /** Handler to pause active session */
  onPauseSession?: () => void;
  /** Handler to view settings */
  onSettings?: () => void;
}

/**
 * Main training dashboard showing today's agenda, stats, and quick actions
 */
export function TrainingDashboard({
  exercises,
  concepts,
  exerciseBricks,
  conceptBricks,
  scheduledItems,
  recommendedIds = [],
  stats,
  activeSession,
  onStartNormalSession,
  onStartCramSession,
  onSelectExercise,
  onViewAllExercises,
  onViewConceptMap,
  onViewStats,
  onPauseSession,
  onSettings,
}: TrainingDashboardProps) {
  const now = new Date();

  // Build agenda items with priority scoring
  const agendaItems = useMemo(() => {
    const recommendedSet = new Set(recommendedIds);

    // Map scheduler items to agenda items with priority
    const schedulerMap: Map<string, SchedulerItem> = new Map();
    for (const item of scheduledItems) {
      if (!item.completedAt) {
        schedulerMap.set(item.templateId as string, item);
      }
    }

    // Get all due exercise IDs
    const dueExerciseIds = new Set<string>(
      scheduledItems
        .filter(
          (item) => new Date(item.scheduledFor) <= now && !item.completedAt
        )
        .map((item) => item.templateId as string)
    );

    return exercises
      .filter(
        (ex) =>
          dueExerciseIds.has(ex.id as string) ||
          recommendedSet.has(ex.id as string)
      )
      .map((exercise): AgendaItem => {
        const brickState = exerciseBricks.get(exercise.id as string);
        const schedulerItem = schedulerMap.get(exercise.id as string);
        const isNew = !brickState || brickState.metrics.totalAttempts === 0;

        // Compute priority score for scheduling
        const priority = schedulerItem
          ? computePriority(
              new Date(schedulerItem.scheduledFor),
              now,
              schedulerItem.reason,
              brickState?.metrics
            )
          : 0;

        // Check if overdue
        const isOverdue = schedulerItem
          ? new Date(schedulerItem.scheduledFor) < now
          : false;

        return {
          exercise,
          schedulerItem,
          brickState,
          isRecommended: recommendedSet.has(exercise.id as string),
          isDue: dueExerciseIds.has(exercise.id as string),
          isNew,
          priority,
          isOverdue,
        };
      });
  }, [exercises, scheduledItems, recommendedIds, exerciseBricks, now]);

  // Format time
  const formatHours = (seconds: number) => {
    const hours = seconds / 3600;
    return hours < 1 ? `${Math.round(hours * 60)}m` : `${hours.toFixed(1)}h`;
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-100">Dojo</h1>
              <p className="text-sm text-gray-500">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <IconButton
                icon={MapIcon}
                title="Concept Map"
                variant="ghost"
                onClick={onViewConceptMap}
              />
              {onViewStats && (
                <IconButton
                  icon={BarChart3}
                  title="Statistics"
                  variant="ghost"
                  onClick={onViewStats}
                />
              )}
              {onSettings && (
                <IconButton
                  icon={Settings}
                  title="Settings"
                  variant="ghost"
                  onClick={onSettings}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Streak display */}
        <StreakDisplay
          currentStreak={stats.streak}
          bestStreak={stats.bestStreak}
          todayComplete={stats.todayComplete}
          weeklyActivity={stats.weeklyActivity}
          size="md"
        />

        {/* Quick stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatsCard
            label="This Week"
            value={formatHours(stats.weeklyFocusTime)}
            subtext={`${stats.weeklyExercises} exercises`}
            icon={<Clock size={18} />}
            variant="primary"
            size="sm"
          />
          <StatsCard
            label="Avg Mastery"
            value={`${stats.averageMastery}%`}
            trend={stats.averageMastery > 50 ? "up" : "stable"}
            icon={<Target size={18} />}
            variant="default"
            size="sm"
          />
          <StatsCard
            label="Mastered"
            value={`${stats.masteredConcepts}/${stats.totalConcepts}`}
            subtext="concepts"
            icon={<TrendingUp size={18} />}
            variant="success"
            size="sm"
          />
          {stats.mostImprovedConcept && (
            <StatsCard
              label="Most Improved"
              value={`+${stats.improvementAmount ?? 0}%`}
              subtext={stats.mostImprovedConcept.name}
              icon={<Flame size={18} />}
              variant="warning"
              size="sm"
            />
          )}
        </div>

        {/* Active session or session controls */}
        {activeSession ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400">
              Active Session
            </h3>
            <SessionCard
              session={activeSession}
              isActive={activeSession.status === "active"}
              onPause={onPauseSession}
            />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            <SessionCard mode="normal" onStart={onStartNormalSession} />
            <SessionCard mode="cram" onStart={onStartCramSession} />
          </div>
        )}

        {/* Today's agenda */}
        <AgendaList
          items={agendaItems}
          onSelectItem={onSelectExercise}
          onViewAll={onViewAllExercises}
          maxItems={5}
        />

        {/* Quick actions */}
        <div className="grid md:grid-cols-2 gap-3">
          <Card
            variant="default"
            padding="md"
            interactive
            onClick={onViewConceptMap}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <MapIcon size={20} className="text-purple-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-200">Concept Map</h4>
                <p className="text-sm text-gray-500">
                  Visualize your progress across topics
                </p>
              </div>
            </div>
          </Card>

          <Card
            variant="default"
            padding="md"
            interactive
            onClick={onViewAllExercises}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Target size={20} className="text-blue-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-200">All Exercises</h4>
                <p className="text-sm text-gray-500">
                  Browse {exercises.length} available exercises
                </p>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

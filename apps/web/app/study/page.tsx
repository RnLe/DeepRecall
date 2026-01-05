"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  TrainingDashboard,
  type DashboardStats,
} from "@deeprecall/dojo-ui/dashboard";
import type {
  ExerciseTemplate,
  ConceptNode,
  SchedulerItem,
  ExerciseBrickState,
  ConceptBrickState,
  Session,
} from "@deeprecall/dojo-core";
import {
  asExerciseTemplateId,
  asConceptNodeId,
  asSubtaskId,
} from "@deeprecall/dojo-core";

// Mock data for demonstration - replace with real data hooks later
const mockConcepts: ConceptNode[] = [
  {
    id: asConceptNodeId("concept-1"),
    domainId: "math.algebra.linear-algebra",
    name: "Matrix Multiplication",
    slug: "matrix-multiplication",
    description: "Understanding how to multiply matrices",
    conceptKind: "technique",
    difficulty: "intro",
    importance: "fundamental",
    prerequisiteIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: asConceptNodeId("concept-2"),
    domainId: "math.algebra.linear-algebra",
    name: "Eigenvalues & Eigenvectors",
    slug: "eigenvalues-eigenvectors",
    description: "Finding and interpreting eigenvalues and eigenvectors",
    conceptKind: "object",
    difficulty: "core",
    importance: "fundamental",
    prerequisiteIds: [asConceptNodeId("concept-1")],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: asConceptNodeId("concept-3"),
    domainId: "math.algebra.linear-algebra",
    name: "Diagonalization",
    slug: "diagonalization",
    description: "Diagonalizing matrices using eigenvectors",
    conceptKind: "technique",
    difficulty: "core",
    importance: "supporting",
    prerequisiteIds: [asConceptNodeId("concept-2")],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockExercises: ExerciseTemplate[] = [
  {
    id: asExerciseTemplateId("exercise-1"),
    domainId: "math.algebra.linear-algebra",
    title: "Multiply 2×2 Matrices",
    description: "Practice basic matrix multiplication with small matrices",
    problemStatement:
      "Compute the product $AB$ where $A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$ and $B = \\begin{pmatrix} 5 & 6 \\\\ 7 & 8 \\end{pmatrix}$",
    subtasks: [
      {
        id: asSubtaskId("subtask-1"),
        label: "(a)",
        prompt: "Compute the product $AB$",
        hintSteps: ["Use the formula $(AB)_{ij} = \\sum_k A_{ik} B_{kj}$"],
        solutionSketch: "Multiply row by column...",
        fullSolution:
          "$AB = \\begin{pmatrix} 19 & 22 \\\\ 43 & 50 \\end{pmatrix}$",
      },
    ],
    primaryConceptIds: [asConceptNodeId("concept-1")],
    exerciseKind: "calculation",
    difficulty: "intro",
    importance: "fundamental",
    tags: ["calculation"],
    isParameterized: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: asExerciseTemplateId("exercise-2"),
    domainId: "math.algebra.linear-algebra",
    title: "Find Eigenvalues of 2×2 Matrix",
    description: "Compute eigenvalues using the characteristic polynomial",
    problemStatement:
      "Find the eigenvalues of $A = \\begin{pmatrix} 4 & 1 \\\\ 2 & 3 \\end{pmatrix}$",
    subtasks: [
      {
        id: asSubtaskId("subtask-2a"),
        label: "(a)",
        prompt: "Write the characteristic polynomial $\\det(A - \\lambda I)$",
        hintSteps: ["Set up $A - \\lambda I$ first"],
        fullSolution: "$\\lambda^2 - 7\\lambda + 10$",
      },
      {
        id: asSubtaskId("subtask-2b"),
        label: "(b)",
        prompt: "Find the eigenvalues",
        fullSolution: "$\\lambda_1 = 5$, $\\lambda_2 = 2$",
      },
    ],
    primaryConceptIds: [asConceptNodeId("concept-2")],
    supportingConceptIds: [asConceptNodeId("concept-1")],
    exerciseKind: "calculation",
    difficulty: "core",
    importance: "fundamental",
    tags: ["calculation", "conceptual"],
    isParameterized: true,
    variantGenerationNote: "Can vary the matrix entries",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: asExerciseTemplateId("exercise-3"),
    domainId: "math.algebra.linear-algebra",
    title: "Diagonalize a Symmetric Matrix",
    description: "Find P and D such that A = PDP^{-1}",
    problemStatement:
      "Diagonalize $A = \\begin{pmatrix} 2 & 1 \\\\ 1 & 2 \\end{pmatrix}$",
    subtasks: [
      {
        id: asSubtaskId("subtask-3a"),
        label: "(a)",
        prompt: "Find the eigenvalues of $A$",
        fullSolution: "$\\lambda_1 = 3$, $\\lambda_2 = 1$",
      },
      {
        id: asSubtaskId("subtask-3b"),
        label: "(b)",
        prompt: "Find the eigenvectors",
        fullSolution: "$v_1 = (1, 1)^T$, $v_2 = (1, -1)^T$",
      },
      {
        id: asSubtaskId("subtask-3c"),
        label: "(c)",
        prompt: "Write $P$ and $D$",
        fullSolution:
          "$P = \\begin{pmatrix} 1 & 1 \\\\ 1 & -1 \\end{pmatrix}$, $D = \\begin{pmatrix} 3 & 0 \\\\ 0 & 1 \\end{pmatrix}$",
      },
    ],
    primaryConceptIds: [asConceptNodeId("concept-3")],
    supportingConceptIds: [
      asConceptNodeId("concept-2"),
      asConceptNodeId("concept-1"),
    ],
    exerciseKind: "derivation",
    difficulty: "core",
    importance: "supporting",
    tags: ["calculation", "proof"],
    isParameterized: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Mock brick states
const mockExerciseBricks = new Map<string, ExerciseBrickState>();
const mockConceptBricks = new Map<string, ConceptBrickState>();

// Mock stats
const mockStats: DashboardStats = {
  streak: 5,
  bestStreak: 12,
  todayComplete: false,
  weeklyActivity: [true, true, false, true, true, false, false],
  weeklyFocusTime: 3600 * 2.5, // 2.5 hours
  weeklyExercises: 15,
  averageMastery: 45,
  masteredConcepts: 1,
  totalConcepts: 3,
  mostImprovedConcept: mockConcepts[0],
  improvementAmount: 12,
};

export default function StudyPage() {
  const router = useRouter();

  // Handlers
  const handleStartNormalSession = useCallback(() => {
    // TODO: Create session and navigate to first exercise
    console.log("Starting normal session...");
  }, []);

  const handleStartCramSession = useCallback(() => {
    // TODO: Open cram session target selection
    console.log("Starting cram session...");
  }, []);

  const handleSelectExercise = useCallback(
    (exercise: ExerciseTemplate) => {
      router.push(`/study/exercise/${exercise.id}`);
    },
    [router]
  );

  const handleViewAllExercises = useCallback(() => {
    router.push("/study/exercises");
  }, [router]);

  const handleViewConceptMap = useCallback(() => {
    router.push("/study/concepts");
  }, [router]);

  const handleViewStats = useCallback(() => {
    router.push("/study/stats");
  }, [router]);

  return (
    <TrainingDashboard
      exercises={mockExercises}
      concepts={mockConcepts}
      exerciseBricks={mockExerciseBricks}
      conceptBricks={mockConceptBricks}
      scheduledItems={[]}
      recommendedIds={[mockExercises[0].id, mockExercises[1].id]}
      stats={mockStats}
      onStartNormalSession={handleStartNormalSession}
      onStartCramSession={handleStartCramSession}
      onSelectExercise={handleSelectExercise}
      onViewAllExercises={handleViewAllExercises}
      onViewConceptMap={handleViewConceptMap}
      onViewStats={handleViewStats}
    />
  );
}

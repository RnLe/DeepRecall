"use client";

import { useRouter, useParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { SolveScreen } from "@deeprecall/dojo-ui/solve";
import type { ExerciseTemplate, ExerciseAttempt } from "@deeprecall/dojo-core";
import {
  asExerciseTemplateId,
  asConceptNodeId,
  asSubtaskId,
  asUserId,
} from "@deeprecall/dojo-core";

// Mock exercises - in production, fetch by ID
const mockExercises: ExerciseTemplate[] = [
  {
    id: asExerciseTemplateId("exercise-1"),
    domainId: "math.algebra",
    title: "Multiply 2×2 Matrices",
    description: "Practice basic matrix multiplication with small matrices",
    exerciseKind: "calculation",
    problemStatement:
      "Compute the product $AB$ where $A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$ and $B = \\begin{pmatrix} 5 & 6 \\\\ 7 & 8 \\end{pmatrix}$",
    subtasks: [
      {
        id: asSubtaskId("subtask-1"),
        label: "(a)",
        prompt: "Compute the product $AB$",
        hintSteps: [
          "Use the formula $(AB)_{ij} = \\sum_k A_{ik} B_{kj}$",
          "For a 2×2 matrix, this means: $(AB)_{11} = A_{11}B_{11} + A_{12}B_{21}$",
        ],
        solutionSketch: "Multiply row by column...",
        fullSolution:
          "$AB = \\begin{pmatrix} 1 \\cdot 5 + 2 \\cdot 7 & 1 \\cdot 6 + 2 \\cdot 8 \\\\ 3 \\cdot 5 + 4 \\cdot 7 & 3 \\cdot 6 + 4 \\cdot 8 \\end{pmatrix} = \\begin{pmatrix} 19 & 22 \\\\ 43 & 50 \\end{pmatrix}$",
      },
    ],
    primaryConceptIds: [asConceptNodeId("concept-1")],
    difficulty: "intro",
    importance: "fundamental",
    tags: ["calculation"],
    isParameterized: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: asExerciseTemplateId("exercise-2"),
    domainId: "math.algebra",
    title: "Find Eigenvalues of 2×2 Matrix",
    description: "Compute eigenvalues using the characteristic polynomial",
    exerciseKind: "calculation",
    problemStatement:
      "Find the eigenvalues of $A = \\begin{pmatrix} 4 & 1 \\\\ 2 & 3 \\end{pmatrix}$",
    subtasks: [
      {
        id: asSubtaskId("subtask-2a"),
        label: "(a)",
        prompt: "Write the characteristic polynomial $\\det(A - \\lambda I)$",
        hintSteps: [
          "Set up $A - \\lambda I$ first",
          "$A - \\lambda I = \\begin{pmatrix} 4 - \\lambda & 1 \\\\ 2 & 3 - \\lambda \\end{pmatrix}$",
        ],
        fullSolution:
          "$\\det(A - \\lambda I) = (4 - \\lambda)(3 - \\lambda) - 2 = \\lambda^2 - 7\\lambda + 10$",
      },
      {
        id: asSubtaskId("subtask-2b"),
        label: "(b)",
        prompt: "Find the eigenvalues",
        hintSteps: [
          "Factor the characteristic polynomial",
          "$(\\lambda - 5)(\\lambda - 2) = 0$",
        ],
        fullSolution: "$\\lambda_1 = 5$, $\\lambda_2 = 2$",
      },
    ],
    primaryConceptIds: [asConceptNodeId("concept-2")],
    supportingConceptIds: [asConceptNodeId("concept-1")],
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
    domainId: "math.algebra",
    title: "Diagonalize a Symmetric Matrix",
    description: "Find P and D such that A = PDP^{-1}",
    exerciseKind: "derivation",
    problemStatement:
      "Diagonalize $A = \\begin{pmatrix} 2 & 1 \\\\ 1 & 2 \\end{pmatrix}$",
    subtasks: [
      {
        id: asSubtaskId("subtask-3a"),
        label: "(a)",
        prompt: "Find the eigenvalues of $A$",
        hintSteps: [
          "Compute $\\det(A - \\lambda I) = 0$",
          "$(2 - \\lambda)^2 - 1 = 0$",
        ],
        fullSolution: "$\\lambda_1 = 3$, $\\lambda_2 = 1$",
      },
      {
        id: asSubtaskId("subtask-3b"),
        label: "(b)",
        prompt: "Find the eigenvectors",
        hintSteps: [
          "Solve $(A - \\lambda_i I)v = 0$ for each eigenvalue",
          "For $\\lambda = 3$: solve $\\begin{pmatrix} -1 & 1 \\\\ 1 & -1 \\end{pmatrix} v = 0$",
        ],
        fullSolution: "$v_1 = (1, 1)^T$, $v_2 = (1, -1)^T$",
      },
      {
        id: asSubtaskId("subtask-3c"),
        label: "(c)",
        prompt: "Write $P$ and $D$",
        hintSteps: [
          "P is formed by placing eigenvectors as columns",
          "D is a diagonal matrix with eigenvalues on the diagonal",
        ],
        fullSolution:
          "$P = \\begin{pmatrix} 1 & 1 \\\\ 1 & -1 \\end{pmatrix}$, $D = \\begin{pmatrix} 3 & 0 \\\\ 0 & 1 \\end{pmatrix}$",
      },
    ],
    primaryConceptIds: [asConceptNodeId("concept-3")],
    supportingConceptIds: [
      asConceptNodeId("concept-2"),
      asConceptNodeId("concept-1"),
    ],
    difficulty: "core",
    importance: "supporting",
    tags: ["calculation", "proof"],
    isParameterized: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function ExercisePage() {
  const router = useRouter();
  const params = useParams();
  const exerciseId = params.id as string;

  // Find the exercise
  const exercise = useMemo(() => {
    return mockExercises.find((e) => e.id === exerciseId);
  }, [exerciseId]);

  const handleComplete = useCallback((attempt: ExerciseAttempt) => {
    console.log("Attempt completed:", attempt);
    // TODO: Save attempt to database
  }, []);

  const handleBack = useCallback(() => {
    router.push("/study");
  }, [router]);

  const handleRedo = useCallback(() => {
    // Reload the page to reset state
    window.location.reload();
  }, []);

  const handleContinue = useCallback(() => {
    router.push("/study");
  }, [router]);

  if (!exercise) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-100 mb-2">
            Exercise Not Found
          </h1>
          <p className="text-gray-400 mb-4">
            The requested exercise could not be found.
          </p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <SolveScreen
      exercise={exercise}
      userId={asUserId("demo-user")}
      mode="normal"
      attemptType="original"
      onComplete={handleComplete}
      onBack={handleBack}
      onRedo={handleRedo}
      onContinue={handleContinue}
      continueLabel="Back to Dashboard"
    />
  );
}

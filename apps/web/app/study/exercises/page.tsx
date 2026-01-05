"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ExerciseList } from "@deeprecall/dojo-ui/exercises";
import type { ExerciseTemplate } from "@deeprecall/dojo-core";
import {
  asExerciseTemplateId,
  asConceptNodeId,
  asSubtaskId,
} from "@deeprecall/dojo-core";

// Same mock data as dashboard - in production, use shared data hooks
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

export default function ExercisesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/study")}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <h1 className="text-xl font-bold text-gray-100">All Exercises</h1>
          </div>
        </div>
      </header>

      {/* Exercise list */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <ExerciseList
          exercises={mockExercises}
          onSelectExercise={(exercise) =>
            router.push(`/study/exercise/${exercise.id}`)
          }
          showHeader={false}
        />
      </main>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BrickWall } from "@deeprecall/dojo-ui/dashboard";
import type { ConceptNode, ConceptBrickState } from "@deeprecall/dojo-core";
import { asConceptNodeId } from "@deeprecall/dojo-core";

// Mock data - in production, use shared data hooks
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
  {
    id: asConceptNodeId("concept-4"),
    domainId: "math.algebra.linear-algebra",
    name: "Spectral Theorem",
    slug: "spectral-theorem",
    description: "Spectral decomposition of symmetric matrices",
    conceptKind: "theorem",
    difficulty: "advanced",
    importance: "fundamental",
    prerequisiteIds: [asConceptNodeId("concept-3")],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: asConceptNodeId("concept-5"),
    domainId: "math.algebra.linear-algebra",
    name: "Linear Transformations",
    slug: "linear-transformations",
    description: "Maps between vector spaces preserving structure",
    conceptKind: "definition",
    difficulty: "intro",
    importance: "fundamental",
    prerequisiteIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: asConceptNodeId("concept-6"),
    domainId: "math.algebra.linear-algebra",
    name: "Change of Basis",
    slug: "change-of-basis",
    description: "Representing vectors and transformations in different bases",
    conceptKind: "technique",
    difficulty: "core",
    importance: "supporting",
    prerequisiteIds: [
      asConceptNodeId("concept-1"),
      asConceptNodeId("concept-5"),
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Mock brick states with some progress
const mockConceptBricks = new Map<string, ConceptBrickState>();

export default function ConceptsPage() {
  const router = useRouter();

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <header className="flex-shrink-0 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/study")}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <h1 className="text-xl font-bold text-gray-100">Concept Map</h1>
          </div>
        </div>
      </header>

      {/* BrickWall fills remaining space */}
      <div className="flex-1 overflow-hidden">
        <BrickWall
          concepts={mockConcepts}
          brickStates={mockConceptBricks}
          onSelectConcept={(concept) => console.log("Selected:", concept.name)}
          onPracticeConcept={(concept) =>
            console.log("Practice:", concept.name)
          }
          title="Linear Algebra"
          showControls
        />
      </div>
    </div>
  );
}

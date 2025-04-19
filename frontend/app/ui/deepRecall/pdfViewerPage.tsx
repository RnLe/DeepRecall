"use client";

import React, { useState } from "react";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

import { useLiterature } from "../../customHooks/useLiterature";
import { LiteratureExtended } from "../../types/literatureTypes";
import CompactLiteratureList from "./compactLiteratureList";
import PdfAnnotationContainer from "./pdfAnnotationContainer";
import ColorAssignmentPanel from "./ColorAssignmentPanel";
import { AnnotationKind } from "../../types/annotationTypes";

// Initialize all kinds to black/purple by default
const initialColorMap: Record<AnnotationKind, { color: string; selectedColor: string }> =
  ([
    "Equation","Plot","Illustration","Theorem","Statement",
    "Definition","Figure","Table","Exercise","Problem",
  ] as AnnotationKind[]).reduce((acc, k) => {
    acc[k] = { color: "#000000", selectedColor: "#800080" };
    return acc;
  }, {} as Record<AnnotationKind, { color: string; selectedColor: string }>);

const PdfViewerPage: React.FC<{ className?: string }> = ({ className }) => {
  const { data: items = [], isLoading, error } = useLiterature();
  const [activeLit, setActiveLit] = useState<LiteratureExtended | null>(null);

  const [showColorPanel, setShowColorPanel] = useState(false);
  const [colorMap, setColorMap] = useState(initialColorMap);

  if (isLoading) return <div>Loading literature…</div>;
  if (error) return <div>Error: {(error as Error).message}</div>;

  return (
    <div className={`flex h-full w-full bg-gray-900 text-white ${className || ""}`}>
      <aside className="w-1/4 p-4 bg-gray-800 relative">
        <button
          onClick={() => setShowColorPanel(true)}
          className="mb-4 px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm"
        >
          Manage Colors
        </button>
        <h2 className="text-xl font-semibold mb-4">Literature</h2>
        <CompactLiteratureList items={items} onSelect={setActiveLit} />

        {showColorPanel && (
          <ColorAssignmentPanel
            colorMap={colorMap}
            setColorMap={setColorMap}
            onClose={() => setShowColorPanel(false)}
          />
        )}
      </aside>

      <main className="flex-1 overflow-hidden p-4">
        {activeLit ? (
          <PdfAnnotationContainer
            activeLiterature={activeLit}
            colorMap={colorMap}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            Select a literature entry to open its PDF
          </div>
        )}
      </main>
    </div>
  );
};

export default PdfViewerPage;
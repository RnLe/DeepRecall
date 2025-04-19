// src/components/pdfViewer/pdfViewerPage.tsx
"use client";

import React, { useState, useEffect } from "react";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

import { useLiterature } from "../../customHooks/useLiterature";
import { LiteratureExtended } from "../../types/literatureTypes";
import CompactLiteratureList from "./compactLiteratureList";
import PdfAnnotationContainer from "./pdfAnnotationContainer";
import ColorAssignmentPanel from "./ColorAssignmentPanel";
import { useColors } from "../../customHooks/useColors";
import { AnnotationType, annotationTypes } from "../../types/annotationTypes";

const PdfViewerPage: React.FC<{ className?: string }> = ({ className }) => {
  const { data: items = [], isLoading: litLoading, error: litError } = useLiterature();
  const [activeLit, setActiveLit] = useState<LiteratureExtended | null>(null);

  const { schemes, isLoading: schemesLoading, error: schemesError, createScheme, updateScheme, deleteScheme } = useColors();
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>("");

  console.log("schemes", schemes);

  const [showColorPanel, setShowColorPanel] = useState(false);
  const [colorMap, setColorMap] = useState<Record<AnnotationType,string>>(
    annotationTypes.reduce((acc, t) => ({ ...acc, [t]: "#000000" }), {} as Record<AnnotationType,string>)
  );

  // When schemes load, pick the first
  useEffect(() => {
    if (schemes.length && !selectedSchemeId) {
      setSelectedSchemeId(schemes[0].documentId!);
    }
  }, [schemes, selectedSchemeId]);

  // When selectedScheme changes, load its colors into local map
  useEffect(() => {
    const scheme = schemes.find(s => s.documentId === selectedSchemeId);
    if (!scheme) return;
    setColorMap({
      ...annotationTypes.reduce((acc, t) => ({ ...acc, [t]: "#000000" }), {} as Record<AnnotationType,string>),
      ...scheme.scheme.annotationColors,
    });
  }, [selectedSchemeId, schemes]);

  if (litLoading || schemesLoading) return <div>Loading…</div>;
  if (litError) return <div>Error: {(litError as Error).message}</div>;
  if (schemesError) return <div>Error loading color schemes</div>;

  return (
    <div className={`flex h-full w-full bg-gray-900 text-white ${className||""}`}>
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
            schemes={schemes}
            selectedSchemeId={selectedSchemeId}
            onSchemeSelect={setSelectedSchemeId}
            createScheme={createScheme}
            updateScheme={updateScheme}
            deleteScheme={deleteScheme}
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

// src/components/pdfViewer/pdfViewerPage.tsx
"use client";

import React, { useState } from "react";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

import { useLiterature } from "../../customHooks/useLiterature";
import { LiteratureExtended } from "../../types/literatureTypes";
import CompactLiteratureList from "./compactLiteratureList";
import PdfAnnotationContainer from "./pdfAnnotationContainer";
import { useColors } from "../../customHooks/useColors";
import { AnnotationType } from "../../types/annotationTypes";

const types: AnnotationType[] = [
  "Equation","Plot","Illustration","Theorem","Statement",
  "Definition","Figure","Table","Exercise","Problem"
];

const PdfViewerPage: React.FC<{ className?: string }> = ({ className }) => {
  const { data: items = [], isLoading: litLoading, error: litError } = useLiterature();
  const [activeLit, setActiveLit] = useState<LiteratureExtended | null>(null);

  const { schemes, isLoading: schemesLoading, error: schemesError } = useColors();
  const [selectedSchemeId, setSelectedSchemeId] = useState<string | null>(
    () => schemes[0]?.documentId ?? null
  );

  const selectedScheme = schemes.find((s) => s.documentId === selectedSchemeId);

  const annotationColors: Record<AnnotationType, string> = types.reduce(
    (acc, t) => {
      acc[t] = selectedScheme?.scheme.annotationColors[t] ?? "#000000";
      return acc;
    },
    {} as Record<AnnotationType, string>
  );

  if (litLoading || schemesLoading) return <div>Loading…</div>;
  if (litError) return <div>Error: {(litError as Error).message}</div>;
  if (schemesError) return <div>Error loading color schemes</div>;

  return (
    <div className={`flex h-full w-full bg-gray-900 text-white ${className||""}`}>
      <aside className="w-1/4 p-4 bg-gray-800">
        <div className="mb-4">
          <label className="block text-sm mb-1">Color Scheme</label>
          <select
            value={selectedSchemeId ?? ""}
            onChange={(e) => setSelectedSchemeId(e.target.value)}
            className="w-full p-1 rounded bg-gray-700 border border-gray-600"
          >
            {schemes.map((s) => (
              <option key={s.documentId} value={s.documentId}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <h2 className="text-xl font-semibold mb-4">Literature</h2>
        <CompactLiteratureList items={items} onSelect={setActiveLit} />
      </aside>

      <main className="flex-1 overflow-hidden p-4">
        {activeLit ? (
          <PdfAnnotationContainer
            activeLiterature={activeLit}
            colorMap={annotationColors}
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

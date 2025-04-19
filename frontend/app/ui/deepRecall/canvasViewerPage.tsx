"use client";

import React, { useState, useMemo } from "react";
import { useLiterature } from "../../customHooks/useLiterature";
import { useAnnotations } from "../../customHooks/useAnnotations";
import { LiteratureExtended } from "../../types/literatureTypes";
import CompactLiteratureList from "./compactLiteratureList";
import AnnotationList from "./annotationList";
import CanvasPdfFlow from "./CanvasPdfFlow";
import { ReactFlowProvider } from "reactflow";

interface CanvasViewerPageProps {
  className?: string;
}

const CanvasViewerPage: React.FC<CanvasViewerPageProps> = ({ className }) => {
  // literature list
  const { data: items = [], isLoading, error } = useLiterature();
  const [activeLit, setActiveLit] = useState<LiteratureExtended | null>(null);

  // shared hover & select state
  const [selId, setSelId] = useState<string | null>(null);
  const [hovId, setHovId] = useState<string | null>(null);

  // annotations for the active PDF
  const {
    annotations: allAnns = [],
    isLoading: annLoading,
  } = useAnnotations(activeLit?.documentId ?? undefined);
  const anns = useMemo(
    () =>
      activeLit
        ? allAnns.filter((a) => a.pdfId === activeLit.versions[0]?.fileHash)
        : [],
    [allAnns, activeLit]
  );

  if (isLoading) return <div>Loading literature…</div>;
  if (error) return <div>Error: {(error as Error).message}</div>;

  return (
    <div className={`flex bg-gray-900 text-white ${className || ""}`}>
      {/* TOP: title */}
      {/* LEFT: literature + annotation list */}
      <aside className="w-1/4 flex flex-col p-4 bg-gray-800">
        <h2 className="text-xl font-semibold mb-2">Literature</h2>
        <CompactLiteratureList items={items} onSelect={setActiveLit} />

        <h2 className="text-xl font-semibold mt-4 mb-2">Annotations</h2>
        <div className="flex-1 overflow-auto border-t border-gray-700 pt-2">
          {annLoading ? (
            <div>Loading annotations…</div>
          ) : (
            <AnnotationList
              annotations={anns}
              selectedId={selId}
              hoveredId={hovId}
              multi={false}
              multiSet={new Set()}
              onItemClick={(a) => setSelId(a.documentId!)}
              onToggleMulti={() => {}}
              onHover={(id) => setHovId(id)}
            />
          )}
        </div>
      </aside>

      {/* RIGHT: the virtualized React‑Flow canvas */}
      <main className="flex-1 overflow-hidden p-4">
        {activeLit ? (
          <ReactFlowProvider>
            <CanvasPdfFlow
              literature={activeLit}
              selectedId={selId}
              hoveredId={hovId}
              onSelect={setSelId}
              onHover={setHovId}
            />
          </ReactFlowProvider>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            Select a literature entry to open its PDF
          </div>
        )}
      </main>
    </div>
  );
};

export default CanvasViewerPage;

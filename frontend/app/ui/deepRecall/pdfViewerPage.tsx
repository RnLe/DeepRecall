// pdfViewerPage.tsx
"use client";

import React, { useState } from "react";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

import { useLiterature } from "../../customHooks/useLiterature";
import { LiteratureExtended } from "../../types/literatureTypes";
import CompactLiteratureList from "./compactLiteratureList";
import PdfAnnotationContainer from "./pdfAnnotationContainer";

interface PdfViewerPageProps {
  className?: string;
}

const PdfViewerPage: React.FC<PdfViewerPageProps> = ({ className }) => {
  /* ---------------- data ----------------- */
  const { data: items = [], isLoading, error } = useLiterature();
  const [activeLit, setActiveLit] = useState<LiteratureExtended | null>(null);

  /* --------------- UI -------------------- */
  if (isLoading) return <div>Loading literature…</div>;
  if (error)      return <div>Error: {(error as Error).message}</div>;

  return (
    <div className={`flex h-full w-full bg-gray-900 text-white ${className || ""}`}>
      {/* LEFT – list */}
      <aside className="w-1/4 p-4 bg-gray-800">
        <h2 className="text-xl font-semibold mb-4">Literature</h2>
        <CompactLiteratureList items={items} onSelect={setActiveLit} />
      </aside>

      {/* RIGHT – viewer */}
      <main className="flex-1 overflow-hidden p-4">
        {activeLit ? (
          <PdfAnnotationContainer activeLiterature={activeLit} />
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

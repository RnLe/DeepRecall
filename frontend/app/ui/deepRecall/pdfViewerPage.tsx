"use client";

import React, { useState } from "react";
import { pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { LITERATURE_TYPES } from "../../types/literatureTypesLegacy";
import CompactLiteratureList from "./compactLiteratureList";
import { useLiterature } from "../../customHooks/useLiterature";
import { LiteratureItem, mapLiteratureItems } from "../../types/literatureTypesLegacy";
import PdfAnnotationContainer from "./pdfAnnotationContainer";

// Configure the PDF.js worker.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PdfViewerPageProps {
  classNames?: string;
}

const PdfViewerPage: React.FC<PdfViewerPageProps> = ({ classNames }) => {
  const { data, isLoading, error } = useLiterature();
  const [activeLiterature, setActiveLiterature] = useState<LiteratureItem | null>(null);

  const handleSelect = (item: LiteratureItem) => {
    setActiveLiterature(item);
  };

  // Combine literature items from all types.
  const allItems = LITERATURE_TYPES.reduce((acc, type) => [
    ...acc,
    ...(data ? mapLiteratureItems(data, type) : [])
  ], [] as LiteratureItem[]);

  if (isLoading) {
    return <div>Loading literature...</div>;
  }

  if (error) {
    return <div>Error loading literature: {(error as Error).message}</div>;
  }

  return (
    <div className="flex min-h-screen w-full bg-gray-900 text-white">
      {/* Left sidebar with literature list */}
      <div className="w-1/4 p-4 bg-gray-800">
        <h2 className="text-xl font-semibold mb-4">Literature List</h2>
        <CompactLiteratureList items={allItems} onSelect={handleSelect} />
      </div>
      {/* Main content area: PDF viewer with annotations */}
      <div className="flex-1 p-4">
        <h1 className="text-3xl font-bold mb-4">PDF Viewer</h1>
        {activeLiterature ? (
          <div className="w-full max-w-6xl mx-auto h-full">
            <PdfAnnotationContainer activeLiterature={activeLiterature} />
          </div>
        ) : (
          <div className="text-center">Select a literature to view its PDF.</div>
        )}
      </div>
    </div>
  );
};

export default PdfViewerPage;

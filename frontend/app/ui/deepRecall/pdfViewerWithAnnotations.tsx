// pdfViewerWithAnnotations.tsx

import React, { useState, useRef } from 'react';
import { Document, Page } from 'react-pdf';
import AnnotationOverlay from './annotationOverlay';
import { Annotation } from '@/app/types/annotationTypes';
import { LiteratureItem } from './uploadWidget';
import { prefixStrapiUrl } from '@/app/helpers/getStrapiMedia';

interface PdfViewerWithAnnotationsProps {
  activeLiterature: LiteratureItem;
  annotationMode: 'none' | 'text' | 'rectangle';
  annotations: Annotation[];
  onCreateAnnotation: (annotation: Annotation) => void;
  onSelectAnnotation: (annotation: Annotation) => void;
}

const PdfViewerWithAnnotations: React.FC<PdfViewerWithAnnotationsProps> = ({
  activeLiterature,
  annotationMode,
  annotations,
  onCreateAnnotation,
  onSelectAnnotation
}) => {
  const [numPages, setNumPages] = useState(0);
  // For rectangle drawing, keep state for whether the user is currently drawing.
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [drawEnd, setDrawEnd] = useState({ x: 0, y: 0 });
  
  // Store page container references to calculate dimensions.
  const pageRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // When the document loads, get the number of pages.
  const handleDocumentLoadSuccess = ({ numPages: nextNumPages }: { numPages: number }) => {
    setNumPages(nextNumPages);
  };

  // Mouse event handlers for rectangle annotation (demo only on page 1).
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (annotationMode !== 'rectangle') return;
    setIsDrawing(true);
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDrawStart({ x, y });
    setDrawEnd({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDrawEnd({ x, y });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>, pageWidth: number, pageHeight: number, pageNumber: number) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    // Calculate normalized coordinates.
    const x = Math.min(drawStart.x, drawEnd.x) / pageWidth;
    const y = Math.min(drawStart.y, drawEnd.y) / pageHeight;
    const width = Math.abs(drawEnd.x - drawStart.x) / pageWidth;
    const height = Math.abs(drawEnd.y - drawStart.y) / pageHeight;
    
    // Create a new annotation – using a simple id generation.
    const newAnnotation: Annotation = {
      id: `ann-${Date.now()}`,
      page: pageNumber,
      x,
      y,
      width,
      height,
      type: 'rectangle',
      annotationKind: 'Illustration', // Default kind; can be updated later.
      title: '',
      description: ''
    };
    onCreateAnnotation(newAnnotation);
  };

  return (
    <Document
      file={prefixStrapiUrl(activeLiterature.metadata.versions[0].file_url)}
      onLoadSuccess={handleDocumentLoadSuccess}
      className="relative"
    >
      {Array.from(new Array(numPages), (_, index) => {
        const pageNumber = index + 1;
        return (
          <div
            key={`page-container-${pageNumber}`}
            ref={ref => { pageRefs.current[pageNumber] = ref; }}
            className="relative mb-4"
            // For demonstration, allow drawing only on the first page.
            onMouseDown={pageNumber === 1 ? handleMouseDown : undefined}
            onMouseMove={pageNumber === 1 ? handleMouseMove : undefined}
            onMouseUp={pageNumber === 1 ? (e) => {
              const container = pageRefs.current[pageNumber];
              if (container) {
                const { width, height } = container.getBoundingClientRect();
                handleMouseUp(e, width, height, pageNumber);
              }
            } : undefined}
          >
            <Page
              pageNumber={pageNumber}
              renderAnnotationLayer={true}
              renderTextLayer={true}
              width={600} // Set your desired width.
            />
            {pageRefs.current[pageNumber] && (
              <AnnotationOverlay
                annotations={annotations.filter(ann => ann.page === pageNumber)}
                pageWidth={pageRefs.current[pageNumber]?.getBoundingClientRect().width || 600}
                pageHeight={pageRefs.current[pageNumber]?.getBoundingClientRect().height || 800}
                onSelectAnnotation={onSelectAnnotation}
              />
            )}
            {/* Render the drawing rectangle if the user is drawing on page 1 */}
            {isDrawing && pageNumber === 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: Math.min(drawStart.x, drawEnd.x),
                  top: Math.min(drawStart.y, drawEnd.y),
                  width: Math.abs(drawEnd.x - drawStart.x),
                  height: Math.abs(drawEnd.y - drawStart.y),
                  border: '2px dashed yellow',
                  pointerEvents: 'none'
                }}
              />
            )}
          </div>
        );
      })}
    </Document>
  );
};

export default PdfViewerWithAnnotations;

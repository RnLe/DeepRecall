import React, { useMemo, useState, useEffect, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  Node,
  useOnViewportChange,
} from "reactflow";
import "reactflow/dist/style.css";
import { Document, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { LiteratureExtended } from "../../types/literatureTypes";
import { Annotation } from "../../types/annotationTypes";
import { useAnnotations } from "../../customHooks/useAnnotations";
import CanvasPageNode from "./CanvasPageNode";
import CanvasAnnotationNode from "./CanvasAnnotationNode";
import AnnotationProperties from "./annotationProperties";
import { prefixStrapiUrl } from "@/app/helpers/getStrapiMedia";

// PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// Layout constants
const PAGE_WIDTH = 600;
const PAGE_GAP = 80;
const SIDEBAR_OFFSET = 500;
const CENTER_X = 800;

// Move nodeTypes outside of component
const nodeTypes = {
  pageNode: CanvasPageNode,
  annotationNode: CanvasAnnotationNode,
};

interface Props {
  literature: LiteratureExtended;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}

const CanvasPdfFlow: React.FC<Props> = ({
  literature,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}) => {
  // ...fetch & filter annotations...
  const version = literature.versions[0];
  const pdfUrl = version.fileUrl!;
  const pdfId = version.fileHash!;
  const { annotations: allAnnotations, isLoading, updateAnnotation, deleteAnnotation } =
    useAnnotations(literature.documentId);
  const annotations = useMemo(
    () => allAnnotations.filter((a) => a.pdfId === pdfId),
    [allAnnotations, pdfId]
  );

  const [editingId, setEditingId] = useState<string | null>(null);

  // Track number of pages
  const [numPages, setNumPages] = useState(0);

  // Virtualization: viewport & visible pages
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());

  useOnViewportChange({ onChange: (vp) => setViewport(vp) });

  useEffect(() => {
    if (!wrapperRef.current || numPages === 0) return;
    const h = wrapperRef.current.clientHeight;
    const { y, zoom } = viewport;
    const top = -y / zoom;
    const bottom = top + h / zoom;
    const vis = new Set<number>();
    for (let i = 1; i <= numPages; i++) {
      const pos = (i - 1) * (PAGE_WIDTH * 1.3 + PAGE_GAP);
      const ph = PAGE_WIDTH * 1.3;
      if (pos + ph > top - PAGE_GAP && pos < bottom + PAGE_GAP) vis.add(i);
    }
    setVisiblePages(vis);
  }, [viewport, numPages]);

  // Build only visible page nodes
  const pageNodes: Node[] = useMemo(() => {
    const nodes: Node[] = [];
    for (let i = 1; i <= numPages; i++) {
      if (!visiblePages.has(i)) continue;
      const pageAnns = annotations.filter((a) => a.page === i);
      nodes.push({
        id: `page-${i}`,
        type: "pageNode",
        position: { x: CENTER_X, y: (i - 1) * (PAGE_WIDTH * 1.3 + PAGE_GAP) },
        data: {
          pageNumber: i,
          annotations: pageAnns,
          selectedId,
          onSelect: (a: Annotation) => onSelect(a.documentId!),
        },
        style: { width: PAGE_WIDTH },
        draggable: false,
      });
    }
    return nodes;
  }, [numPages, visiblePages, annotations, selectedId, onSelect]);

  // Build only visible annotation nodes
  const annotationNodes: Node[] = useMemo(
    () =>
      annotations
        .filter((a) => visiblePages.has(a.page))
        .map((a) => {
          const x =
            CENTER_X +
            (a.type === "text"
              ? -(PAGE_WIDTH / 2 + SIDEBAR_OFFSET)
              : PAGE_WIDTH / 2 + SIDEBAR_OFFSET);
          const y =
            (a.page - 1) * (PAGE_WIDTH * 1.3 + PAGE_GAP) +
            a.y * (PAGE_WIDTH * 1.3);
          return {
            id: a.documentId!,
            type: "annotationNode",
            position: { x, y },
            data: {
              annotation: a,
              selectedId,
              hoveredId,
              onSelect: (id: string) => onSelect(id),
              onHover: (id: string | null) => onHover(id),
              onEdit: (a: Annotation) => {
                /* …floating props… */
              },
            },
            draggable: false,
            selectable: true,
            connectable: false,
            style: {
              width: 200,
              borderRadius: 4,
              ...(selectedId === a.documentId
                ? { boxShadow: "0 0 0 2px purple" }
                : {}),
            },
          };
        }),
    [annotations, visiblePages, selectedId, hoveredId, onSelect, onHover]
  );

  return (
    <div ref={wrapperRef} className="h-full w-full relative">
      <Document
        file={prefixStrapiUrl(pdfUrl)}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        className="w-full h-full"
      >
        <ReactFlow
          nodes={[...pageNodes, ...annotationNodes]}
          edges={[]} // dropped edges
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          style={{ width: "100%", height: "100%" }}
          minZoom={0.01}
          maxZoom={20}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </Document>
      
      {editingId && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-gray-900 p-4 rounded shadow-lg">
            <AnnotationProperties
              annotation={
                annotations.find((a) => a.documentId === editingId) ?? null
              }
              updateAnnotation={async (a) => {
                await updateAnnotation({ id: a.documentId!, ann: a });
                setEditingId(null);
              }}
              deleteAnnotation={async (id) => {
                await deleteAnnotation(id);
                setEditingId(null);
              }}
              saveImage={async () => {}}
              onCancel={() => setEditingId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasPdfFlow;

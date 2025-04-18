// pdfAnnotationContainer.tsx

import React, { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Minus,
} from "lucide-react";

import AnnotationToolbar, { AnnotationMode } from "./annotationToolbar";
import PdfViewerWithAnnotations, { PdfViewerHandle } from "./pdfViewerWithAnnotations";
import AnnotationProperties from "./annotationProperties";
import AnnotationList from "./annotationList";
import AnnotationHoverTooltip from "./annotationHoverTooltip";

import { LiteratureExtended } from "../../types/literatureTypes";
import { Annotation } from "../../types/annotationTypes";
import { useAnnotations } from "../../customHooks/useAnnotations";

const clamp = (val: number, min: number, max: number) =>
  Math.min(Math.max(val, min), max);

interface Props {
  activeLiterature: LiteratureExtended;
}

const PdfAnnotationContainer: React.FC<Props> = ({ activeLiterature }) => {
  const literatureId = activeLiterature.documentId!;
  const pdfVersion = activeLiterature.versions[0];
  const pdfId = pdfVersion?.fileHash ?? "";
  const pdfUrl = pdfVersion?.fileUrl ?? "";

  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [mode, setMode] = useState<AnnotationMode>("none");
  const [singleSelectedId, setSingleSelectedId] = useState<string | null>(null);
  const [multi, setMulti] = useState(false);
  const [multiSet, setMultiSet] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);

  const viewerRef = useRef<PdfViewerHandle>(null);
  const canvasWrap = useRef<HTMLDivElement>(null);

  const {
    annotations,
    isLoading,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
  } = useAnnotations(literatureId);

  const displayAnnotations = useMemo(
    () => annotations.filter((a) => a.pdfId === pdfId),
    [annotations, pdfId]
  );

  const singleSelected = useMemo(
    () =>
      displayAnnotations.find((a) => a.documentId === singleSelectedId) ?? null,
    [displayAnnotations, singleSelectedId]
  );

  const handleAdd = async (ann: Annotation) =>
    createAnnotation({ ...ann, literatureId, pdfId });

  const handleUpdate = async (ann: Annotation) => {
    if (!ann.documentId) return;
    await updateAnnotation({
      id: ann.documentId,
      ann: { ...ann, literatureId, pdfId },
    });
  };

  const handleDelete = async (id: string) => {
    await deleteAnnotation(id);
    setSingleSelectedId(null);
    setMultiSet((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  };

  const handleMassDelete = async () => {
    await Promise.all(Array.from(multiSet).map((id) => deleteAnnotation(id)));
    setMultiSet(new Set());
  };

  const changePage = (offset: number) =>
    setPage((p) => clamp(p + offset, 1, numPages));
  const goToPage = (p: number) => setPage(clamp(p, 1, numPages));
  const zoomIn = () => setZoom((z) => clamp(z + 0.25, 0.25, 4));
  const zoomOut = () => setZoom((z) => clamp(z - 0.25, 0.25, 4));

  const fitWidth = () => {
    const contW = canvasWrap.current?.clientWidth ?? 0;
    const size = viewerRef.current?.getPageSize?.(1);
    if (!contW || !size) return;
    setZoom(clamp(contW / (size.width / zoom), 0.25, 4));
  };

  const fitHeight = () => {
    const contH = canvasWrap.current?.clientHeight ?? 0;
    const size = viewerRef.current?.getPageSize?.(1);
    if (!contH || !size) return;
    setZoom(clamp(contH / (size.height / zoom), 0.25, 4));
  };

  if (isLoading) return <div>Loading annotations …</div>;

  return (
    <div className="flex h-full overflow-hidden">
      <AnnotationToolbar mode={mode} setMode={setMode} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Pagination & Zoom controls */}
        <div className="flex items-center space-x-2 p-2 bg-gray-800 border-b border-gray-700 select-none">
          <button
            onClick={() => goToPage(1)}
            disabled={page === 1}
            title="First page"
            className="p-1 rounded hover:bg-gray-700 disabled:opacity-30"
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            onClick={() => changePage(-1)}
            disabled={page === 1}
            title="Previous page"
            className="p-1 rounded hover:bg-gray-700 disabled:opacity-30"
          >
            <ArrowLeft size={16} />
          </button>

          <input
            type="number"
            value={page}
            min={1}
            max={numPages}
            onChange={(e) => goToPage(Number(e.target.value))}
            className="w-16 text-center bg-gray-900 border border-gray-600 rounded"
          />
          <span>/ {numPages || "-"}</span>

          <button
            onClick={() => changePage(1)}
            disabled={page === numPages}
            title="Next page"
            className="p-1 rounded hover:bg-gray-700 disabled:opacity-30"
          >
            <ArrowRight size={16} />
          </button>
          <button
            onClick={() => goToPage(numPages)}
            disabled={page === numPages}
            title="Last page"
            className="p-1 rounded hover:bg-gray-700 disabled:opacity-30"
          >
            <ChevronsRight size={16} />
          </button>

          <div className="ml-auto flex items-center space-x-1">
            <button
              onClick={zoomOut}
              className="p-1 hover:bg-gray-700 rounded"
              title="Zoom out"
            >
              <Minus size={16} />
            </button>
            <span className="px-2 text-sm w-14 text-center">
              {(zoom * 100).toFixed(0)}%
            </span>
            <button
              onClick={zoomIn}
              className="p-1 hover:bg-gray-700 rounded"
              title="Zoom in"
            >
              <Plus size={16} />
            </button>
            <div className="w-px h-5 mx-2 bg-gray-700" />
            <button
              onClick={fitWidth}
              className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs"
            >
              Fit width
            </button>
            <button
              onClick={fitHeight}
              className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs"
            >
              Fit height
            </button>
          </div>
        </div>

        {/* PDF + Annotations */}
        <div ref={canvasWrap} className="flex-1 relative overflow-auto">
          <PdfViewerWithAnnotations
            ref={viewerRef}
            pdfUrl={pdfUrl}
            zoom={zoom}
            pageNumber={page}
            onLoadSuccess={({ numPages }) => {
              setNumPages(numPages);
              setPage((p) => clamp(p, 1, numPages));
            }}
            annotationMode={mode}
            annotations={showAnnotations ? displayAnnotations : []}
            selectedId={singleSelectedId}
            onCreateAnnotation={handleAdd}
            onSelectAnnotation={(a) => {
              setSingleSelectedId(a.documentId!);
              setPage(a.page);
              setTimeout(() => viewerRef.current?.scrollToAnnotation(a), 0);
            }}
            onHoverAnnotation={(a) => setHoveredId(a ? a.documentId! : null)}
            renderTooltip={(a) => <AnnotationHoverTooltip annotation={a} />}
          />
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-1/4 flex flex-col border-l border-gray-700 overflow-hidden">
        <div className="p-3 flex items-center space-x-2 border-b border-gray-800">
          <button
            onClick={() => setMulti((m) => !m)}
            className={`px-2 py-1 rounded text-sm ${
              multi ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            {multi ? "Single Select" : "Select Multiple"}
          </button>

          {multi && multiSet.size > 0 && (
            <button
              onClick={handleMassDelete}
              className="px-2 py-1 rounded text-sm bg-red-700 hover:bg-red-600"
            >
              Delete All ({multiSet.size})
            </button>
          )}

          <button
            onClick={() => setShowAnnotations((s) => !s)}
            className="ml-auto px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
          >
            {showAnnotations ? "Hide Annotations" : "Show Annotations"}
          </button>
        </div>

        <AnnotationList
          annotations={displayAnnotations}
          selectedId={singleSelectedId}
          hoveredId={hoveredId}
          multi={multi}
          multiSet={multiSet}
          onItemClick={(a) => {
            setSingleSelectedId(a.documentId!);
            setPage(a.page);
            setTimeout(() => viewerRef.current?.scrollToAnnotation(a), 0);
          }}
          onToggleMulti={(a) =>
            setMultiSet((set) => {
              const n = new Set(set);
              n.has(a.documentId!)
                ? n.delete(a.documentId!)
                : n.add(a.documentId!);
              return n;
            })
          }
          onHover={(id) => setHoveredId(id)}
        />

        {!multi && singleSelected && (
          <AnnotationProperties
            annotation={singleSelected}
            updateAnnotation={handleUpdate}
            deleteAnnotation={handleDelete}
            onCancel={() => setSingleSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
};

export default PdfAnnotationContainer;
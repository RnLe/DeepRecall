// pdfAnnotationContainer.tsx
import React, { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronsLeft, ChevronsRight, Plus, Minus } from "lucide-react";

import AnnotationToolbar, { AnnotationMode } from "./annotationToolbar";
import PdfViewerWithAnnotations, { PdfViewerHandle } from "./pdfViewerWithAnnotations";
import AnnotationProperties from "./annotationProperties";

import { LiteratureExtended } from "../../types/literatureTypes";
import { Annotation } from "../../types/annotationTypes";
import { useAnnotations } from "../../customHooks/useAnnotations";

interface Props {
  activeLiterature: LiteratureExtended;
}

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

const PdfAnnotationContainer: React.FC<Props> = ({ activeLiterature }) => {
  /* ----------------------------- KEYS ----------------------------- */
  const literatureId = activeLiterature.documentId!;
  const pdfVersion   = activeLiterature.versions[0];
  const pdfId  = pdfVersion?.fileHash ?? "";
  const pdfUrl = pdfVersion?.fileUrl  ?? "";

  /* --------------------------- STATE ------------------------------ */
  const [zoom, setZoom]         = useState(1);            // 1 == 100 %
  const [page, setPage]         = useState(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [mode, setMode]         = useState<AnnotationMode>("none");
  const [singleSelectedId, setSingleSelectedId] = useState<string | null>(null);
  const [multi, setMulti]                       = useState(false);
  const [multiSet, setMultiSet]                 = useState<Set<string>>(new Set());

  /* ---------------------------  REFS  ----------------------------- */
  const viewerRef   = useRef<PdfViewerHandle>(null);
  const canvasWrap  = useRef<HTMLDivElement>(null);   // for fit width/height

  /* ------------------------- REMOTE DATA -------------------------- */
  const {
    annotations,
    isLoading,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
  } = useAnnotations(literatureId);

  /* --------------------------- FILTER ----------------------------- */
  const displayAnnotations = useMemo(
    () => annotations.filter((a) => a.pdfId === pdfId),
    [annotations, pdfId]
  );

  const singleSelected = useMemo(
    () => displayAnnotations.find((a) => a.documentId === singleSelectedId) ?? null,
    [displayAnnotations, singleSelectedId]
  );

  /* ------------------------ MUTATION WRAPS ------------------------ */
  const handleAdd = async (ann: Annotation) => createAnnotation({ ...ann, literatureId, pdfId });

  const handleUpdate = async (ann: Annotation) => {
    if (!ann.documentId) return;
    await updateAnnotation({ id: ann.documentId, ann: { ...ann, literatureId, pdfId } });
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
    await Promise.all(Array.from(multiSet).map(id => deleteAnnotation(id)));
    setMultiSet(new Set());
  };

  /* --------------------- NAVIGATION + ZOOM ------------------------ */
  const changePage = (offset: number) => setPage((p) => clamp(p + offset, 1, numPages));
  const goToPage   = (p: number)       => setPage(clamp(p, 1, numPages));

  const zoomIn  = () => setZoom((z) => clamp(z + 0.25, 0.25, 4));
  const zoomOut = () => setZoom((z) => clamp(z - 0.25, 0.25, 4));

  /** Fit the first page to container width */
  const fitWidth = () => {
    const contW = canvasWrap.current?.clientWidth ?? 0;
    const size  = viewerRef.current?.getPageSize?.(1);
    if (!contW || !size) return;
    const unscaledW = size.width / zoom; // page width at zoom = 1
    setZoom(clamp(contW / unscaledW, 0.25, 4));
  };

  /** Fit the first page to container height */
  const fitHeight = () => {
    const contH = canvasWrap.current?.clientHeight ?? 0;
    const size  = viewerRef.current?.getPageSize?.(1);
    if (!contH || !size) return;
    const unscaledH = size.height / zoom;
    setZoom(clamp(contH / unscaledH, 0.25, 4));
  };

  /* ----------------------------- UI ------------------------------- */
  if (isLoading) return <div>Loading annotations …</div>;

  return (
    <div className="flex h-full overflow-hidden">
      {/* TOOLBAR */}
      <AnnotationToolbar mode={mode} setMode={setMode} />

      {/* PDF + NAVIGATION COLUMN */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Navigation / zoom bar – top of viewer */}
        <div className="flex items-center space-x-2 p-2 bg-gray-800 border-b border-gray-700 select-none">
          {/* Page navigation */}
          <button onClick={() => goToPage(1)} disabled={page === 1} title="First page" className="p-1 rounded hover:bg-gray-700 disabled:opacity-30">
            <ChevronsLeft size={16} />
          </button>
          <button onClick={() => changePage(-1)} disabled={page === 1} title="Previous page" className="p-1 rounded hover:bg-gray-700 disabled:opacity-30">
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

          <button onClick={() => changePage(1)} disabled={page === numPages} title="Next page" className="p-1 rounded hover:bg-gray-700 disabled:opacity-30">
            <ArrowRight size={16} />
          </button>
          <button onClick={() => goToPage(numPages)} disabled={page === numPages} title="Last page" className="p-1 rounded hover:bg-gray-700 disabled:opacity-30">
            <ChevronsRight size={16} />
          </button>

          {/* ZOOM / FIT – right aligned */}
          <div className="ml-auto flex items-center space-x-1">
            <button onClick={zoomOut} className="p-1 hover:bg-gray-700 rounded" title="Zoom out">
              <Minus size={16} />
            </button>
            <span className="px-2 text-sm w-14 text-center">{(zoom * 100).toFixed(0)}%</span>
            <button onClick={zoomIn} className="p-1 hover:bg-gray-700 rounded" title="Zoom in">
              <Plus size={16} />
            </button>
            <div className="w-px h-5 mx-2 bg-gray-700" />
            <button onClick={fitWidth}  className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs">Fit&nbsp;width</button>
            <button onClick={fitHeight} className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs">Fit&nbsp;height</button>
          </div>
        </div>

        {/* Actual PDF viewer */}
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
            annotations={displayAnnotations}
            selectedId={singleSelectedId}
            onCreateAnnotation={handleAdd}
            onSelectAnnotation={(a) => {
              setSingleSelectedId(a.documentId!);
              setPage(a.page);
              viewerRef.current?.scrollToPage(a.page);
            }}
          />
        </div>
      </div>

      {/* SIDEBAR – list + properties */}
      <div className="w-1/4 flex flex-col border-l border-gray-700 overflow-hidden">
        {/* controls */}
        <div className="p-3 flex items-center space-x-2 border-b border-gray-800">
          <button onClick={() => setMulti((m) => !m)} className={`px-2 py-1 rounded text-sm ${multi ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"}`}>
            {multi ? "Single Select" : "Select Multiple"}
          </button>

          {multi && multiSet.size > 0 && (
            <button onClick={handleMassDelete} className="px-2 py-1 rounded text-sm bg-red-700 hover:bg-red-600 ml-auto">
              Delete All ({multiSet.size})
            </button>
          )}
        </div>

        {/* list */}
        <ul className="flex-1 overflow-y-auto divide-y divide-gray-800">
          {displayAnnotations.map((a) => {
            const isChecked = multiSet.has(a.documentId!);
            const isActive  = singleSelectedId === a.documentId;

            const toggleMulti = () => setMultiSet((set) => {
              const n = new Set(set);
              n.has(a.documentId!) ? n.delete(a.documentId!) : n.add(a.documentId!);
              return n;
            });

            return (
              <li
                key={a.documentId}
                className={`px-3 py-1 flex items-center space-x-2 cursor-pointer ${isActive ? "bg-gray-700" : ""}`}
                onClick={() => {
                  if (multi) {
                    toggleMulti();
                  } else {
                    setSingleSelectedId(a.documentId!);
                    setPage(a.page);
                    viewerRef.current?.scrollToPage(a.page);
                  }
                }}
              >
                {multi && (isChecked ? <span className="text-blue-500">●</span> : <span className="text-gray-600">○</span>)}
                <span className="flex-1 truncate">
                  {a.type === "rectangle" ? a.annotationKind : "Highlight"} – p.{a.page}
                </span>
              </li>
            );
          })}
        </ul>

        {!multi && (
          <AnnotationProperties annotation={singleSelected} updateAnnotation={handleUpdate} deleteAnnotation={handleDelete} />
        )}
      </div>
    </div>
  );
};

export default PdfAnnotationContainer;

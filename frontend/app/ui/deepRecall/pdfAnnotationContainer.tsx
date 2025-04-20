import React, { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Minus,
  Eye,
  EyeOff,
} from "lucide-react";

import PdfViewerWithAnnotations, { PdfViewerHandle } from "./pdfViewerWithAnnotations";
import RightSidebar from "./layout/RightSidebar";
import AnnotationHoverTooltip from "./annotationHoverTooltip";

import { LiteratureExtended } from "../../types/literatureTypes";
import { Annotation, RectangleAnnotation } from "../../types/annotationTypes";
import { useAnnotations } from "../../customHooks/useAnnotations";
import { uploadFile, deleteFile } from "../../api/uploadFile";
import { AnnotationMode } from "./annotationToolbar";
import { AnnotationType } from "../../types/annotationTypes";

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

type ColorMap = Record<AnnotationType, string>;

interface Props {
  activeLiterature: LiteratureExtended;
  annotationMode: AnnotationMode;
  colorMap: ColorMap;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const PdfAnnotationContainer: React.FC<Props> = ({
  activeLiterature,
  annotationMode,
  colorMap,
  sidebarOpen,
  onToggleSidebar,
}) => {
  const litId = activeLiterature.documentId!;
  const version = activeLiterature.versions[0];
  const pdfId = version.fileHash ?? "";
  const pdfUrl = version.fileUrl ?? "";

  // viewer state
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const deselectAll = () => setMultiSet(new Set());

  const viewerRef = useRef<PdfViewerHandle>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // annotation state
  const {
    annotations,
    isLoading,
    createAnnotation,
    updateAnnotation: mutateUpdate,
    deleteAnnotation: mutateDelete,
  } = useAnnotations(litId, pdfId);

  const display = useMemo(
    () => annotations.filter((a) => a.pdfId === pdfId),
    [annotations, pdfId]
  );

  const [selId, setSelId] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [multi, setMulti] = useState(false);
  const [multiSet, setMultiSet] = useState<Set<string>>(new Set());

  const selected = useMemo(
    () => display.find((a) => a.documentId === selId) ?? null,
    [display, selId]
  );

  // --- annotation actions ---
  const handleAdd = async (ann: Annotation) => {
    await createAnnotation({ ...ann, literatureId: litId, pdfId });
  };
  const handleUpdate = async (ann: Annotation) => {
    if (!ann.documentId) return;
    await mutateUpdate({ id: ann.documentId, ann: { ...ann, literatureId: litId, pdfId } });
  };
  const handleDelete = async (id: string) => {
    const ann = display.find((x) => x.documentId === id);
    if (ann?.extra?.imageFileId) {
      try { await deleteFile(ann.extra.imageFileId); } catch {}
    }
    await mutateDelete(id);
    setSelId(null);
    setMultiSet((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  };
  const handleMassDelete = async () => {
    for (const id of Array.from(multiSet)) {
      const ann = display.find((x) => x.documentId === id);
      if (ann?.extra?.imageFileId) {
        try { await deleteFile(ann.extra.imageFileId); } catch {}
      }
      await mutateDelete(id);
    }
    setMultiSet(new Set());
  };
  const handleSaveImage = async (a: RectangleAnnotation) => {
    try {
      const blob = await viewerRef.current!.getCroppedImage(a);
      const file = new File([blob], `ann-${a.documentId}.png`, {
        type: "image/png",
      });
      const { id: fid, url } = await uploadFile(file);
      await handleUpdate({
        ...a,
        extra: { ...(a.extra || {}), imageUrl: url, imageFileId: fid },
      });
    } catch {}
  };

  // --- multi‑select helpers ---
  const toggleMultiMode = () => setMulti((m) => !m);
  const selectAll = () =>
    setMultiSet(new Set(display.map((a) => a.documentId!)));

  // --- navigation & zoom ---
  // centralised page jump: updates state *and* scrolls viewer
  const jumpToPage = (n: number) => {
      const target = clamp(n, 1, numPages);
      setPage(target);
      viewerRef.current?.scrollToPage(target);
    };
  
  const changePage = (delta: number) => jumpToPage(page + delta);
  const goToPage    = (n: number)    => jumpToPage(n);

  const zoomIn = () => setZoom((z) => z + 0.1);
  const zoomOut = () => setZoom((z) => Math.max(0.1, z - 0.1));

  const fitWidth = () => {
    if (viewerRef.current && wrapRef.current) {
      const size = viewerRef.current.getPageSize(page);
      if (size) {
        setZoom(wrapRef.current.clientWidth / size.width);
        // ensure the canvas stays on the same page
        viewerRef.current?.scrollToPage(page);
      }
    }
  };
  const fitHeight = () => {
    if (viewerRef.current && wrapRef.current) {
      const size = viewerRef.current.getPageSize(page);
      if (size) {
        setZoom(wrapRef.current.clientHeight / size.height);
        // ensure the canvas stays on the same page
        viewerRef.current?.scrollToPage(page);
      }
    }
  };

  // open‑icon handlers
  const openSideAndSelect = (a: Annotation) => {
    setSelId(a.documentId!);
    if (!sidebarOpen) onToggleSidebar();
  };
  const handleOpenTags = (a: Annotation) => openSideAndSelect(a);
  const handleOpenNotes = (a: Annotation) => openSideAndSelect(a);
  const handleOpenDescription = (a: Annotation) => openSideAndSelect(a);
  const handleOpenImage = (a: Annotation) => openSideAndSelect(a);
  const handleOpenSolutions = (a: Annotation) => openSideAndSelect(a);

  if (isLoading) return <div>Loading…</div>;

  return (
    <div className="flex h-full overflow-hidden">
      {/* PDF + nav */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Pagination & Zoom */}
        <div className="flex items-center p-2 bg-gray-800 border-b border-gray-700 select-none">
          {/* left: empty or other controls */}
          <div className="w-8" />  {/* maintain spacing */}

          {/* center: page navigation */}
          <div className="flex-1 flex items-center justify-center space-x-2">
            {[{ type: "button", Icon: ChevronsLeft, onClick: () => goToPage(1), disabled: page===1 },
              { type: "button", Icon: ArrowLeft,  onClick: () => changePage(-1), disabled: page===1 },
              { type: "input" },
              { type: "button", Icon: ArrowRight, onClick: () => changePage(1), disabled: page===numPages },
              { type: "button", Icon: ChevronsRight,onClick: () => goToPage(numPages), disabled: page===numPages },
            ].map((btn, i) =>
              btn.type === "input" ? (
                <React.Fragment key="page-input">
                  <input
                    type="number"
                    value={page}
                    min={1}
                    max={numPages}
                    onChange={(e) => jumpToPage(Number(e.target.value))}
                    className="w-16 text-center bg-gray-900 border border-gray-600 rounded"
                  />
                  <span>/ {numPages || "-"}</span>
                </React.Fragment>
              ) : (
                <button
                  key={i}
                  onClick={btn.onClick}
                  disabled={btn.disabled}
                  className="p-1"
                >
                  {btn.Icon && React.createElement(btn.Icon, {
                    size: 16,
                    className: "text-gray-400 hover:text-white transition-colors",
                  })}
                </button>
              )
            )}
          </div>

          {/* right: zoom controls + percentage + fit */}
          <div className="flex items-center space-x-2">
            <button onClick={zoomOut}>
              <Minus size={16} className="text-gray-400 hover:text-white transition-colors" />
            </button>
            <span className="px-2 text-sm w-14 text-center">
              {(zoom * 100).toFixed(0)}%
            </span>
            <button onClick={zoomIn}>
              <Plus size={16} className="text-gray-400 hover:text-white transition-colors" />
            </button>
            <button
              onClick={fitWidth}
              className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm hover:bg-gray-700"
            >
              Fit width
            </button>
            <button
              onClick={fitHeight}
              className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm hover:bg-gray-700"
            >
              Fit height
            </button>
          </div>
        </div>

        {/* PDF viewer */}
        <div className="flex-1 relative overflow-auto" ref={wrapRef}>
          <PdfViewerWithAnnotations
            ref={viewerRef}
            pdfUrl={pdfUrl}
            zoom={zoom}
            pageNumber={page}
            onLoadSuccess={({ numPages }) => {
              setNumPages(numPages);
              setPage((p) => clamp(p, 1, numPages));
            }}
            onVisiblePageChange={(pg) => {
              /* avoid feedback‑loop: update only if user *scrolled* */
              setPage((cur) => (cur === pg ? cur : pg));
            }}
            annotationMode={annotationMode}
            annotations={showAnnotations ? display : []}
            selectedId={selId}
            onCreateAnnotation={handleAdd}
            onSelectAnnotation={(a) => {
                if (a) {
                  setSelId(a.documentId!);
                  setPage(a.page);
                  /* auto‑open sidebar when an annotation is clicked */
                  if (!sidebarOpen) onToggleSidebar();
                } else {
                  /* clicked void → deselect */
                  setSelId(null);
                }
            }}
            onHoverAnnotation={(a) => setHovered(a?.documentId || null)}
            renderTooltip={(a) => <AnnotationHoverTooltip annotation={a} />}
            resolution={4}
            colorMap={colorMap}
          />
        </div>
      </div>

      {/* right sidebar */}
      <RightSidebar
        annotations={display}
        selectedId={selId}
        hoveredId={hovered}
        multi={multi}
        multiSet={multiSet}
        onItemClick={(a) => {
          setSelId(a.documentId!);
          setPage(a.page);
          setTimeout(() => viewerRef.current?.scrollToPage(a.page), 0);
        }}
        onToggleMulti={(a) =>
          setMultiSet((s) => {
            const n = new Set(s);
            n.has(a.documentId!)
              ? n.delete(a.documentId!)
              : n.add(a.documentId!);
            return n;
          })
        }
        onHover={(id) => setHovered(id)}
        onMassDelete={handleMassDelete}
        show={showAnnotations}
        onToggleShow={() => setShowAnnotations((s) => !s)}
        onToggleMultiMode={toggleMultiMode}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        updateAnnotation={handleUpdate}
        deleteAnnotation={handleDelete}
        saveImage={handleSaveImage}
        selected={selected}
        onCancelSelect={() => setSelId(null)}
        colorMap={colorMap}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
        onOpenTags={handleOpenTags}
        onOpenNotes={handleOpenNotes}
        onOpenDescription={handleOpenDescription}
        onOpenImage={handleOpenImage}
        onOpenSolutions={handleOpenSolutions}
      />
    </div>
  );
};

export default PdfAnnotationContainer;

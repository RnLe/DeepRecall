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
import RightSidebar from "./layout/RightSideBar";
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
}

const PdfAnnotationContainer: React.FC<Props> = ({
  activeLiterature,
  annotationMode,
  colorMap,
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

  const viewerRef = useRef<PdfViewerHandle>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // annotation state
  const {
    annotations,
    isLoading,
    createAnnotation,
    updateAnnotation: mutateUpdate,
    deleteAnnotation: mutateDelete,
  } = useAnnotations(litId);

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
  const changePage = (delta: number) =>
    setPage((p) => clamp(p + delta, 1, numPages));
  const goToPage = (n: number) => setPage(clamp(n, 1, numPages));
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

  if (isLoading) return <div>Loading…</div>;

  return (
    <div className="flex h-full overflow-hidden">
      {/* PDF + nav */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Pagination & Zoom */}
        <div className="flex items-center space-x-2 p-2 bg-gray-800 border-b border-gray-700 select-none">
          {[{ type: "button", Icon: ChevronsLeft, onClick: () => goToPage(1), disabled: page===1 },
            { type: "button", Icon: ArrowLeft, onClick: () => changePage(-1), disabled: page===1 },
            { type: "input" },
            { type: "button", Icon: ArrowRight, onClick: () => changePage(1), disabled: page===numPages },
            { type: "button", Icon: ChevronsRight, onClick: () => goToPage(numPages), disabled: page===numPages },
          ].map((btn, i) =>
            btn.type === "input" ? (
              <React.Fragment key="page-input">
                <input
                  type="number"
                  value={page}
                  min={1}
                  max={numPages}
                  onChange={(e) => goToPage(Number(e.target.value))}
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
                {btn.Icon &&
                  React.createElement(btn.Icon, {
                    size: 16,
                    className: "text-gray-400 hover:text-white transition-colors",
                  })}
              </button>
            )
          )}

          <div className="ml-auto flex items-center space-x-1">
            <button onClick={zoomOut}>
              <Minus size={16} className="text-gray-400 hover:text-white transition-colors" />
            </button>
            <span className="px-2 text-sm w-14 text-center">
              {(zoom * 100).toFixed(0)}%
            </span>
            <button onClick={zoomIn}>
              <Plus size={16} className="text-gray-400 hover:text-white transition-colors" />
            </button>
            <div className="w-px h-5 mx-2 bg-gray-700" />
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
            annotationMode={annotationMode}
            annotations={showAnnotations ? display : []}
            selectedId={selId}
            onCreateAnnotation={handleAdd}
            onSelectAnnotation={(a) => {
              setSelId(a.documentId!);
              setPage(a.page);
              setTimeout(() => viewerRef.current?.scrollToPage(a.page), 0);
            }}
            onHoverAnnotation={(a) => setHovered(a?.documentId || null)}
            renderTooltip={(a) => (
              <AnnotationHoverTooltip annotation={a} />
            )}
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
        updateAnnotation={handleUpdate}
        deleteAnnotation={handleDelete}
        saveImage={handleSaveImage}
        selected={selected}
        onCancelSelect={() => setSelId(null)}
        colorMap={colorMap}
      />
    </div>
  );
};

export default PdfAnnotationContainer;

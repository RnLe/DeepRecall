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
import { Annotation, RectangleAnnotation } from "../../types/annotationTypes";
import { useAnnotations } from "../../customHooks/useAnnotations";
import { uploadFile, deleteFile } from "../../api/uploadFile";

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

interface Props {
  activeLiterature: LiteratureExtended;
}

const PdfAnnotationContainer: React.FC<Props> = ({ activeLiterature }) => {
  const litId = activeLiterature.documentId!;
  const version = activeLiterature.versions[0];
  const pdfId = version.fileHash ?? "";
  const pdfUrl = version.fileUrl ?? "";

  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [mode, setMode] = useState<AnnotationMode>("none");
  const [selId, setSelId] = useState<string | null>(null);
  const [multi, setMulti] = useState(false);
  const [multiSet, setMultiSet] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<string | null>(null);
  const [show, setShow] = useState(true);

  const viewerRef = useRef<PdfViewerHandle>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Set the resolution for the PDF rendering
  const resolution = 4;

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

  const selected = useMemo(
    () => display.find((a) => a.documentId === selId) ?? null,
    [display, selId]
  );

  // create
  const handleAdd = async (ann: Annotation): Promise<void> => {
    await createAnnotation({ ...ann, literatureId: litId, pdfId });
  };

  // update (wraps mutateUpdate to match (a)=>Promise<void>)
  const handleUpdate = async (ann: Annotation): Promise<void> => {
    if (!ann.documentId) return;
    await mutateUpdate({ id: ann.documentId, ann: { ...ann, literatureId: litId, pdfId } });
  };

  // delete one (cleanup file first, but never bail)
  const handleDelete = async (id: string): Promise<void> => {
    const ann = display.find((x) => x.documentId === id);
    if (ann?.extra?.imageFileId
    ) {
      try {
        await deleteFile(ann.extra.imageFileId);
      } catch (err) {
        console.error("Failed to delete file, continuing:", err);
      }
    }
    await mutateDelete(id);
    setSelId(null);
    setMultiSet((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  };

  // delete many
  const handleMassDelete = async (): Promise<void> => {
    for (const id of Array.from(multiSet)) {
      const ann = display.find((x) => x.documentId === id);
      if (ann?.extra?.imageFileId) {
        try {
          await deleteFile(ann.extra.imageFileId);
        } catch (err) {
          console.error("Failed to delete file for", id, err);
        }
      }
      await mutateDelete(id);
    }
    setMultiSet(new Set());
  };

  // crop, upload, then update annotation metadata
  const handleSaveImage = async (a: RectangleAnnotation): Promise<void> => {
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
  
    } catch (err) {
    }
  };
  

  // add navigation & zoom handlers
  const changePage = (delta: number) =>
    setPage((p) => clamp(p + delta, 1, numPages));
  const goToPage = (n: number) => setPage(clamp(n, 1, numPages));
  const zoomIn = () => setZoom((z) => z + 0.1);
  const zoomOut = () => setZoom((z) => Math.max(0.1, z - 0.1));
  const fitWidth = () => {
    if (viewerRef.current && wrapRef.current) {
      const size = viewerRef.current.getPageSize(page);
      if (size)
        setZoom(wrapRef.current.clientWidth / size.width);
    }
  };
  const fitHeight = () => {
    if (viewerRef.current && wrapRef.current) {
      const size = viewerRef.current.getPageSize(page);
      if (size)
        setZoom(wrapRef.current.clientHeight / size.height);
    }
  };

  if (isLoading) return <div>Loading…</div>;

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
            annotationMode={mode}
            annotations={show ? display : []}
            selectedId={selId}
            onCreateAnnotation={(a) => handleAdd(a)}
            onSelectAnnotation={(a) => {
              setSelId(a.documentId!);
              setPage(a.page);
              setTimeout(() => viewerRef.current?.scrollToPage(a.page), 0);
            }}
            onHoverAnnotation={(a) => setHovered(a?.documentId || null)}
            renderTooltip={(a) => <AnnotationHoverTooltip annotation={a} />}
            resolution={resolution}
          />
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-1/4 flex flex-col border-l border-gray-700 overflow-hidden">
        {/* Controls */}
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
            onClick={() => setShow((s) => !s)}
            className="ml-auto px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
          >
            {show ? "Hide Annotations" : "Show Annotations"}
          </button>
        </div>

        {/* List */}
        <AnnotationList
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
        />

        {/* Properties */}
        {!multi && selected && (
          <AnnotationProperties
            annotation={selected}
            updateAnnotation={handleUpdate}
            deleteAnnotation={handleDelete}
            saveImage={handleSaveImage}
            onCancel={() => setSelId(null)}
          />
        )}
      </div>
    </div>
  );
};

export default PdfAnnotationContainer;
// -----------------------------------------------
// Imports: React, icons, components, hooks, types, APIs
// -----------------------------------------------
import React, { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Minus,
} from "lucide-react";

import PdfViewerWithAnnotations, { PdfViewerHandle } from "./PdfViewerWithAnnotations";
import RightSidebar from "../editorView/RightSidebar";
import AnnotationHoverTooltip from "../annotationHoverTooltip";
import MarkdownEditorModal from "../MarkdownEditorModal";

import { LiteratureExtended } from "../../../types/deepRecall/strapi/literatureTypes";
import { AIResponse, Annotation } from "../../../types/deepRecall/strapi/annotationTypes";
import { useAnnotations } from "../../../customHooks/useAnnotations";
import { uploadFile, deleteFile } from "../../../api/uploadFile";
import { AnnotationMode } from "../annotationToolbar";
import { AnnotationType } from "../../../types/deepRecall/strapi/annotationTypes";
import { prefixStrapiUrl } from "@/app/helpers/getStrapiMedia";

import { AiTasks, AiTaskKey, fieldByTask } from "@/app/api/openAI/promptTypes";
import MarkdownResponseModal from "../MarkdownResponseModal";
import { executeOpenAIRequest } from "@/app/api/openAI/openAIService";

// -----------------------------------------------
// Type & Utility Definitions
// -----------------------------------------------
// Clamp a value between min and max
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

type ColorMap = Record<AnnotationType, string>;

interface Props {
  activeLiterature: LiteratureExtended;
  annotationMode: AnnotationMode;
  colorMap: ColorMap;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  setAnnotationMode: (mode: AnnotationMode) => void;
}

// -----------------------------------------------
// Main Component: PdfAnnotationContainer
// -----------------------------------------------
const TabWindowContainer: React.FC<Props> = ({
  activeLiterature,
  annotationMode,
  colorMap,
  sidebarOpen,
  onToggleSidebar,
  setAnnotationMode,
}) => {
  // -----------------------------------------------
  // Derived constants from props & literature
  // -----------------------------------------------
  const litId = activeLiterature.documentId!;              // Unique literature identifier
  const version = activeLiterature.versions[0];            // Use first version
  const pdfId = version.fileHash ?? "";                  // File hash for annotations
  const pdfUrl = version.fileUrl ?? "";                  // PDF source URL

  // -----------------------------------------------
  // Viewer References
  // -----------------------------------------------
  const viewerRef = useRef<PdfViewerHandle>(null);         // Ref to PDF viewer instance
  const wrapRef = useRef<HTMLDivElement>(null);            // Ref to container for fit calculations

  // -----------------------------------------------
  // Viewer State: zoom, pagination, annotations toggle
  // -----------------------------------------------
  const [zoom, setZoom] = useState(1);                     // Current zoom level
  const [page, setPage] = useState(1);                     // Current page number
  const [numPages, setNumPages] = useState(0);             // Total pages in PDF
  const [showAnnotations, setShowAnnotations] = useState(true); // Toggle annotation display

  // -----------------------------------------------
  // Annotation Data & State via custom hook
  // -----------------------------------------------
  const {
    annotations,
    isLoading,
    createAnnotation,
    updateAnnotation: mutateUpdate,
    deleteAnnotation: mutateDelete,
  } = useAnnotations(litId, pdfId);

  // Modal & Preview States for description, notes, and images
  const [descriptionModalAnn, setDescriptionModalAnn] = useState<Annotation | null>(null);
  const [notesModalAnn,       setNotesModalAnn]       = useState<Annotation | null>(null);
  const [previewAnnImageUrl,  setPreviewAnnImageUrl]  = useState<string | null>(null);
  const [previewSolImageUrl,  setPreviewSolImageUrl]  = useState<string | null>(null);

  // Selection & Hover State
  const [selId,    setSelId]    = useState<string | null>(null);  // Currently selected annotation ID
  const [hovered,  setHovered]  = useState<string | null>(null);  // Currently hovered annotation ID

  // Multi-select state
  const [multi,    setMulti]    = useState(false);                // Multi-select mode on/off
  const [multiSet, setMultiSet] = useState<Set<string>>(new Set()); // Set of selected IDs

  // Derived: selected annotation object
  const selected = useMemo(
    () => annotations.find((a) => a.documentId === selId) ?? null,
    [annotations, selId]
  );

  // -----------------------------------------------
  // Annotation Action Handlers
  // -----------------------------------------------
  // Add a new annotation
  const handleAdd = async (ann: Annotation) => {
    await createAnnotation({ ...ann, literatureId: litId, pdfId });
  };

  // Update an existing annotation
  const handleUpdate = async (ann: Annotation) => {
    if (!ann.documentId) return;
    await mutateUpdate({ documentId: ann.documentId, ann: { ...ann, literatureId: litId, pdfId } });
  };

  // Delete a single annotation (and its image file, if present)
  const handleDelete = async (id: string) => {
    const ann = annotations.find((x) => x.documentId === id);
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

  // Delete all annotations currently in multi-select set
  const handleMassDelete = async () => {
    if (!multiSet.size) return;
    if (!confirm("Are you sure you want to delete all selected annotations? This action cannot be undone.")) {
      return;
    }
    for (const id of Array.from(multiSet)) {
      const ann = annotations.find((x) => x.documentId === id);
      if (ann?.extra?.imageFileId) {
        try { await deleteFile(ann.extra.imageFileId); } catch {}
      }
      await mutateDelete(id);
    }
    setMultiSet(new Set());
  };

  // Capture and save an image of a rectangular annotation
  const handleSaveImage = async (a: Annotation) => {
    try {
      const blob = await viewerRef.current!.getCroppedImage(a);
      const file = new File([blob], `ann-${a.documentId}.png`, { type: "image/png" });
      const { id: fid, url } = await uploadFile(file);
      await handleUpdate({
        ...a,
        extra: { ...(a.extra || {}), imageUrl: url, imageFileId: fid },
      });
    } catch {}
  };

  // -----------------------------------------------
  // Multi-Select Helpers
  // -----------------------------------------------
  const toggleMultiMode = () => setMulti((m) => !m); // Toggle multi-select mode
  const selectAll      = () => setMultiSet(new Set(annotations.map((a) => a.documentId!))); // Select all annotations
  const deselectAll    = () => setMultiSet(new Set());      // Deselect all annotations

  // -----------------------------------------------
  // Navigation & Zoom Handlers
  // -----------------------------------------------
  // Jump to a valid page number and scroll viewer
  const jumpToPage = (n: number) => {
    const target = clamp(n, 1, numPages);
    setPage(target);
    viewerRef.current?.scrollToPage(target);
  };

  const changePage = (delta: number) => jumpToPage(page + delta); // Increment/decrement page
  const goToPage    = (n: number)    => jumpToPage(n);            // Direct jump

  const zoomIn      = () => setZoom((z) => z + 0.1);              // Increase zoom
  const zoomOut     = () => setZoom((z) => Math.max(0.1, z - 0.1)); // Decrease zoom

  // Fit PDF to container width
  const fitWidth = () => {
    if (viewerRef.current && wrapRef.current) {
      const size = viewerRef.current.getPageSize(page);
      if (size) {
        setZoom(wrapRef.current.clientWidth / size.width);
        viewerRef.current?.scrollToPage(page); // Keep page position
      }
    }
  };

  // Fit PDF to container height
  const fitHeight = () => {
    if (viewerRef.current && wrapRef.current) {
      const size = viewerRef.current.getPageSize(page);
      if (size) {
        setZoom(wrapRef.current.clientHeight / size.height);
        viewerRef.current?.scrollToPage(page); // Keep page position
      }
    }
  };

  // -----------------------------------------------
  // Sidebar & Modal Open Handlers
  // -----------------------------------------------
  // Select annotation and open sidebar if closed
  const openSideAndSelect    = (a: Annotation) => {
    setSelId(a.documentId!);
    if (!sidebarOpen) onToggleSidebar();
  };
  const handleOpenDescription = (a: Annotation) => setDescriptionModalAnn(a); // Open description editor
  const handleOpenNotes       = (a: Annotation) => setNotesModalAnn(a);       // Open notes editor
  const handleOpenImage       = (a: Annotation) => {
    if (a.extra?.imageUrl) setPreviewAnnImageUrl(prefixStrapiUrl(a.extra.imageUrl));
  };
  const handleOpenSolutions   = (a: Annotation) => {
    if (a.solutions?.length) {
      const last = a.solutions[a.solutions.length - 1];
      setPreviewSolImageUrl(prefixStrapiUrl(last.fileUrl));
    }
  };
  const handleOpenTags        = (_: Annotation) => {}; // Placeholder for future tag handling

  const handleSelectAnnotation = (a: Annotation | null) => {
    if (!a) {
      setSelId(null);
      return;
    }
    // clicked same annotation → just toggle sidebar
    if (selId === a.documentId) {
      onToggleSidebar();
      return;
    }
    // new annotation → select, scroll, and open sidebar if needed
    setSelId(a.documentId!);
    setPage(a.page);
    if (!sidebarOpen) onToggleSidebar();
  };

  // Ai handling
  const [aiModal, setAiModal] = useState<{title:string; markdown?:string}|null>(null);

  const handleAiTask = async (ann: Annotation, taskKey: AiTaskKey) => {
    // 1. open modal immediately with skeleton
    setAiModal({ title: AiTasks[taskKey].name });
  
    try {
      // 2. crop the region → File
      const blob    = await viewerRef.current!.getCroppedImage(ann);
      const imgFile = new File([blob], "clip.png", { type: "image/png" });
  
      // 3. pick the promptKey & model out of AiTasks
      const { promptKey, defaultModel } = AiTasks[taskKey];
  
      // 4. call OpenAI with exactly (promptKey, model, images)
      const md = await executeOpenAIRequest(
        promptKey,
        defaultModel,
        [imgFile]
      );
  
      // 5. update annotation field
      const field = fieldByTask[taskKey];
      const newAiResponse = {
        text: md,
        createdAt: new Date().toISOString(),
        model: defaultModel,
      };
      const updated: Annotation = {
        ...ann,
        [field]: [...((ann[field] as AIResponse[]) ?? []), newAiResponse],
      };
      await handleUpdate(updated);
  
      // 6. show markdown
      setAiModal({
        title:    AiTasks[taskKey].name,
        markdown: md
      });
    } catch (err) {
      setAiModal({ title: "Error", markdown: (err as Error).message });
    }
  };


  // -----------------------------------------------
  // Render: Loading State
  // -----------------------------------------------
  if (isLoading) return <div>Loading…</div>;

  // -----------------------------------------------
  // Render: Main Layout
  // -----------------------------------------------
  return (
    <div className="flex h-full overflow-hidden">
      {/* ------------------------------------------- */}
      {/* Left Panel: PDF Viewer + Navigation Controls */}
      {/* ------------------------------------------- */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* -------------------------------------------------------------------- */}
        {/* PDF Pagination & Zoom Controls: navigation buttons, page input, zoom */}
        {/* -------------------------------------------------------------------- */}
        <div className="flex items-center p-2 bg-gray-800 border-b border-gray-700 select-none">
          <div className="w-8" /> {/* Spacer for left-aligned items */}

          {/* Center controls: first, prev, page input, next, last */}
          <div className="flex-1 flex items-center justify-center space-x-2">
            {[
              { type: "button", Icon: ChevronsLeft, onClick: () => goToPage(1), disabled: page === 1 },
              { type: "button", Icon: ArrowLeft,    onClick: () => changePage(-1), disabled: page === 1 },
              { type: "input" },
              { type: "button", Icon: ArrowRight,   onClick: () => changePage(1), disabled: page === numPages },
              { type: "button", Icon: ChevronsRight,onClick: () => goToPage(numPages), disabled: page === numPages },
            ].map((btn, i) =>
              btn.type === "input" ? (
                <React.Fragment key="page-input">
                  <input
                    type="number"
                    value={page}
                    min={1}
                    max={numPages}
                    onChange={(e) => jumpToPage(Number(e.target.value))}
                    className="w-16 text-center bg-gray-900 text-white border border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-gray-700"
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

          {/* Right controls: zoom out/in, percentage, fit width/height */}
          <div className="flex items-center space-x-2">
            <button onClick={zoomOut}>
              <Minus size={16} className="text-gray-400 hover:text-white transition-colors" />
            </button>
            <span className="px-2 text-sm w-14 text-center">{(zoom * 100).toFixed(0)}%</span>
            <button onClick={zoomIn}>
              <Plus size={16} className="text-gray-400 hover:text-white transition-colors" />
            </button>
            <button onClick={fitWidth} className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm hover:bg-gray-700">
              Fit width
            </button>
            <button onClick={fitHeight} className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm hover:bg-gray-700">
              Fit height
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------- */}
        {/* PDF Viewer: renders pages, annotations, tool interactions */}
        {/* ------------------------------------------------------- */}
        <div className="flex-1 relative overflow-auto" ref={wrapRef}>
          <PdfViewerWithAnnotations
            ref={viewerRef}
            pdfUrl={pdfUrl}
            zoom={zoom}
            onLoadSuccess={({ numPages }) => {
              setNumPages(numPages);
              setPage((p) => clamp(p, 1, numPages));
            }}
            onVisiblePageChange={(pg) => {
              // always sync page state when scroll changes visible page
              setPage(pg);
            }}
            annotationMode={annotationMode}
            annotations={showAnnotations ? annotations : []}
            selectedId={selId}
            onCreateAnnotation={handleAdd}
            onSelectAnnotation={(a) => {
              if (a) {
                setSelId(a.documentId!);
                setPage(a.page);
                // Auto-open sidebar when an annotation is clicked
                if (!sidebarOpen) onToggleSidebar();
              } else {
                setSelId(null); // Deselect on void click
              }
            }}
            onHoverAnnotation={(a) => setHovered(a?.documentId || null)}
            renderTooltip={(a) => <AnnotationHoverTooltip annotation={a} />}
            resolution={4}
            colorMap={colorMap}
            onToolUsed={() => setAnnotationMode("none")} // Exit annotation mode on use
            handleAiTask={handleAiTask}
          />
        </div>
      </div>

      {/* ------------------------------------------- */}
      {/* Right Sidebar: annotation list & controls */}
      {/* ------------------------------------------- */}
      <RightSidebar
        annotations={annotations}
        selectedId={selId}
        hoveredId={hovered}
        multi={multi}
        multiSet={multiSet}
        onItemClick={(a) => {
          // reuse the same logic
          handleSelectAnnotation(a);
          // then scroll
          setTimeout(() => viewerRef.current?.scrollToPage(a.page), 0);
        }}
        onToggleMulti={(a) =>
          setMultiSet((s) => {
            const n = new Set(s);
            n.has(a.documentId!) ? n.delete(a.documentId!) : n.add(a.documentId!);
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
        fileOpen={true} // Prop to enable file attachments
      />

      {/* ----------------------------------------------- */}
      {/* Modals & Previews: description, notes, images */}
      {/* ----------------------------------------------- */}
      {/* Description Editor Modal */}
      {descriptionModalAnn && (
        <MarkdownEditorModal
          initial={descriptionModalAnn.description || ""}
          onSave={async (md) => {
            await handleUpdate({ ...descriptionModalAnn, description: md });
            setDescriptionModalAnn(null);
          }}
          onClose={() => setDescriptionModalAnn(null)}
          annotation={descriptionModalAnn}
          objectName="Description"
          colorMap={colorMap}
          startInPreview={true}
        />
      )}

      {/* Notes Editor Modal */}
      {notesModalAnn && (
        <MarkdownEditorModal
          initial={notesModalAnn.notes || ""}
          onSave={async (md) => {
            await handleUpdate({ ...notesModalAnn, notes: md });
            setNotesModalAnn(null);
          }}
          onClose={() => setNotesModalAnn(null)}
          annotation={notesModalAnn}
          objectName="Notes"
          colorMap={colorMap}
          startInPreview={true}
        />
      )}

      {/* Annotation Image Preview */}
      {previewAnnImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setPreviewAnnImageUrl(null)}
        >
          <div
            className="bg-gray-900 p-4 max-w-[90vw] max-h-[90vh] overflow-auto rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewAnnImageUrl}
              alt="Annotation"
              className="mx-auto"
              style={{ maxWidth: "75vw", maxHeight: "75vh" }}
            />
            <button
              onClick={() => setPreviewAnnImageUrl(null)}
              className="mt-4 px-3 py-1 bg-gray-700 rounded text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Solution Image Preview */}
      {previewSolImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setPreviewSolImageUrl(null)}
        >
          <div
            className="bg-gray-900 p-4 max-w-[90vw] max-h-[90vh] overflow-auto rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewSolImageUrl}
              alt="Solution"
              className="mx-auto"
              style={{ maxWidth: "75vw", maxHeight: "75vh" }}
            />
            <button
              onClick={() => setPreviewSolImageUrl(null)}
              className="mt-4 px-3 py-1 bg-gray-700 rounded text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {aiModal && (
        <MarkdownResponseModal
          title={aiModal.title}
          markdown={aiModal.markdown}
          onClose={() => setAiModal(null)}
        />
      )}


    </div>
  );
};

export default TabWindowContainer;

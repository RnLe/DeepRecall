// src/components/pdfViewer/layout/TabManager.tsx
import React from "react";
import PdfAnnotationContainer from "../pdfAnnotationContainer";
import RightSidebar from "../layout/RightSidebar";
import { AnnotationMode } from "../annotationToolbar";
import { AnnotationType } from "../../../types/annotationTypes";
import { LiteratureExtended } from "../../../types/literatureTypes";

const noop = () => {};
const noopAsync = async () => {};

interface Props {
  tabs: LiteratureExtended[];
  activeTabId: string | null;
  annotationMode: AnnotationMode;
  setAnnotationMode: (mode: AnnotationMode) => void;
  colorMap: Record<AnnotationType, string>;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const TabManager: React.FC<Props> = ({
  tabs,
  activeTabId,
  annotationMode,
  setAnnotationMode,
  colorMap,
  sidebarOpen,
  onToggleSidebar,
}) => {
  const active = tabs.find((t) => t.documentId === activeTabId);

  /* ---------- NO TAB OPEN ---------- */
  if (!active) {
    return (
      <div className="flex h-full overflow-hidden">
        {/* main empty area */}
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Open a document to get started
        </div>

        {/* always‑visible sidebar with placeholder */}
        <RightSidebar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={onToggleSidebar}
          annotations={[]}               /* no annotations yet */
          selectedId={null}
          hoveredId={null}
          multi={false}
          multiSet={new Set()}
          onItemClick={noop}
          onToggleMulti={noop}
          onHover={noop}
          onMassDelete={noopAsync}
          show={true}
          onToggleShow={noop}
          onToggleMultiMode={noop}
          onSelectAll={noop}
          onDeselectAll={noop}
          updateAnnotation={noopAsync}
          deleteAnnotation={noopAsync}
          saveImage={noopAsync}
          selected={null}
          onCancelSelect={noop}
          colorMap={colorMap}
          onOpenTags={noop}
          onOpenNotes={noop}
          onOpenDescription={noop}
          onOpenImage={noop}
          onOpenSolutions={noop}
          fileOpen={false} // <-- add this prop
        />
      </div>
    );
  }

  /* ---------- TAB OPEN ---------- */
  return (
    <PdfAnnotationContainer
      key={active.documentId}           // ← forces React to tear down & rebuild
      activeLiterature={active}
      annotationMode={annotationMode}
      setAnnotationMode={setAnnotationMode}
      colorMap={colorMap}
      sidebarOpen={sidebarOpen}
      onToggleSidebar={onToggleSidebar}
    />
  );
};

export default TabManager;

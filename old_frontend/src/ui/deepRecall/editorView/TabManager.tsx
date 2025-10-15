// src/components/pdfViewer/layout/TabManager.tsx
import React from "react";
import TabWindowContainer from "../tabWindowContainer/TabWindowContainer";
import RightSidebar from "./RightSidebar";
import { AnnotationMode } from "../annotationToolbar";
import { AnnotationType } from "../../../types/deepRecall/strapi/annotationTypes";
import { LiteratureExtended } from "../../../types/deepRecall/strapi/literatureTypes";

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
  taskModelMap: Record<string, string>;
  initialFileHash?: string | null;
}

const TabManager: React.FC<Props> = ({
  tabs,
  activeTabId,
  annotationMode,
  setAnnotationMode,
  colorMap,
  sidebarOpen,
  onToggleSidebar,
  taskModelMap,
  initialFileHash,
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
          annotations={[]}
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
          fileOpen={false}
        />
      </div>
    );
  }

  /* ---------- TAB OPEN ---------- */
  return (
    <TabWindowContainer
      key={active.documentId}
      activeLiterature={active}
      annotationMode={annotationMode}
      setAnnotationMode={setAnnotationMode}
      colorMap={colorMap}
      sidebarOpen={sidebarOpen}
      onToggleSidebar={onToggleSidebar}
      initialFileHash={initialFileHash}
    />
  );
};

export default TabManager;

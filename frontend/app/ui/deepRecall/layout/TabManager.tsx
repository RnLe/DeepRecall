import React from "react";
import PdfAnnotationContainer from "../pdfAnnotationContainer";
import { AnnotationMode } from "../annotationToolbar";
import { AnnotationType } from "../../../types/annotationTypes";
import { LiteratureExtended } from "../../../types/literatureTypes";

interface Props {
  tabs: LiteratureExtended[];
  activeTabId: string | null;
  annotationMode: AnnotationMode;
  colorMap: Record<AnnotationType, string>;
}

const TabManager: React.FC<Props> = ({
  tabs,
  activeTabId,
  annotationMode,
  colorMap,
}) => {
  const active = tabs.find((t) => t.documentId === activeTabId);
  if (!active) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Open a document to get started
      </div>
    );
  }
  return (
    <PdfAnnotationContainer
      key={active.documentId}           // ← forces React to tear down & rebuild 
      activeLiterature={active}
      annotationMode={annotationMode}
      colorMap={colorMap}
    />
  );
};

export default TabManager;

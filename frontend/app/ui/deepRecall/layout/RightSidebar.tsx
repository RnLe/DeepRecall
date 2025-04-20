// src/components/pdfViewer/layout/RightSidebar.tsx
import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import AnnotationList from "../annotationList";
import AnnotationProperties from "../annotationProperties";
import SidebarContainer from "./SidebarContainer";
import CollapsiblePanel from "./CollapsiblePanel";
import { Annotation, RectangleAnnotation } from "@/app/types/annotationTypes";

interface Props {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;

  annotations: Annotation[];
  selectedId: string | null;
  hoveredId: string | null;
  multi: boolean;
  multiSet: Set<string>;
  onItemClick: (a: Annotation) => void;
  onToggleMulti: (a: Annotation) => void;
  onHover: (id: string | null) => void;
  onMassDelete: () => Promise<void>;
  show: boolean;
  onToggleShow: () => void;
  onToggleMultiMode: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  updateAnnotation: (a: Annotation) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  saveImage: (a: RectangleAnnotation) => Promise<void>;
  selected: Annotation | null;
  onCancelSelect: () => void;
  colorMap?: Record<string, string>;
  onOpenTags: (a: Annotation) => void;
  onOpenNotes: (a: Annotation) => void;
  onOpenDescription: (a: Annotation) => void;
  onOpenImage: (a: Annotation) => void;
  onOpenSolutions: (a: Annotation) => void;
}

const RightSidebar: React.FC<Props> = ({
  sidebarOpen,
  annotations,
  selectedId,
  hoveredId,
  multi,
  multiSet,
  onItemClick,
  onToggleMulti,
  onHover,
  onMassDelete,
  show,
  onToggleShow,
  onToggleMultiMode,
  onSelectAll,
  onDeselectAll,
  updateAnnotation,
  deleteAnnotation,
  saveImage,
  selected,
  onCancelSelect,
  colorMap = {},
  onOpenTags,
  onOpenNotes,
  onOpenDescription,
  onOpenImage,
  onOpenSolutions,
}) => {
  /* track whether the properties panel is open */
  const [propsOpen, setPropsOpen] = useState(false);

  /* decide list vs placeholder */
  const topPane =
    annotations.length > 0 ? (
      <AnnotationList
        annotations={annotations}
        selectedId={selectedId}
        hoveredId={hoveredId}
        multi={multi}
        multiSet={multiSet}
        onItemClick={onItemClick}
        onToggleMulti={onToggleMulti}
        onHover={onHover}
        colorMap={colorMap}
        onOpenTags={onOpenTags}
        onOpenNotes={onOpenNotes}
        onOpenDescription={onOpenDescription}
        onOpenImage={onOpenImage}
        onOpenSolutions={onOpenSolutions}
      />
    ) : (
      <div className="p-4 text-gray-400">Open a file to view annotations</div>
    );

  return (
    <div className="flex h-full">
      <div
        className={`flex-none bg-gray-900 border-l border-gray-700 overflow-hidden transition-all duration-200 ${
          sidebarOpen ? "w-80" : "w-0"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header with Hide/Show */}
          <div className="px-4 py-2 border-b border-gray-700 flex items-center">
            <h3 className="text-lg font-semibold text-white">Annotations</h3>
            <button onClick={onToggleShow} className="ml-auto p-1">
              {show ? (
                <Eye size={20} className="text-gray-400 hover:text-white transition-colors" />
              ) : (
                <EyeOff size={20} className="text-gray-400 hover:text-white transition-colors" />
              )}
            </button>
          </div>

          {/* Controls */}
          <div className="px-4 flex items-center space-x-2 border-b border-gray-700">
            <button
              onClick={onToggleMultiMode}
              className={`px-2 py-1 rounded text-sm transition-colors ${
                multi ? "text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {multi ? "X" : "Select Multiple"}
            </button>

            {multi && (
              <>
                <button
                  onClick={onSelectAll}
                  className="px-2 py-1 rounded text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Select All
                </button>
                {multiSet.size > 0 && (
                  <button
                    onClick={onDeselectAll}
                    className="px-2 py-1 rounded text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Deselect All
                  </button>
                )}
              </>
            )}

            {multi && multiSet.size > 0 && (
              <button
                onClick={onMassDelete}
                className="px-2 py-1 rounded text-sm text-red-500 hover:text-white transition-colors"
              >
                Delete ({multiSet.size})
              </button>
            )}
          </div>

          {/* List & Properties */}
          <div className="flex-1 overflow-hidden">
            <SidebarContainer
              top={topPane}
              bottom={
                <CollapsiblePanel
                  title="Annotation Properties"
                  onExpandedChange={setPropsOpen}
                >
                  {!multi && selected ? (
                    <AnnotationProperties
                      annotation={selected}
                      updateAnnotation={updateAnnotation}
                      deleteAnnotation={deleteAnnotation}
                      saveImage={saveImage}
                      onCancel={onCancelSelect}
                    />
                  ) : (
                    <div className="p-4 text-gray-400">
                      Select an annotation to view properties
                    </div>
                  )}
                </CollapsiblePanel>
              }
              bottomActive={propsOpen}
              initialBottomHeightPercent={50}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RightSidebar;

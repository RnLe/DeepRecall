import React, { useState } from "react";
import { Eye, ArrowRight, EyeOff } from "lucide-react";
import AnnotationList from "../annotationList";
import AnnotationProperties from "../annotationProperties";
import { Annotation, RectangleAnnotation } from "@/app/types/annotationTypes";

interface Props {
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
  updateAnnotation: (a: Annotation) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  saveImage: (a: RectangleAnnotation) => Promise<void>;
  selected: Annotation | null;
  onCancelSelect: () => void;
}

const RightSideBar: React.FC<Props> = ({
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
  updateAnnotation,
  deleteAnnotation,
  saveImage,
  selected,
  onCancelSelect,
}) => {
  // collapsed if width=0; but we always show a stripe to open
  const [open, setOpen] = useState(true);

  return (
    <div className="flex h-full">
      {/* Sliding panel */}
      <div
        className={`flex-none bg-gray-900 border-l border-gray-700 overflow-hidden transition-all duration-200 ${
          open ? "w-80" : "w-0"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-4 py-2 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">Annotations</h3>
            <button
              onClick={() => setOpen(false)}
              className="absolute top-2 right-2 p-1"
            >
              <ArrowRight
                size={16}
                className="text-gray-400 hover:text-white transition-colors"
              />
            </button>
          </div>

          {/* Controls */}
          <div className="px-4 py-2 flex items-center space-x-2 border-b border-gray-700">
            <button
              onClick={onToggleMultiMode}
              className={`px-2 py-1 rounded text-sm transition-colors ${
                multi
                  ? "text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {multi ? "Single Select" : "Multi‑Select"}
            </button>

            {multi && (
              <button
                onClick={onSelectAll}
                className="px-2 py-1 rounded text-sm text-gray-400 hover:text-white transition-colors"
              >
                Select All
              </button>
            )}

            {multi && multiSet.size > 0 && (
              <button
                onClick={onMassDelete}
                className="px-2 py-1 rounded text-sm text-red-500 hover:text-white transition-colors"
              >
                Delete ({multiSet.size})
              </button>
            )}

            <button
              onClick={onToggleShow}
              className="ml-auto p-1"
            >
              {show ? (
                <Eye
                  size={20}
                  className="text-gray-400 hover:text-white transition-colors"
                />
              ) : (
                <EyeOff
                  size={20}
                  className="text-gray-400 hover:text-white transition-colors"
                />
              )}
            </button>
          </div>

          {/* List */}
          <AnnotationList
            annotations={annotations}
            selectedId={selectedId}
            hoveredId={hoveredId}
            multi={multi}
            multiSet={multiSet}
            onItemClick={onItemClick}
            onToggleMulti={onToggleMulti}
            onHover={onHover}
          />

          {/* Properties */}
          {!multi && selected && (
            <AnnotationProperties
              annotation={selected}
              updateAnnotation={updateAnnotation}
              deleteAnnotation={deleteAnnotation}
              saveImage={saveImage}
              onCancel={onCancelSelect}
            />
          )}
        </div>
      </div>

      {/* Stripe to reopen */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="w-4 bg-gray-800 flex items-center justify-center cursor-pointer"
        >
          <Eye
            size={16}
            className="text-gray-400 hover:text-white transition-colors rotate-180"
          />
        </button>
      )}
    </div>
  );
};

export default RightSideBar;

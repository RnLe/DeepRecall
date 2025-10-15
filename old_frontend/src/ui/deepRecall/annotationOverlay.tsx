// src/components/pdfViewer/annotationOverlay.tsx
import React, { useState } from "react";
import {
  AIResponse,
  Annotation,
  AnnotationType,
} from "../../types/deepRecall/strapi/annotationTypes";
import { AiTaskKey, AiTasks, fieldByTask } from "@/src/api/openAI/promptTypes";
import { updateAnnotation } from "@/src/api/annotationService";
import {
  List,
  HelpCircle,
  Sigma,
  Table as TableIcon,
  FileText,
  Image as ImageIcon,
  Code2,
} from "lucide-react";
import MarkdownResponseModal from "./MarkdownResponseModal";

const iconMap: Record<string, React.ReactNode> = {
  extractToC:                   <List size={14} />,  
  explainExercise:              <HelpCircle size={14} />,  
  solveExercise:                <Sigma size={14} />,      
  extractDataFromTableLatex:    <TableIcon size={14} />,  
  extractDataFromTableMarkdown: <TableIcon size={14} />,  
  extractDataFromTableCSV:      <TableIcon size={14} />,  
  explainFigure:                <ImageIcon size={14} />,  
  explainIllustration:          <ImageIcon size={14} />,  
  convertToLatex:               <Code2 size={14} />,     
  convertToMarkdown:            <FileText size={14} />,   
};

interface Props {
  annotations: Annotation[];
  selectedId: string | null;
  pageWidth: number;
  pageHeight: number;
  onSelectAnnotation: (a: Annotation) => void;
  onHoverAnnotation: (a: Annotation | null) => void;
  renderTooltip?: (annotation: Annotation) => React.ReactNode;
  colorMap: Record<AnnotationType, string>;
  handleAiTask: (annotation: Annotation, task: AiTaskKey) => void;
}

const DEFAULT_COLOR = "#000000";

const AnnotationOverlay: React.FC<Props> = ({
  annotations,
  selectedId,
  pageWidth,
  pageHeight,
  onSelectAnnotation,
  onHoverAnnotation,
  renderTooltip,
  colorMap = {},
  handleAiTask,
}) => {
  const [hovered, setHovered] = useState<Annotation | null>(null);
  const [hoveredTask, setHoveredTask] = useState<AiTaskKey | null>(null);
  const [modalData, setModalData] = useState<{
    annotation: Annotation;
    taskKey: AiTaskKey;
    entryIndex: number;
    title: string;
    markdown: string;
  } | null>(null);

  const enter = (a: Annotation) => {
    setHovered(a);
    onHoverAnnotation?.(a);
  };
  const leave = (e: React.MouseEvent) => {
    // prevent closing when moving into dropdown or its children
    const related = e.relatedTarget as Node;
    if (related && (e.currentTarget as HTMLElement).contains(related)) {
      return;
    }
    setHovered(null);
    onHoverAnnotation?.(null);
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: pageWidth,
        height: pageHeight,
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      {annotations.map((a) => {
        const isSelected = a.documentId === selectedId;
        const color =
          a.color ??
          (a.mode === "rectangle"
            ? colorMap[(a as Annotation).type]
            : colorMap["text" as AnnotationType]) ??
          DEFAULT_COLOR;

        // Rectangle border
        if (a.mode === "rectangle") {
          return (
            <div
              key={a.documentId}
              onClick={(e) => {
                e.stopPropagation();
                onSelectAnnotation(a);
              }}
              onMouseEnter={() => enter(a)}
              onMouseLeave={leave}
              style={{
                position: "absolute",
                left: a.x * pageWidth,
                top: a.y * pageHeight,
                width: a.width * pageWidth,
                height: a.height * pageHeight,
                pointerEvents: "auto",
                boxSizing: "border-box",
                border: `${isSelected ? 3 : 2}px solid ${color}`,
              }}
              className="cursor-pointer duration-150 ease-in-out hover:shadow-lg"
            >
              {/* AI buttons row shown only on hover */}
              {hovered?.documentId === a.documentId && (
                <div className="absolute right-0 top-0 flex">
                  {(Object.keys(AiTasks) as AiTaskKey[]).map((taskKey) => {
                    const entries = (a[fieldByTask[taskKey]] as AIResponse[]) || [];

                    return (
                      <div
                        key={taskKey}
                        className="relative"
                        onMouseEnter={() => setHoveredTask(taskKey)}
                        onMouseLeave={() => setHoveredTask(null)}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAiTask(a, taskKey);
                          }}
                          className="bg-gray-900 bg-opacity-70 hover:bg-opacity-90 p-0.5"
                          title={AiTasks[taskKey].name}
                        >
                          {iconMap[taskKey]}
                        </button>

                        {/* Dropdown only if entries exist */}
                        {hoveredTask === taskKey && entries.length > 0 && (
                          <div
                            className="absolute right-full top-full w-56 max-h-48 overflow-auto bg-gray-800 text-white p-2 rounded shadow-lg z-10"
                            onMouseEnter={() => setHoveredTask(taskKey)}
                            onMouseLeave={() => setHoveredTask(null)}
                          >
                            {/* Task description */}
                            <div className="text-xs text-gray-400 mb-1">
                              {AiTasks[taskKey].description}
                            </div>
                            <hr className="border-gray-600 mb-2" />

                            {/* Entries list */}
                            {entries.map((entry, idx) => {
                              const date = new Date(entry.createdAt).toLocaleString();
                              return (
                                <div
                                  key={idx}
                                  className="p-1 border-b last:border-none cursor-pointer hover:bg-gray-700"
                                  onClick={() => {
                                    setModalData({
                                      annotation: a,
                                      taskKey,
                                      entryIndex: idx,
                                      title: AiTasks[taskKey].name,
                                      markdown: entry.text,
                                    });
                                  }}
                                >
                                  <div className="text-sm font-medium">
                                    {date}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    Model: {entry.model}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        // Text highlight
        const alphaHex = (col: string, a: number) => {
          const hex = Math.round(a * 255)
            .toString(16)
            .padStart(2, "0");
          return `${col}${hex}`;
        };
        const bg = alphaHex(color, isSelected ? 0.6 : 0.35);

        return (
          <div
            key={a.documentId}
            onClick={(e) => {
              e.stopPropagation();
              onSelectAnnotation(a);
            }}
            onMouseEnter={() => enter(a)}
            onMouseLeave={leave}
            style={{
              position: "absolute",
              left: a.x * pageWidth,
              top: a.y * pageHeight,
              width: a.width * pageWidth,
              height: a.height * pageHeight,
              pointerEvents: "auto",
              backgroundColor: bg,
            }}
            className="cursor-pointer duration-150 ease-in-out hover:shadow-lg"
          />
        );
      })}

      {/* Tooltip rendering */}
      {renderTooltip && hovered && (
        <div
          className="absolute"
          style={{
            left: hovered.x * pageWidth,
            top: (hovered.y + hovered.height) * pageHeight + 8,
            pointerEvents: "none",
            zIndex: 20,
          }}
        >
          {renderTooltip(hovered)}
        </div>
      )}

      {/* Response modal */}
      {modalData && (
        <MarkdownResponseModal
          title={modalData.title}
          markdown={modalData.markdown}
          onClose={() => setModalData(null)}
          onSave={(newMd) => {
            const { annotation, taskKey, entryIndex } = modalData!;
            const field = fieldByTask[taskKey];
            const arr = [...((annotation[field] as AIResponse[]) || [])];
            arr[entryIndex] = { ...arr[entryIndex], text: newMd };
            updateAnnotation(annotation.documentId!, { ...annotation, [field]: arr });
            setModalData(null);
          }}
        />
      )}
    </div>
  );
};

export default AnnotationOverlay;

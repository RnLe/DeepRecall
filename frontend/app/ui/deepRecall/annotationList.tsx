// src/components/pdfViewer/annotationList.tsx
import React from "react";
import { CircleCheckBig, Type, Square, Image as ImageIcon, StickyNote, Circle, Tags, FileText, Sigma } from "lucide-react";
import { Annotation, RectangleAnnotation } from "../../types/annotationTypes";

const DEFAULT_COLOR = "#000000";

interface Props {
  annotations: Annotation[];
  selectedId: string | null;
  hoveredId: string | null;
  multi: boolean;
  multiSet: Set<string>;
  onItemClick: (a: Annotation) => void;
  onToggleMulti: (a: Annotation) => void;
  onHover: (id: string | null) => void;
  onOpenTags: (a: Annotation) => void;
  onOpenNotes: (a: Annotation) => void;
  onOpenDescription: (a: Annotation) => void;
  onOpenImage: (a: Annotation) => void;
  onOpenSolutions: (a: Annotation) => void;
  colorMap?: Record<string, string>;
}

const AnnotationList: React.FC<Props> = ({
  annotations,
  selectedId,
  hoveredId,
  multi,
  multiSet,
  onItemClick,
  onToggleMulti,
  onHover,
  onOpenTags,
  onOpenNotes,
  onOpenDescription,
  onOpenImage,
  onOpenSolutions,
  colorMap
}) => (
  <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
    {annotations.map((a) => {
      const isChecked = multi && multiSet.has(a.documentId!);
      const isActive = selectedId === a.documentId;
      const isHovered = hoveredId === a.documentId;

      // compute icon color same as in overlay
      const color =
        a.color ??
        (a.type === "rectangle"
          ? colorMap?.[(a as RectangleAnnotation).annotationType]
          : colorMap?.["text"]) ??
        DEFAULT_COLOR;

      const handleClick = () => {
        multi ? onToggleMulti(a) : onItemClick(a);
      };

      return (
        <div
          key={a.documentId}
          className={`p-1 cursor-pointer ${
            isActive ? "bg-gray-700" : isHovered ? "bg-gray-600" : ""
          }`}
          onClick={handleClick}
          onMouseEnter={() => onHover(a.documentId!)}
          onMouseLeave={() => onHover(null)}
        >
          <table className="w-full table-fixed">
            <tbody>
              <tr className="h-4">
                <td className="flex items-center space-x-1 py-0 px-0">
                  {multi && (
                    isChecked
                      ? <CircleCheckBig size={16} style={{ }} />
                      : <Circle size={16} style={{ }} />
                  )}
                  {a.type === "text" ? (
                    <>
                      <Type size={20} style={{ color }} />
                      <span></span>
                    </>
                  ) : (
                    <>
                      <Square size={20} style={{ color }} />
                      <span>{(a as RectangleAnnotation).annotationType}</span>
                    </>
                  )}
                </td>
                <td className="text-left py-0 px-0">{a.page}</td>
                <td className="flex justify-start space-x-1 py-0 px-0">
                  {a.annotation_tags?.length! > 0 && (
                    <button onClick={() => onOpenTags(a)} title="Tags">
                      <Tags size={16} />
                    </button>
                  )}
                  {a.description && (
                    <button onClick={() => onOpenDescription(a)} title="Description">
                      <FileText size={16} />
                    </button>
                  )}
                  {a.solutions?.length! > 0 && (
                    <button onClick={() => onOpenSolutions(a)} title="Solutions">
                      <Sigma size={16} />
                    </button>
                  )}
                  {a.extra?.imageUrl && (
                    <button onClick={() => onOpenImage(a)} title="Image">
                      <ImageIcon size={16} />
                    </button>
                  )}
                  {a.notes && (
                    <button onClick={() => onOpenNotes(a)} title="Notes">
                      <StickyNote size={16} />
                    </button>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    })}
  </div>
);

export default AnnotationList;

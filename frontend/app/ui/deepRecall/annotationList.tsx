// src/components/pdfViewer/annotationList.tsx
import React from "react";
import { CircleCheckBig, Type, Square, Image as ImageIcon, StickyNote, Circle } from "lucide-react";
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
                  {a.extra?.imageUrl && <ImageIcon size={16} style={{}} />}
                  {a.notes && <StickyNote size={16} style={{}} />}
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

// src/components/pdfViewer/annotationList.tsx
import React from "react";
import { CircleCheckBig, Type, Square, Image as ImageIcon, StickyNote, Tags, FileText, Sigma } from "lucide-react";
import { Annotation, RectangleAnnotation } from "../../types/deepRecall/strapi/annotationTypes";

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

      const color =
        a.color ??
        (a.mode === "rectangle"
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
            <colgroup>
              <col style={{ width: "24px" }} />
              <col style={{ width: "auto" }} />
              <col style={{ width: "4ch" }} />
              <col style={{ width: "24px" }} />
              <col style={{ width: "24px" }} />
              <col style={{ width: "24px" }} />
              <col style={{ width: "24px" }} />
              <col style={{ width: "24px" }} />
            </colgroup>
            <tbody>
              <tr className="h-6">
                {/* Type icon */}
                <td className="text-center">
                  {multi
                    ? isChecked
                      ? <CircleCheckBig size={16} />
                      : <Square size={16} style={{ color }} />
                    : a.mode === "text"
                      ? <Type size={16} style={{ color }} />
                      : <Square size={16} style={{ color }} />}
                </td>
                {/* Type label */}
                <td className="text-left px-1">
                  {a.mode === "text" ? "Text" : (a as RectangleAnnotation).annotationType}
                </td>
                {/* Page */}
                <td className="text-left">{a.page}</td>
                {/* Description */}
                <td className="text-center">
                  {a.description && (
                    <button
                      type="button"
                      title="Description"
                      className="inline-flex items-center justify-center w-6 h-6 p-0 m-0"
                      onClick={(e) => { e.stopPropagation(); onOpenDescription(a); }}
                    >
                      <FileText size={16} />
                    </button>
                  )}
                </td>

                {/* Tags (inert) */}
                <td className="text-center">
                  {a.annotation_tags?.length! > 0 && (
                    <span
                      title="Tags"
                      className="inline-flex items-center justify-center w-6 h-6 p-0 m-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Tags size={16} />
                    </span>
                  )}
                </td>

                {/* Notes */}
                <td className="text-center">
                  {a.notes && (
                    <button
                      type="button"
                      title="Notes"
                      className="inline-flex items-center justify-center w-6 h-6 p-0 m-0"
                      onClick={(e) => { e.stopPropagation(); onOpenNotes(a); }}
                    >
                      <StickyNote size={16} />
                    </button>
                  )}
                </td>

                {/* Calculation/Solutions */}
                <td className="text-center">
                  {a.solutions?.length! > 0 && (
                    <button
                      type="button"
                      title="Calculation"
                      className="inline-flex items-center justify-center w-6 h-6 p-0 m-0"
                      onClick={(e) => { e.stopPropagation(); onOpenSolutions(a); }}
                    >
                      <Sigma size={16} />
                    </button>
                  )}
                </td>

                {/* Image */}
                <td className="text-center">
                  {a.extra?.imageUrl && (
                    <button
                      type="button"
                      title="Image Copy"
                      className="inline-flex items-center justify-center w-6 h-6 p-0 m-0"
                      onClick={(e) => { e.stopPropagation(); onOpenImage(a); }}
                    >
                      <ImageIcon size={16} />
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

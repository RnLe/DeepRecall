import React from "react";
import { Handle, Position } from "reactflow";
import { Annotation } from "../../types/deepRecall/strapi/annotationTypes";
import { Edit2 } from "lucide-react";
import AnnotationHoverTooltip from "./annotationHoverTooltip";
import { prefixStrapiUrl } from "@/app/helpers/getStrapiMedia";

interface Props {
  data: {
    annotation: Annotation;
    selectedId: string | null;
    hoveredId: string | null;
    onHover: (id: string | null) => void;
    onSelect: (id: string) => void;
    onEdit: (a: Annotation) => void;
  };
}

const CanvasAnnotationNode: React.FC<Props> = ({ data }) => {
  const {
    annotation,
    selectedId,
    hoveredId,
    onHover,
    onSelect,
    onEdit,
  } = data;

  const isText = annotation.mode === "text";
  const isSelected = annotation.documentId === selectedId;
  const isHovered = annotation.documentId === hoveredId;

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    onHover(annotation.documentId!);
  };
  const handleMouseLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onHover(null);
  };
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(annotation.documentId!);
  };
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(annotation);
  };

  return (
    <div
      className={`p-2 rounded relative cursor-pointer ${
        isSelected ? "bg-purple-100" : ""
      } ${isHovered ? "bg-gray-200" : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <Handle
        type="source"
        position={isText ? Position.Right : Position.Left}
        id="source"
      />

      <div className="flex items-center space-x-1">
        {isText ? (
          <strong>“{annotation.highlightedText}”</strong>
        ) : annotation.extra?.imageUrl ? (
          <img
            src={prefixStrapiUrl(annotation.extra.imageUrl as string)}
            alt={annotation.annotationKind}
            style={{ maxWidth: "100%", borderRadius: 4 }}
          />
        ) : null}

        <button onClick={handleEditClick} className="p-1">
          <Edit2 size={16} />
        </button>
      </div>

      {isHovered && (
        <div className="absolute z-10" style={{ top: "100%", left: 0 }}>
          <AnnotationHoverTooltip annotation={annotation} />
        </div>
      )}
    </div>
  );
};

export default CanvasAnnotationNode;

// annotationOverlay.tsx
import React from "react";
import { Annotation } from "../../types/annotationTypes";

interface Props {
  /** All annotations *for this visible page* */
  annotations: Annotation[];
  selectedId: string | null;
  /** The rendered pixel size of the PDF page */
  pageWidth: number;
  pageHeight: number;
  /** Callback when a user clicks an annotation */
  onSelectAnnotation: (a: Annotation) => void;
}

/**
 * Absolute‑positioned layer that sits on top of the rendered PDF page
 * and visualises existing annotations (rectangles + highlights).
 */
const AnnotationOverlay: React.FC<Props> = ({
  annotations,
  selectedId,
  pageWidth,
  pageHeight,
  onSelectAnnotation,
}) => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      /* critical: give the layer an explicit size so child coords work */
      width: pageWidth,
      height: pageHeight,
      pointerEvents: "none", // allow tool below to receive events
    }}
  >
    {annotations.map((a) => {
      const isSelected = selectedId === a.documentId;

      const style: React.CSSProperties = {
        position: "absolute",
        left: a.x * pageWidth,
        top: a.y * pageHeight,
        width: a.width * pageWidth,
        height: a.height * pageHeight,
        pointerEvents: "auto", // re‑enable for the actual annotation
        boxSizing: "border-box",
        /* Visuals ---------------------------------------------------- */
        border:
          a.type === "rectangle"
            ? `${isSelected ? 3 : 2}px solid ${
                isSelected ? "blue" : "black"
              }`
            : undefined,
        backgroundColor:
          a.type === "text"
            ? isSelected
              ? "rgba(255,255,0,0.6)"
              : "rgba(255,255,0,0.35)"
            : "transparent",
      };

      return (
        <div
          key={a.documentId}
          title={a.title ?? undefined}
          style={style}
          onClick={() => onSelectAnnotation(a)}
        />
      );
    })}
  </div>
);

export default AnnotationOverlay;

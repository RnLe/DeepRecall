// annotationOverlay.tsx
import React, { useState } from "react";
import { Annotation } from "../../types/annotationTypes";

interface Props {
  annotations: Annotation[];
  selectedId: string | null;
  pageWidth: number;
  pageHeight: number;
  onSelectAnnotation: (a: Annotation) => void;
  onHoverAnnotation?: (a: Annotation | null) => void;
  renderTooltip?: (annotation: Annotation) => React.ReactNode;
}

/**
 * Overlay on top of each PDF page.
 * Shows rectangles/highlights and a tooltip that persists when selected.
 */
const AnnotationOverlay: React.FC<Props> = ({
  annotations,
  selectedId,
  pageWidth,
  pageHeight,
  onSelectAnnotation,
  onHoverAnnotation,
  renderTooltip,
}) => {
  const [hovered, setHovered] = useState<Annotation | null>(null);

  const enter = (a: Annotation) => {
    setHovered(a);
    onHoverAnnotation?.(a);
  };
  const leave = () => {
    setHovered(null);
    onHoverAnnotation?.(null);
  };

  // show tooltip for whatever is hovered, or if none hovered, the selected one
  const active =
    hovered ||
    annotations.find((a) => a.documentId === selectedId) ||
    null;

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
        const isSelected = selectedId === a.documentId;
        const style: React.CSSProperties = {
          position: "absolute",
          left: a.x * pageWidth,
          top: a.y * pageHeight,
          width: a.width * pageWidth,
          height: a.height * pageHeight,
          pointerEvents: "auto",
          boxSizing: "border-box",
          border:
            a.type === "rectangle"
              ? `${isSelected ? 3 : 2}px solid ${
                  isSelected ? "purple" : "black"
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
            style={style}
            className="duration-150 ease-in-out cursor-pointer hover:scale-105 hover:shadow-lg"
            onClick={() => onSelectAnnotation(a)}
            onMouseEnter={() => enter(a)}
            onMouseLeave={leave}
          />
        );
      })}

      {renderTooltip && active && (
        <div
          className="absolute"
          style={{
            left: active.x * pageWidth,
            top: (active.y + active.height) * pageHeight + 8,
            pointerEvents: "none",
            zIndex: 20,
          }}
        >
          {renderTooltip(active)}
        </div>
      )}
    </div>
  );
};

export default AnnotationOverlay;

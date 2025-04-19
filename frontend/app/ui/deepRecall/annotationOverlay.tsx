// src/components/pdfViewer/annotationOverlay.tsx
import React, { useState } from "react";
import { Annotation, AnnotationKind } from "../../types/annotationTypes";

const DEFAULT_COLOR = "#000000";
const DEFAULT_SELECTED = "#800080";

interface Props {
  annotations: Annotation[];
  selectedId: string | null;
  pageWidth: number;
  pageHeight: number;
  onSelectAnnotation: (a: Annotation) => void;
  onHoverAnnotation?: (a: Annotation | null) => void;
  renderTooltip?: (annotation: Annotation) => React.ReactNode;
  defaultColors: Record<AnnotationKind, { color: string; selectedColor: string }>;
}

const AnnotationOverlay: React.FC<Props> = ({
  annotations,
  selectedId,
  pageWidth,
  pageHeight,
  onSelectAnnotation,
  onHoverAnnotation,
  renderTooltip,
  defaultColors,
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
        const isSelected = a.documentId === selectedId;
        const normal = a.color ?? DEFAULT_COLOR;
        const selected = a.selectedColor ?? DEFAULT_SELECTED;

        // rectangle style
        if (a.type === "rectangle") {
          return (
            <div
              key={a.documentId}
              onClick={() => onSelectAnnotation(a)}
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
                border: `${
                  isSelected ? 3 : 2
                }px solid ${isSelected ? selected : normal}`,
              }}
              className="duration-150 ease-in-out hover:shadow-lg cursor-pointer"
            />
          );
        }

        // text highlight style
        const alphaHex = (col: string, a: number) => {
          // append hex alpha; a between 0–1 → 00–FF
          const hex = Math.round(a * 255)
            .toString(16)
            .padStart(2, "0");
          return `${col}${hex}`;
        };
        const bg = isSelected
          ? alphaHex(selected, 0.6)
          : alphaHex(normal, 0.35);

        return (
          <div
            key={a.documentId}
            onClick={() => onSelectAnnotation(a)}
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
            className="duration-150 ease-in-out cursor-pointer hover:shadow-lg"
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

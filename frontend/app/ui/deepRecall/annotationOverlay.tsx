// src/components/pdfViewer/annotationOverlay.tsx
import React, { useState } from "react";
import {
  Annotation,
  RectangleAnnotation,
  AnnotationType,
} from "../../types/annotationTypes";

interface Props {
  annotations: Annotation[];
  selectedId: string | null;
  pageWidth: number;
  pageHeight: number;
  onSelectAnnotation: (a: Annotation) => void;
  onHoverAnnotation?: (a: Annotation | null) => void;
  renderTooltip?: (annotation: Annotation) => React.ReactNode;
  colorMap?: Record<AnnotationType, string>;
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
    hovered || annotations.find((a) => a.documentId === selectedId) || null;

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
          (a.type === "rectangle"
            ? colorMap[(a as RectangleAnnotation).annotationType]
            : colorMap["text" as AnnotationType]) ??
          DEFAULT_COLOR;

        // Rectangle border
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
                border: `${isSelected ? 3 : 2}px solid ${color}`,
              }}
              className="cursor-pointer duration-150 ease-in-out hover:shadow-lg"
            />
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
            className="cursor-pointer duration-150 ease-in-out hover:shadow-lg"
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

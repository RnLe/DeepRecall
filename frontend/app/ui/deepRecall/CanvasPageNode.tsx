import React, { useState } from "react";
import { Handle, Position } from "reactflow";
import { Page } from "react-pdf";
import AnnotationOverlay from "./annotationOverlay";
import AnnotationHoverTooltip from "./annotationHoverTooltip";
import { Annotation } from "../../types/annotationTypes";

interface Props {
  data: {
    pageNumber: number;
    annotations: Annotation[];
    selectedId: string | null;
    onSelect: (a: Annotation) => void;
  };
}

const PAGE_WIDTH = 600;

function CanvasPageNodeComponent({ data }: Props) {
  const { pageNumber, annotations, selectedId, onSelect } = data;
  const [size, setSize] = useState({ w: PAGE_WIDTH, h: PAGE_WIDTH * 1.3 });

  return (
    <div style={{ position: "relative", width: PAGE_WIDTH, height: size.h }}>
      <Page
        pageNumber={pageNumber}
        width={PAGE_WIDTH}
        onRenderSuccess={({ width, height }) =>
          setSize({ w: width!, h: height! })
        }
      />

      <AnnotationOverlay
        annotations={annotations}
        selectedId={selectedId}
        pageWidth={size.w}
        pageHeight={size.h}
        onSelectAnnotation={onSelect}
        renderTooltip={(a) => <AnnotationHoverTooltip annotation={a} />}
      />

      {/* Dynamic handles at each annotation’s vertical position */}
      {annotations.map((a) => (
        <Handle
          key={a.documentId}
          type="target"
          position={Position.Left}
          style={{ top: a.y * size.h }}
          id={`target-${a.documentId}`}
        />
      ))}
      {annotations.map((a) => (
        <Handle
          key={`${a.documentId}-r`}
          type="target"
          position={Position.Right}
          style={{ top: a.y * size.h }}
          id={`target-${a.documentId}`}
        />
      ))}
    </div>
  );
}

/**
 * Only re‐render if:
 * - the annotation list for this page changes, or
 * - the selectedId changes *and* it belongs to one of this page’s annotations.
 */
function areEqual(
  prev: React.ComponentProps<typeof CanvasPageNodeComponent>,
  next: React.ComponentProps<typeof CanvasPageNodeComponent>
) {
  if (prev.data.pageNumber !== next.data.pageNumber) return false;
  if (prev.data.annotations !== next.data.annotations) return false;

  const prevSel = prev.data.selectedId;
  const nextSel = next.data.selectedId;
  if (prevSel === nextSel) return true;

  // re‑render only if the change affects one of our annotations
  const ids = prev.data.annotations.map((a) => a.documentId);
  const prevIn = prevSel ? ids.includes(prevSel) : false;
  const nextIn = nextSel ? ids.includes(nextSel) : false;
  return !(prevIn || nextIn);
}

export default React.memo(CanvasPageNodeComponent, areEqual);

// annotationHoverTooltip.tsx
import React from "react";
import { Annotation } from "../../types/annotationTypes";

interface Props {
  /** The annotation to display information for */
  annotation: Annotation;
}

/**
 * A lightweight hover tooltip for annotations.
 * Slightly transparent and positioned below the annotation.
 */
const AnnotationHoverTooltip: React.FC<Props> = ({ annotation }) => (
  <div className="bg-gray-800 text-white p-2 rounded shadow-lg bg-opacity-80 max-w-xs">
    <strong>{annotation.title || "Untitled"}</strong>
    {annotation.description && (
      <p className="mt-1 text-sm">{annotation.description}</p>
    )}
  </div>
);

export default AnnotationHoverTooltip;

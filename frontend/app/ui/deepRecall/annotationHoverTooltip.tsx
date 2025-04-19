// src/components/pdfViewer/annotationHoverTooltip.tsx
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import { Annotation } from "../../types/annotationTypes";

/** A lightweight hover tooltip for annotations. */
const AnnotationHoverTooltip: React.FC<{ annotation: Annotation }> = ({
  annotation,
}) => (
  <div className="bg-gray-800 text-white p-2 rounded shadow-lg bg-opacity-80 max-w-xs prose prose-invert text-xs">
    <strong>{annotation.title || "Untitled"}</strong>
    {annotation.notes && (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {annotation.notes}
      </ReactMarkdown>
    )}
    {!annotation.notes && annotation.description && (
      <p className="mt-1">{annotation.description}</p>
    )}
  </div>
);

export default AnnotationHoverTooltip;

// src/components/pdfViewer/annotationHoverTooltip.tsx
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import { Annotation } from "../../types/deepRecall/strapi/annotationTypes";

/** A lightweight hover tooltip for annotations. */
const AnnotationHoverTooltip: React.FC<{ annotation: Annotation }> = ({
  annotation,
}) => {
  const hasTagsOnly =
    !annotation.title &&
    !annotation.description &&
    !annotation.notes &&
    (annotation.annotation_tags?.length ?? 0) > 0;

  if (hasTagsOnly) {
    return (
      <div className="bg-gray-800 text-white p-1 rounded shadow-lg bg-opacity-80 flex flex-wrap gap-1 text-xs">
        {annotation.annotation_tags!.map((tag) => (
          <span
            key={tag.documentId}
            className="bg-gray-300 text-gray-900 px-1 py-0.5 rounded"
          >
            {tag.name}
          </span>
        ))}
      </div>
    );
  }

  // don't show tooltip when no content
  if (
    !annotation.title &&
    !annotation.description &&
    !annotation.notes &&
    !(annotation.annotation_tags?.length! > 0)
  ) {
    return null;
  }
  return (
    // Removed the `prose` utility so it no longer injects its own spacing
    <div className="bg-gray-800 text-white p-2 rounded shadow-lg bg-opacity-80 max-w-xs prose-invert text-xs text-left min-w-40">
      {/* annotation type label */}
      <div className="flex justify-center">
        <span className="rounded text-[10px] uppercase">
          {annotation.annotationType}
        </span>
      </div>
      {/* optional title */}
      {annotation.title && (
        <strong className="block text-sm my-1">{annotation.title}</strong>
      )}
      {/* description */}
      {annotation.description && (
        <div className="">
          <div className="flex justify-center">
            <span className="my-2 rounded text-[10px] uppercase">Description</span>
          </div>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {annotation.description}
          </ReactMarkdown>
        </div>
      )}
      {/* notes */}
      {annotation.notes && (
        <div className="">
          <div className="flex justify-center">
            <span className="my-2 rounded text-[10px] uppercase">Notes</span>
          </div>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {annotation.notes}
          </ReactMarkdown>
        </div>
      )}
      {/* tags */}
      {annotation.annotation_tags?.length! > 0 && (
        <div className="mt-2">
          <div className="font-semibold text-xs mb-1">Tags</div>
          <div className="flex flex-wrap gap-1">
            {annotation.annotation_tags!.map((tag) => (
              <span
                key={tag.documentId}
                className="bg-gray-300 text-gray-900 px-1 py-0.5 rounded text-[10px]"
              >
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnotationHoverTooltip;

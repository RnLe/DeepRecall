// src/components/MarkdownEditorModal.tsx
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Annotation } from "../../types/deepRecall/strapi/annotationTypes";
import { Type, Square, Trash2, Eye, Pencil } from "lucide-react";

interface Props {
  initial: string;
  onSave: (md: string) => void;
  onClose: () => void;
  annotation?: Annotation;
  objectName?: string;
  colorMap?: Record<string, string>;
  startInPreview?: boolean;
}

const DEFAULT_COLOR = "#000000";

const MarkdownEditorModal: React.FC<Props> = ({
  initial,
  onSave,
  onClose,
  annotation,
  objectName,
  colorMap = {},
  startInPreview = false,
}) => {
  const [text, setText] = useState(initial);
  const [mode, setMode] = useState<"edit" | "preview">(startInPreview ? "preview" : "edit");

  // Ref for textarea to enable undoable clear
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const titleContent = (() => {
    if (annotation && objectName) {
      const color =
        annotation.color ??
        (annotation.mode === "text"
          ? colorMap["text"]
          : colorMap[(annotation as Annotation).type]) ??
        DEFAULT_COLOR;
      const Icon = annotation.mode === "text" ? Type : Square;
      const typeName =
        annotation.mode === "text"
          ? "Text"
          : (annotation as Annotation).type;
      return (
        <>
          Editing{"\u00A0\u00A0"}
          <span className="font-semibold">{objectName}</span>{"\u00A0\u00A0"}
          for{"\u00A0\u00A0"}
          <Icon size={16} style={{ color }} className="inline mb-1 mr-1" />
          {" "}
          <span style={{ }}>{typeName}</span>
        </>
      );
    }
    if (objectName) {
      return (
        <>
          Editing{"\u00A0\u00A0"}
          <span className="font-semibold">{objectName}</span>
        </>
      );
    }
    return <>Edit Notes (Markdown)</>;
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="relative bg-gray-900 w-[min(90vw,800px)] h-[min(90vh,600px)] rounded-lg shadow-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* moved, centered label (taller) */}
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-xs text-gray-500">
          Markdown Editor
        </div>

        {/* header (removed separator border) */}
        <div className="flex justify-between items-center px-4 pt-6">
          <h3 className="text-lg">{titleContent}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            X
          </button>
        </div>

        {/* editor / preview */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {mode === "edit" ? (
            <textarea
              ref={textareaRef}
              className="flex-1 w-full bg-gray-800 p-3 outline-none resize-none font-mono text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          ) : (
            <div className="flex-1 overflow-auto p-4 prose prose-invert">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {text || "*Nothing to preview…*"}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex justify-between items-center px-4 py-2 border-t border-gray-700">
          <button
            onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm flex items-center"
          >
            {mode === "edit" ? (
              <>
                <Eye size={16} className="mr-1" />
                Preview
              </>
            ) : (
              <>
                <Pencil size={16} className="mr-1" />
                Edit
              </>
            )}
          </button>

          <div className="flex items-center space-x-2">
            {/* Clear button with icon, tooltip, and undoable clear */}
            {mode === "edit" && (
              <button
                title="Clear the entire note"
                onClick={() => {
                  if (textareaRef.current) {
                    textareaRef.current.focus();
                    textareaRef.current.select();
                    document.execCommand("delete");
                  } else {
                    setText("");
                  }
                }}
                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm flex items-center"
              >
                <Trash2 size={16} className="mr-1" />
                Clear
              </button>
            )}
            {/* Visual separator */}
            {mode === "edit" && <span className="mx-2 text-gray-600">|</span>}
            <button
              onClick={onClose}
              className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSave(text);
                onClose();
              }}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-sm"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkdownEditorModal;

// src/components/MarkdownEditorModal.tsx
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface Props {
  initial: string;
  onSave: (md: string) => void;
  onClose: () => void;
}

const MarkdownEditorModal: React.FC<Props> = ({ initial, onSave, onClose }) => {
  const [text, setText] = useState(initial);
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-gray-900 w-[min(90vw,800px)] h-[min(90vh,600px)] rounded-lg shadow-lg flex flex-col">
        {/* header */}
        <div className="flex justify-between items-center px-4 py-2 border-b border-gray-700">
          <h3 className="text-lg">Edit Notes (Markdown)</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* editor / preview */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {mode === "edit" ? (
            <textarea
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
            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
          >
            {mode === "edit" ? "Preview" : "Edit"}
          </button>

          <div className="space-x-2">
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

import React, { useMemo, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Loader2 } from "lucide-react";

interface Props {
  title: string;
  markdown?: string;     // becomes defined once the response arrives
  onClose: () => void;
  onSave?: (newMarkdown: string) => void;
}

const MarkdownResponseModal: React.FC<Props> = ({
  title,
  markdown,
  onClose,
  onSave,
}) => {
  // strip code fences, etc.
  const cleanedMarkdown = useMemo(
    () =>
      markdown
        ?.replace(/```markdown\s*\n([\s\S]*?)```/g, "$1")
        .replace(/\\\[/g, "$$$$")
        .replace(/\\\]/g, "$$$$")
        .replace(/\\\(/g, "$$")
        .replace(/\\\)/g, "$$"),
    [markdown]
  );

  // edit/view state + textarea content
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [text, setText] = useState(cleanedMarkdown || "");

  // reset when new response arrives
  useEffect(() => {
    setText(cleanedMarkdown || "");
    setMode("view");
  }, [cleanedMarkdown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="
          bg-gray-900
          w-auto max-w-[90vw] min-w-[300px]
          h-auto max-h-[90vh] min-h-[200px]
          resize overflow-auto
          rounded-lg shadow-lg flex flex-col
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* header with Edit toggle */}
        <header className="flex justify-between items-center px-4 py-2 border-b border-gray-700">
          <h3 className="text-lg">{title}</h3>
          <div className="flex items-center space-x-2">
            {markdown && (
              <button
                onClick={() => setMode(mode === "view" ? "edit" : "view")}
                className="text-gray-400 hover:text-white text-sm"
              >
                {mode === "view" ? "Edit" : "Cancel"}
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              ✕
            </button>
          </div>
        </header>

        {/* body */}
        <main
          className="
            flex-1 overflow-auto p-4
            prose prose-invert max-w-none
            prose-pre:whitespace-pre-wrap prose-pre:break-words
          "
        >
          {mode === "view" ? (
            cleanedMarkdown ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {cleanedMarkdown}
              </ReactMarkdown>
            ) : (
              <div className="flex justify-center items-center h-full animate-pulse text-gray-400">
                <Loader2 className="mr-2 animate-spin" /> waiting for response…
              </div>
            )
          ) : (
            <textarea
              className="w-full h-full bg-gray-800 p-2 font-mono text-sm outline-none resize-none text-white"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}
        </main>

        {/* footer with Save only in edit */}
        {mode === "edit" && (
          <footer className="flex justify-end px-4 py-2 border-t border-gray-700">
            <button
              onClick={() => {
                onSave?.(text);
                setMode("view");
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-sm rounded"
            >
              Save
            </button>
          </footer>
        )}
      </div>
    </div>
  );
};

export default MarkdownResponseModal;

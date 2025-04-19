// annotationToolbar.tsx
import React, { useEffect } from "react";
import { Paintbrush, Square, XCircle } from "lucide-react";

export type AnnotationMode = "none" | "text" | "rectangle";

interface Props {
  mode: AnnotationMode;
  setMode: (m: AnnotationMode) => void;
}

const cursorForMode: Record<AnnotationMode, string> = {
  none: "default",
  text: "text",
  rectangle: "crosshair",
};

const useGlobalCursor = (mode: AnnotationMode) => {
  useEffect(() => {
    const old = document.body.style.cursor;
    document.body.style.cursor = cursorForMode[mode];
    return () => {
      document.body.style.cursor = old;
    };
  }, [mode]);
};

const ToolBtn: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`flex items-center space-x-2 p-2 rounded text-sm ${
      active ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600 active:bg-gray-500"
    }`}
  >
    {children}
  </button>
);

const AnnotationToolbar: React.FC<Props> = ({ mode, setMode }) => {
  useGlobalCursor(mode);

  const toggle = (m: AnnotationMode) => setMode(mode === m ? "none" : m);

  return (
    <div className="w-48 p-4 border-r border-gray-700 flex flex-col space-y-2">
      <h3 className="text-lg font-semibold mb-1">Tools</h3>

      <ToolBtn active={mode === "text"} onClick={() => toggle("text")}>
        <Paintbrush size={16} /> <span>Highlight</span>
      </ToolBtn>

      <ToolBtn active={mode === "rectangle"} onClick={() => toggle("rectangle")}>
        <Square size={16} /> <span>Rectangle</span>
      </ToolBtn>

      <div className="pt-4 border-t border-gray-700" />

      <ToolBtn active={mode === "none"} onClick={() => setMode("none")}>
        <XCircle size={16} /> <span>Deselect</span>
      </ToolBtn>
    </div>
  );
};

export default AnnotationToolbar;

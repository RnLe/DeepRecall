// src/components/pdfViewer/CollapsiblePanel.tsx
import React, { useState, useEffect } from "react";

interface CollapsiblePanelProps {
  title: string;
  initialOpen?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  children: React.ReactNode;
}

const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  title,
  initialOpen = false,
  onExpandedChange,
  children,
}) => {
  const [expanded, setExpanded] = useState(initialOpen);

  // keep expanded in sync when initialOpen prop changes
  useEffect(() => {
    setExpanded(initialOpen);
    onExpandedChange?.(initialOpen);
  }, [initialOpen]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    onExpandedChange?.(next);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Banner */}
      <div
        onClick={toggle}
        className={`cursor-pointer p-2 bg-gray-800 border-t border-gray-700 text-center text-sm text-white ${
          expanded ? "" : "mt-auto"
        }`}
      >
        {title}
      </div>

      {/* Content */}
      {expanded && <div className="flex-1 overflow-auto">{children}</div>}
    </div>
  );
};

export default CollapsiblePanel;

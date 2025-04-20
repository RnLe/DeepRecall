// src/components/pdfViewer/SidebarContainer.tsx
import React, { useState, useRef, useEffect } from "react";
import { ChevronsUpDown } from "lucide-react";

interface SidebarContainerProps {
  top: React.ReactNode;
  bottom: React.ReactNode;
  /** Whether the bottom pane (i.e. your CollapsiblePanel) is expanded */
  bottomActive: boolean;
  /** Initial bottom panel height as a percentage of container height */
  initialBottomHeightPercent?: number;
  /** Minimum bottom panel height in pixels */
  minBottomHeightPx?: number;
}

const SidebarContainer: React.FC<SidebarContainerProps> = ({
  top,
  bottom,
  bottomActive,
  initialBottomHeightPercent = 50,
  minBottomHeightPx = 100,
}) => {
  const [bottomHeightPercent, setBottomHeightPercent] = useState<number>(
    initialBottomHeightPercent
  );
  const [lastPercent, setLastPercent] = useState<number>(initialBottomHeightPercent);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const topPaneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomActive) {
      // on first expand, measure top list and grow bottom so it starts just below last item
      if (lastPercent === initialBottomHeightPercent && containerRef.current && topPaneRef.current) {
        const totalH = containerRef.current.getBoundingClientRect().height;
        const topH = topPaneRef.current.getBoundingClientRect().height;
        let computed = 100 - (topH / totalH) * 100;
        computed = Math.max(computed, initialBottomHeightPercent);
        setBottomHeightPercent(computed);
      } else {
        setBottomHeightPercent(lastPercent);
      }
    } else {
      setLastPercent(bottomHeightPercent);
    }
  }, [bottomActive]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!bottomActive) return;
    e.preventDefault();
    const startY = e.clientY;
    const startPercent = bottomHeightPercent;
    const container = containerRef.current;
    if (!container) return;
    const totalH = container.getBoundingClientRect().height;
    setIsDragging(true);

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startY;
      const newPx = Math.max(
        minBottomHeightPx,
        Math.min((startPercent / 100) * totalH - delta, totalH - minBottomHeightPx)
      );
      setBottomHeightPercent((newPx / totalH) * 100);
    };
    const onUp = () => {
      setLastPercent(bottomHeightPercent);
      setIsDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // Approx banner height — when collapsed, we leave just this much space
  const bannerHeightPx = 40;

  // Compute flex bases
  const bottomBasis = bottomActive
    ? `${bottomHeightPercent}%`
    : `${bannerHeightPx}px`;
  const topBasis = bottomActive
    ? `${100 - bottomHeightPercent}%`
    : `calc(100% - ${bannerHeightPx}px)`;

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      {/* Top pane with ref for measurement */}
      <div
        ref={topPaneRef}
        style={{
          flex: `0 0 ${topBasis}`,
          transition: isDragging ? "none" : "flex-basis 0.2s ease"
        }}
        className="overflow-auto"
      >
        {top}
      </div>

      {/* Divider only shown when expanded */}
      {bottomActive && (
        <div className="h-4 flex items-center justify-center">
          <div
            className="relative w-full h-2 bg-gray-600 hover:bg-gray-500 cursor-row-resize"
            onMouseDown={handleMouseDown}
          >
            <ChevronsUpDown
              className="absolute inset-0 m-auto h-2 w-2 text-gray-200 pointer-events-none"
            />
          </div>
        </div>
      )}

      {/* Bottom pane (banner + content) */}
      <div
        style={{
          flex: `0 0 ${bottomBasis}`,
          transition: isDragging ? "none" : "flex-basis 0.2s ease"
        }}
        className="overflow-auto"
      >
        {bottom}
      </div>
    </div>
  );
};

export default SidebarContainer;

// src/components/pdfViewer/SidebarContainer.tsx
import React, { useState, useRef, useEffect } from "react";

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
  const containerRef = useRef<HTMLDivElement>(null);

  // When bottomActive toggles, store/restore the last size
  useEffect(() => {
    if (bottomActive) {
      setBottomHeightPercent(lastPercent);
    } else {
      setLastPercent(bottomHeightPercent);
    }
  }, [bottomActive]);

  // Drag‑to‑resize (only when expanded)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!bottomActive) return;
    e.preventDefault();
    const startY = e.clientY;
    const container = containerRef.current;
    if (!container) return;

    const totalH = container.getBoundingClientRect().height;
    const startPx = (bottomHeightPercent / 100) * totalH;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startY;
      const newPx = Math.max(
        minBottomHeightPx,
        Math.min(startPx - delta, totalH - minBottomHeightPx)
      );
      setBottomHeightPercent((newPx / totalH) * 100);
    };
    const onUp = () => {
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
      {/* Top pane */}
      <div style={{ flex: `0 0 ${topBasis}` }} className="overflow-auto">
        {top}
      </div>

      {/* Divider only shown when expanded */}
      {bottomActive && (
        <div className="h-4 flex items-center justify-center">
          <div
            className="h-px w-12 bg-gray-600 hover:bg-gray-500 cursor-row-resize"
            onMouseDown={handleMouseDown}
          />
        </div>
      )}

      {/* Bottom pane (banner + content) */}
      <div style={{ flex: `0 0 ${bottomBasis}` }} className="overflow-auto">
        {bottom}
      </div>
    </div>
  );
};

export default SidebarContainer;

"use client";

// ========================================
// PLATFORM WRAPPERS (from ./DexieGraphVisualization)
// ========================================
import { DexieGraphVisualization } from "./DexieGraphVisualization";

export default function GraphPage() {
  return (
    <div className="flex flex-col h-screen bg-background">
      <DexieGraphVisualization />
    </div>
  );
}

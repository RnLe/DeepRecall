"use client";
import React from "react";
import { useCanvasStore } from "../canvas/CanvasStateContext";
import {
  Cylinder,
  Rectangle as RectType,
} from "@/app/types/meepStudio/canvasElementTypes";

const ObjectPropertiesPanel: React.FC = () => {
  // grab just what we need from the store
  const elements   = useCanvasStore((s) => s.elements);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const update     = useCanvasStore((s) => s.update);

  const el = elements.find((e) => e.id === selectedId);
  if (!el) return null;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-white">Properties</h4>

      {el.kind === "cylinder" && (() => {
        const cyl = el as Cylinder;
        return (
          <>
            <label className="block text-xs text-gray-400">Radius</label>
            <input
              type="number"
              value={cyl.radius}
              onChange={(e) =>
                update(
                  cyl.id,
                  { radius: Number(e.target.value) } as any
                )
              }
              className="w-full bg-gray-800 text-sm"
            />
          </>
        );
      })()}

      {el.kind === "rectangle" && (() => {
        const rect = el as RectType;
        return (
          <>
            <label className="block text-xs text-gray-400">Width</label>
            <input
              type="number"
              value={rect.width}
              onChange={(e) =>
                update(
                  rect.id,
                  { width: Number(e.target.value) } as any
                )
              }
              className="w-full bg-gray-800 text-sm"
            />

            <label className="block text-xs text-gray-400">Height</label>
            <input
              type="number"
              value={rect.height}
              onChange={(e) =>
                update(
                  rect.id,
                  { height: Number(e.target.value) } as any
                )
              }
              className="w-full bg-gray-800 text-sm"
            />
          </>
        );
      })()}

      {/* later: source‐ and PML‐panels here */}
    </div>
  );
};

export default ObjectPropertiesPanel;

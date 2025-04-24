"use client";
import React from "react";
import { useCanvasStore } from "../canvas/CanvasStateContext";
import { CanvasElement } from "@/app/types/meepStudio/canvasElementTypes";

const ObjectPropertiesPanel: React.FC = () => {
  const { el, update } = useCanvasStore((s) => {
    const el = s.elements.find((e) => e.id === s.selectedId) || null;
    return { el, update: s.update };
  });

  if (!el) return null;

  const bind = (field: keyof CanvasElement) => ({
    value: String(el[field] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      update(el.id, { [field]: Number(e.target.value) }),
  });

  return (
    <div className="space-y-1">
      <h4 className="text-sm font-semibold text-white">Properties</h4>

      {el.kind === "cylinder" && (
        <>
          <label className="block text-xs text-gray-400">Radius</label>
          <input {...bind("radius")} className="w-full bg-gray-800 text-sm" />
        </>
      )}

      {el.kind === "rectangle" && (
        <>
          <label className="block text-xs text-gray-400">Width</label>
          <input {...bind("width")} className="w-full bg-gray-800 text-sm" />
          <label className="block text-xs text-gray-400">Height</label>
          <input {...bind("height")} className="w-full bg-gray-800 text-sm" />
        </>
      )}

      {/* add conditional fields for sources etc. */}
    </div>
  );
};

export default ObjectPropertiesPanel;

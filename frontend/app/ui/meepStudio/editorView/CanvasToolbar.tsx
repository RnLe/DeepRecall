"use client";
import React from "react";
import { useCanvasStore } from "../canvas/CanvasStateContext";
import {
  Cylinder,
  Rectangle,
} from "@/app/types/meepStudio/canvasElementTypes";

const CanvasToolbar: React.FC = () => {
  const add = useCanvasStore((s) => s.add);

  const newCylinder = () =>
    add({
      kind: "cylinder",
      pos: { x: 5, y: 5 },
      radius: 1,
    } as Omit<Cylinder, "id">);

  const newRect = () =>
    add({
      kind: "rectangle",
      pos: { x: 10, y: 8 },
      width: 2,
      height: 3,
    } as Omit<Rectangle, "id">);

  return (
    <div className="flex space-x-2 p-2 bg-gray-800 text-white text-xs">
      <button onClick={newCylinder} className="px-2 py-1 bg-blue-600 rounded">
        + Cylinder
      </button>
      <button onClick={newRect} className="px-2 py-1 bg-emerald-600 rounded">
        + Rectangle
      </button>
    </div>
  );
};

export default CanvasToolbar;

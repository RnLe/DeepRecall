"use client";
import React, { useMemo } from "react";
import { Stage, Layer, Line, Circle, Rect } from "react-konva";
import { shallow } from "zustand/shallow";
import { useCanvasStore } from "./CanvasStore";
import {
  Cylinder,
  Rectangle as RectEl,
} from "@/app/types/meepStudio/canvasElementTypes";

/* grid constants ------------------------------------------- */
const GRID_PX = 40;
const GRID_SIZE = 25;
const CANVAS_PX = GRID_PX * GRID_SIZE;

/* helpers --------------------------------------------------- */
const snap = (v: number) => Math.round(v / GRID_PX) * GRID_PX;

/* component ------------------------------------------------- */
const ProjectCanvas: React.FC = () => {
  const {
    cylinders,
    rectangles,
    selectedId,
    selectElement,
    updateCylinder,
    updateRectangle,
    snapToGrid,
  } = useCanvasStore((s) => ({
    cylinders:      s.cylinders,
    rectangles:     s.rectangles,
    selectedId:     s.selectedId,
    selectElement:  s.selectElement,
    updateCylinder: s.updateCylinder,
    updateRectangle: s.updateRectangle,
    snapToGrid:     s.snapToGrid,
  }), shallow);

  /* draw grid once */
  const gridLines = useMemo(() => {
    const lines: React.ReactNode[] = [];
    for (let i = 0; i <= GRID_SIZE; i++) {
      const p = i * GRID_PX;
      lines.push(
        <Line key={`h${i}`} points={[0, p, CANVAS_PX, p]} stroke="#bbb" strokeWidth={0.4} />,
        <Line key={`v${i}`} points={[p, 0, p, CANVAS_PX]} stroke="#bbb" strokeWidth={0.4} />
      );
    }
    return lines;
  }, []);

  /* combine only the element types we render now */
  const elements: (Cylinder | RectEl)[] = [
    ...cylinders,
    ...rectangles,
  ];

  return (
    <div className="flex-1 flex items-center justify-center bg-white">
      <Stage
        width={CANVAS_PX}
        height={CANVAS_PX}
        onMouseDown={(e) => {
          // click on empty space → deselect
          if (e.target === e.target.getStage()) selectElement(null);
        }}
      >
        <Layer>
          {gridLines}
          <Rect
            x={0}
            y={0}
            width={CANVAS_PX}
            height={CANVAS_PX}
            stroke="black"
            strokeWidth={2}
            listening={false}
          />
        </Layer>

        <Layer>
          {elements.map((el) => {
            const isSel = el.id === selectedId;

            if (el.kind === "cylinder") {
              const c = el as Cylinder;
              return (
                <Circle
                  key={c.id}
                  x={c.pos.x * GRID_PX}
                  y={c.pos.y * GRID_PX}
                  radius={c.radius * GRID_PX}
                  fill="rgba(59,130,246,0.25)"
                  stroke="#3b82f6"
                  strokeWidth={1}
                  shadowBlur={isSel ? 8 : 0}
                  draggable
                  // only snap via dragBoundFunc if you want grid‐locking:
                  {...(snapToGrid
                    ? {
                        dragBoundFunc: (pos) => ({ x: snap(pos.x), y: snap(pos.y) }),
                      }
                    : {}
                  )}
                  onDragEnd={(evt) => {
                    const x = evt.target.x() / GRID_PX;
                    const y = evt.target.y() / GRID_PX;
                    updateCylinder(c.id, { pos: { x, y } });
                  }}
                  onClick={() => selectElement(c.id)}
                />
              );
            }

            if (el.kind === "rectangle") {
              const r = el as RectEl;
              return (
                <Rect
                  key={r.id}
                  x={r.pos.x * GRID_PX - r.width * GRID_PX * 0.5}
                  y={r.pos.y * GRID_PX - r.height * GRID_PX * 0.5}
                  width={r.width * GRID_PX}
                  height={r.height * GRID_PX}
                  fill="rgba(16,185,129,0.25)"
                  stroke="#10b981"
                  strokeWidth={1}
                  shadowBlur={isSel ? 8 : 0}
                  draggable
                  {...(snapToGrid
                    ? {
                        dragBoundFunc: (pos) => ({ x: snap(pos.x), y: snap(pos.y) }),
                      }
                    : {}
                  )}
                  onDragEnd={(evt) => {
                    const centerX = (evt.target.x() + r.width * GRID_PX/2) / GRID_PX;
                    const centerY = (evt.target.y() + r.height * GRID_PX/2) / GRID_PX;
                    updateRectangle(r.id, { pos: { x: centerX, y: centerY } });
                  }}
                  onClick={() => selectElement(r.id)}
                />
              );
            }

            return null; // will add sources & PML later
          })}
        </Layer>
      </Stage>
    </div>
  );
};

export default ProjectCanvas;

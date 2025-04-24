"use client";
import React, { useMemo } from "react";
import { Stage, Layer, Line, Circle, Rect } from "react-konva";
import { useCanvasStore } from "./CanvasStateContext";
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
  const { elements, selectedId, select, update } = useCanvasStore((s) => s);

  /* draw grid only once */
  const gridLines = useMemo(() => {
    const lines: React.ReactNode[] = [];
    for (let i = 0; i <= GRID_SIZE; i++) {
      const p = i * GRID_PX;
      lines.push(
        <Line key={`h${i}`} points={[0, p, CANVAS_PX, p]} stroke="#eee" strokeWidth={0.3} />,
        <Line key={`v${i}`} points={[p, 0, p, CANVAS_PX]} stroke="#eee" strokeWidth={0.3} />
      );
    }
    return lines;
  }, []);

  return (
    <div className="flex-1 flex items-center justify-center bg-white">
      <Stage
        width={CANVAS_PX}
        height={CANVAS_PX}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) select(null);
        }}
      >
        <Layer>{gridLines}</Layer>

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
                  draggable
                  shadowBlur={isSel ? 8 : 0}
                  onDragMove={(evt) =>
                    update(c.id, {
                      pos: {
                        x: evt.target.x() / GRID_PX,
                        y: evt.target.y() / GRID_PX,
                      },
                    })
                  }
                  onClick={() => select(c.id)}
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
                  draggable
                  shadowBlur={isSel ? 8 : 0}
                  onDragMove={(evt) =>
                    update(r.id, {
                      pos: {
                        x: snap(evt.target.x() + r.width * GRID_PX * 0.5) / GRID_PX,
                        y: snap(evt.target.y() + r.height * GRID_PX * 0.5) / GRID_PX,
                      },
                    })
                  }
                  onClick={() => select(r.id)}
                />
              );
            }

            return null; // sources & PML later
          })}
        </Layer>
      </Stage>
    </div>
  );
};

export default ProjectCanvas;

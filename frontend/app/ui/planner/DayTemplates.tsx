// DayTemplates.tsx – refined per feedback
"use client";

import React, { useState, useRef, useMemo } from "react";
import { Rnd, type RndDragCallback, type RndResizeCallback } from "react-rnd";
import { nanoid } from "nanoid";
import { usePlannerStore } from "./PlannerStore";
import {
  DayTemplate,
  TimeBlock,
} from "@/app/types/planner/dayTemplateTypes";

/***************************
 * CONSTANTS & HELPERS
 ***************************/
const HOUR_HEIGHT = 32; // px – 1 h
const QUARTER_HEIGHT = HOUR_HEIGHT / 4; // 15 min grid
const TEMPLATE_HEIGHT = HOUR_HEIGHT * 24; // full 24 h column, 768 px

const hours = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`
);

const snap = (y: number) => Math.round(y / QUARTER_HEIGHT) * QUARTER_HEIGHT;

/***************************
 * COMPONENT
 ***************************/
export default function DayTemplates() {
  /* ---------- global store ---------- */
  const templates = usePlannerStore((s) => s.dayTemplates);
  const addTemplate = usePlannerStore((s) => s.addDayTemplate);
  const addBlock = usePlannerStore((s) => s.addTimeBlock);
  const updateBlock = usePlannerStore((s) => s.modifyTimeBlock);

  /* ---------- local‑ui state ---------- */
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [templateDraft, setTemplateDraft] = useState({ name: "", description: "" });
  const [newBlockDraft, setNewBlockDraft] = useState<{
    tId: string;
    start: number;
  } | null>(null);

  /* ---------- sizing ---------- */
  const containerRef = useRef<HTMLDivElement>(null);
  const containerHeight = TEMPLATE_HEIGHT + 50; // fixed; avoids vertical shrink

  const columnWidth = 180;
  const labelColumnWidth = 46;

  /* ---------- handlers ---------- */
  const handleCreateTemplate = () => {
    if (!templateDraft.name.trim()) return;
    addTemplate(
      templateDraft.name.trim(),
      templateDraft.description.trim() || undefined,
    );
    setTemplateDraft({ name: "", description: "" });
    setCreatingTemplate(false);
  };

  const handleGridClick = (
    e: React.MouseEvent,
    tId: string,
    offsetY: number
  ) => {
    e.stopPropagation();
    const y = snap(offsetY);
    setNewBlockDraft({ tId, start: y });
  };

  const saveBlock = (
    tId: string,
    startY: number,
    endY: number,
    title: string,
    description?: string,
    group?: string
  ) => {
    const start = Math.round(startY / QUARTER_HEIGHT) * 15; // in minutes from 0:00
    const end = Math.round(endY / QUARTER_HEIGHT) * 15;
    if (end <= start) return;
    addBlock(tId, {
        startTime: start,
        endTime: end,
        title: title,
        group: group,
        description: description,
    });
  };

  const blockWithin = (
    blocks: TimeBlock[],
    y: number,
    height: number,
    id?: string
  ) => {
    const newStart = Math.round(y / QUARTER_HEIGHT) * 15;
    const newEnd = Math.round((y + height) / QUARTER_HEIGHT) * 15;
    return blocks.some((b) => {
      if (id && b.id === id) return false; // skip self (for resize/move)
      return !(newEnd <= b.startTime || newStart >= b.endTime);
    });
  };

  /* ---------- render ---------- */
  return (
    <div
      ref={containerRef}
      className="flex space-x-4 overflow-x-auto"
      style={{ height: containerHeight }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
    >
      {/* template cards */}
      {templates.map((t) => (
        <div key={t.id} className="flex-none" style={{ width: columnWidth }}>
          {/* card header */}
          <div className="mb-1 px-1 text-center">
            <div className="font-semibold truncate" title={t.name}>{t.name}</div>
            {t.description && (
              <div className="text-xs text-gray-500 truncate" title={t.description}>
                {t.description}
              </div>
            )}
          </div>

          {/* grid */}
          <div
            className="relative border rounded-lg bg-white shadow-sm"
            style={{ height: TEMPLATE_HEIGHT }}
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              handleGridClick(e, t.id, e.clientY - rect.top);
            }}
          >
            {/* hour guide lines & labels */}
            {hours.map((label, i) => (
              <div
                key={label}
                className="absolute left-0 w-full border-t border-gray-200"
                style={{ top: i * HOUR_HEIGHT }}
              >
                <span
                  className="-ml-12 text-[10px] text-gray-400 select-none"
                  style={{ width: labelColumnWidth, display: "inline-block" }}
                >
                  {label}
                </span>
              </div>
            ))}

            {/* blocks */}
            {t.timeBlocks && t.timeBlocks!.map((b) => {
              const y = (b.startTime / 15) * QUARTER_HEIGHT;
              const h = ((b.endTime - b.startTime) / 15) * QUARTER_HEIGHT;
              return (
                <Rnd
                  key={b.id}
                  size={{ width: columnWidth - 2, height: h }}
                  position={{ x: 1, y }}
                  enableResizing={{ top: true, bottom: true, left: false, right: false }}
                  dragAxis="y"
                  bounds="parent"
                  dragGrid={[1, QUARTER_HEIGHT]}
                  resizeGrid={[1, QUARTER_HEIGHT]}
                  minHeight={QUARTER_HEIGHT}
                  disableDragging={false}
                  onDragStart={(e) => e.stopPropagation()}
                  onResizeStart={(e) => e.stopPropagation()}
                  onDrag={(e, d) => {
                    if (blockWithin(t.timeBlocks!, d.y, h, b.id)) {
                      d.y = y; // revert move if overlap
                    }
                  }}
                  onDragStop={(e, d) => {
                    const newY = snap(d.y);
                    if (blockWithin(t.timeBlocks!, newY, h, b.id)) return;
                    updateBlock(t.id, b.id,
                      (newY / QUARTER_HEIGHT) * 15,
                      ((newY + h) / QUARTER_HEIGHT) * 15,
                    );
                  }}
                  onResizeStop={(e, dir, ref, delta, pos) => {
                    const newH = snap(ref.offsetHeight);
                    const newY = snap(pos.y);
                    if (blockWithin(t.timeBlocks!, newY, newH, b.id)) return;
                    updateBlock(t.id, b.id,
                      (newY / QUARTER_HEIGHT) * 15,
                      ((newY + newH) / QUARTER_HEIGHT) * 15,
                    );
                  }}
                  className="bg-blue-500/80 rounded text-[10px] text-white cursor-pointer"
                >
                  <div className="h-full px-1 overflow-hidden flex flex-col justify-center">
                    <div className="font-semibold truncate" title={b.title}>
                      {b.title}
                    </div>
                    {b.group && (
                      <div className="truncate opacity-80" title={b.group}>
                        {b.group}
                      </div>
                    )}
                  </div>
                </Rnd>
              );
            })}

            {/* new‑block pop‑up */}
            {newBlockDraft && newBlockDraft.tId === t.id && (
              <BlockForm
                y={newBlockDraft.start}
                onCancel={() => setNewBlockDraft(null)}
                onSave={(title, description, group, duration) => {console.log("newBlockDraft.start", newBlockDraft.start),
                  saveBlock(
                    t.id,
                    newBlockDraft.start,
                    newBlockDraft.start + duration,
                    title,
                    description,
                    group
                  );
                  setNewBlockDraft(null);
                }}
              />
            )}
          </div>
        </div>
      ))}

      {/* add template card */}
      <div
        className="flex-none border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 cursor-pointer"
        style={{ width: columnWidth, height: containerHeight }}
        onClick={() => setCreatingTemplate(true)}
      >
        + Add Card
        {creatingTemplate && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border rounded p-4 shadow space-y-2 w-56" onClick={(e)=>e.stopPropagation()}>
              <input
                type="text"
                placeholder="Name *"
                className="border px-2 py-1 w-full rounded"
                value={templateDraft.name}
                onChange={(e) => setTemplateDraft({ ...templateDraft, name: e.target.value })}
              />
              <input
                type="text"
                placeholder="Description"
                className="border px-2 py-1 w-full rounded"
                value={templateDraft.description}
                onChange={(e) =>
                  setTemplateDraft({ ...templateDraft, description: e.target.value })
                }
              />
              <div className="flex justify-end space-x-2 text-sm">
                <button className="px-2 py-1" onClick={() => setCreatingTemplate(false)}>
                  Cancel
                </button>
                <button
                  className="px-2 py-1 bg-blue-500 text-white rounded"
                  disabled={!templateDraft.name.trim()}
                  onClick={handleCreateTemplate}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/***************************
 * inline BlockForm component
 ***************************/
function BlockForm({
  y,
  onCancel,
  onSave,
}: {
  y: number;
  onCancel: () => void;
  onSave: (
    title: string,
    description: string | undefined,
    group: string | undefined,
    duration: number
  ) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [group, setGroup] = useState("");
  const [duration, setDuration] = useState(60); // default 1 h

  return (
    <div
      className="absolute left-[2px] right-[2px] bg-white border rounded shadow p-2 space-y-2 text-xs"
      style={{ top: y, zIndex: 30 }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        className="border px-1 py-0.5 w-full rounded"
        placeholder="Title *"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        type="text"
        className="border px-1 py-0.5 w-full rounded"
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        type="text"
        className="border px-1 py-0.5 w-full rounded"
        placeholder="Group"
        value={group}
        onChange={(e) => setGroup(e.target.value)}
      />
      <label className="flex items-center space-x-1">
        <span>Duration:</span>
        <input
          type="number"
          min={15}
          step={15}
          className="border w-16 px-1 py-0.5 rounded"
          value={duration}
          onChange={(e) => setDuration(+e.target.value)}
        />
        <span>min</span>
      </label>
      <div className="flex justify-end space-x-2 pt-1">
        <button onClick={onCancel}>Cancel</button>
        <button
          className="px-2 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
          disabled={!title.trim() || duration < 15}
          onClick={() => onSave(title.trim(), description.trim() || undefined, group.trim() || undefined, duration)}
        >
          Save
        </button>
      </div>
    </div>
  );
}

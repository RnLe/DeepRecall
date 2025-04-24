"use client";
import React from "react";
import { shallow } from "zustand/shallow";
import { useCanvasStore } from "../canvas/CanvasStateContext";

const ObjectsList: React.FC = () => {
  // now uses shallow to compare the 4 fields rather than the wrapper object
  const { elements, selectedId, select, remove } = useCanvasStore(
    (s) => ({
      elements:    s.elements,
      selectedId:  s.selectedId,
      select:      s.select,
      remove:      s.remove,
    }),
    shallow
  );

  return (
    <div className="space-y-1">
      <h4 className="text-sm font-semibold text-white">Objects</h4>
      {elements.map((el) => (
        <div
          key={el.id}
          onClick={() => select(el.id)}
          className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer
            ${selectedId === el.id ? "bg-gray-700" : "hover:bg-gray-800"}`}
        >
          <span className="truncate text-gray-200 text-xs">
            {el.kind} – {el.id.slice(0, 5)}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              remove(el.id);
            }}
            className="text-red-400 hover:text-red-300"
          >
            ✕
          </button>
        </div>
      ))}
      {elements.length === 0 && (
        <p className="text-gray-500 text-xs">No objects yet</p>
      )}
    </div>
  );
};

export default ObjectsList;

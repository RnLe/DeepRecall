"use client";
import React from "react";
import { shallow } from "zustand/shallow";
import { useCanvasStore } from "../canvas/CanvasStore";

const ObjectsList: React.FC = () => {
  const {
    cylinders,
    rectangles,
    continuousSources,
    gaussianSources,
    pmlBoundaries,
    selectedId,
    selectElement,
    removeCylinder,
    removeRectangle,
    removeContinuousSource,
    removeGaussianSource,
    removePmlBoundary,
  } = useCanvasStore(
    (s) => ({
      cylinders: s.cylinders,
      rectangles: s.rectangles,
      continuousSources: s.continuousSources,
      gaussianSources: s.gaussianSources,
      pmlBoundaries: s.pmlBoundaries,
      selectedId: s.selectedId,
      selectElement: s.selectElement,
      removeCylinder: s.removeCylinder,
      removeRectangle: s.removeRectangle,
      removeContinuousSource: s.removeContinuousSource,
      removeGaussianSource: s.removeGaussianSource,
      removePmlBoundary: s.removePmlBoundary,
    }),
    shallow
  );

  const elements = [
    ...cylinders,
    ...rectangles,
    ...continuousSources,
    ...gaussianSources,
    ...pmlBoundaries,
  ];

  const handleRemove = (id: string, kind: string) => {
    switch (kind) {
      case "cylinder":
        removeCylinder(id);
        break;
      case "rectangle":
        removeRectangle(id);
        break;
      case "continuousSource":
        removeContinuousSource(id);
        break;
      case "gaussianSource":
        removeGaussianSource(id);
        break;
      case "pmlBoundary":
        removePmlBoundary(id);
        break;
      default:
        break;
    }
  };

  return (
    <div className="space-y-1">
      <h4 className="text-sm font-semibold text-white">Objects</h4>
      {elements.map((el) => (
        <div
          key={el.id}
          onClick={() => selectElement(el.id)}
          className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer ${
            selectedId === el.id ? "bg-gray-700" : "hover:bg-gray-800"
          }`}
        >
          <span className="truncate text-gray-200 text-xs">
            {el.kind} – {el.id.slice(0, 5)}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemove(el.id, el.kind);
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

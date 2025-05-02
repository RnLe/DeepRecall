"use client";
import React from "react";
import { shallow } from "zustand/shallow";
import { useCanvasStore } from "../canvas/CanvasStore";
import {
  Cylinder,
  Rectangle as RectType,
  ContinuousSource,
  GaussianSource,
  PmlBoundary,
} from "@/app/types/meepStudio/canvasElementTypes";

const ObjectPropertiesPanel: React.FC = () => {
  const {
    cylinders,
    rectangles,
    continuousSources,
    gaussianSources,
    pmlBoundaries,
    selectedId,
    updateCylinder,
    updateRectangle,
    updateContinuousSource,
    updateGaussianSource,
    updatePmlBoundary,
  } = useCanvasStore(
    (s) => ({
      cylinders: s.cylinders,
      rectangles: s.rectangles,
      continuousSources: s.continuousSources,
      gaussianSources: s.gaussianSources,
      pmlBoundaries: s.pmlBoundaries,
      selectedId: s.selectedId,
      updateCylinder: s.updateCylinder,
      updateRectangle: s.updateRectangle,
      updateContinuousSource: s.updateContinuousSource,
      updateGaussianSource: s.updateGaussianSource,
      updatePmlBoundary: s.updatePmlBoundary,
    }),
    shallow
  );

  const el =
    cylinders.find((e) => e.id === selectedId) ??
    rectangles.find((e) => e.id === selectedId) ??
    continuousSources.find((e) => e.id === selectedId) ??
    gaussianSources.find((e) => e.id === selectedId) ??
    pmlBoundaries.find((e) => e.id === selectedId);

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
                updateCylinder(cyl.id, { radius: Number(e.target.value) })
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
                updateRectangle(rect.id, { width: Number(e.target.value) })
              }
              className="w-full bg-gray-800 text-sm"
            />

            <label className="block text-xs text-gray-400">Height</label>
            <input
              type="number"
              value={rect.height}
              onChange={(e) =>
                updateRectangle(rect.id, { height: Number(e.target.value) })
              }
              className="w-full bg-gray-800 text-sm"
            />
          </>
        );
      })()}

      {el.kind === "continuousSource" && (() => {
        const src = el as ContinuousSource;
        return (
          <>
            <label className="block text-xs text-gray-400">Wavelength</label>
            <input
              type="number"
              value={src.wavelength}
              onChange={(e) =>
                updateContinuousSource(src.id, { wavelength: Number(e.target.value) })
              }
              className="w-full bg-gray-800 text-sm"
            />

            <label className="block text-xs text-gray-400">Amplitude</label>
            <input
              type="number"
              value={src.amplitude}
              onChange={(e) =>
                updateContinuousSource(src.id, { amplitude: Number(e.target.value) })
              }
              className="w-full bg-gray-800 text-sm"
            />
          </>
        );
      })()}

      {el.kind === "gaussianSource" && (() => {
        const src = el as GaussianSource;
        return (
          <>
            <label className="block text-xs text-gray-400">Centre Frequency</label>
            <input
              type="number"
              value={src.centreFreq}
              onChange={(e) =>
                updateGaussianSource(src.id, { centreFreq: Number(e.target.value) })
              }
              className="w-full bg-gray-800 text-sm"
            />

            <label className="block text-xs text-gray-400">FWHM</label>
            <input
              type="number"
              value={src.fwhm}
              onChange={(e) =>
                updateGaussianSource(src.id, { fwhm: Number(e.target.value) })
              }
              className="w-full bg-gray-800 text-sm"
            />
          </>
        );
      })()}

      {el.kind === "pmlBoundary" && (() => {
        const pml = el as PmlBoundary;
        return (
          <>
            <label className="block text-xs text-gray-400">Thickness</label>
            <input
              type="number"
              value={pml.thickness}
              onChange={(e) =>
                updatePmlBoundary(pml.id, { thickness: Number(e.target.value) })
              }
              className="w-full bg-gray-800 text-sm"
            />
          </>
        );
      })()}
    </div>
  );
};

export default ObjectPropertiesPanel;

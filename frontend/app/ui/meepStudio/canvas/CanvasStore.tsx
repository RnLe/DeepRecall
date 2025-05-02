"use client";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import { nanoid } from "nanoid";
import {
  Cylinder,
  Rectangle,
  ContinuousSource,
  GaussianSource,
  PmlBoundary,
} from "@/app/types/meepStudio/canvasElementTypes";

// Helper to remove `id` when adding new elements
type WithoutId<T> = Omit<T, "id">;

type CanvasState = {
  // Distinct arrays for each element type
  cylinders: Cylinder[];
  rectangles: Rectangle[];
  continuousSources: ContinuousSource[];
  gaussianSources: GaussianSource[];
  pmlBoundaries: PmlBoundary[];

  // Snapping state
  snapToGrid: boolean;
  toggleSnap: () => void;

  // Currently selected element id (could be any kind)
  selectedId: string | null;
  selectElement: (id: string | null) => void;

  // Cylinder actions
  addCylinder: (e: WithoutId<Cylinder>) => void;
  removeCylinder: (id: string) => void;
  updateCylinder: (id: string, partial: Partial<Cylinder>) => void;

  // Rectangle actions
  addRectangle: (e: WithoutId<Rectangle>) => void;
  removeRectangle: (id: string) => void;
  updateRectangle: (id: string, partial: Partial<Rectangle>) => void;

  // ContinuousSource actions
  addContinuousSource: (e: WithoutId<ContinuousSource>) => void;
  removeContinuousSource: (id: string) => void;
  updateContinuousSource: (id: string, partial: Partial<ContinuousSource>) => void;

  // GaussianSource actions
  addGaussianSource: (e: WithoutId<GaussianSource>) => void;
  removeGaussianSource: (id: string) => void;
  updateGaussianSource: (id: string, partial: Partial<GaussianSource>) => void;

  // PmlBoundary actions
  addPmlBoundary: (e: WithoutId<PmlBoundary>) => void;
  removePmlBoundary: (id: string) => void;
  updatePmlBoundary: (id: string, partial: Partial<PmlBoundary>) => void;
};

export const useCanvasStore = createWithEqualityFn<CanvasState>(
  (set) => ({
    // Initialize arrays and selection
    cylinders: [],
    rectangles: [],
    continuousSources: [],
    gaussianSources: [],
    pmlBoundaries: [],
    selectedId: null,

    // Snapping statesnapToGrid: true,
    snapToGrid: true,
    toggleSnap: () =>
      set((s) => ({ snapToGrid: !s.snapToGrid })),

    // Selection methods
    selectElement: (id) => set({ selectedId: id }),

    // Cylinder methods
    addCylinder: (e) =>
      set((s) => ({
        cylinders: [...s.cylinders, { ...e, id: nanoid() }],
      })),
    removeCylinder: (id) =>
      set((s) => ({
        cylinders: s.cylinders.filter((el) => el.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
      })),
    updateCylinder: (id, partial) =>
      set((s) => ({
        cylinders: s.cylinders.map((el) =>
          el.id === id ? { ...el, ...partial } : el
        ),
      })),

    // Rectangle methods
    addRectangle: (e) =>
      set((s) => ({
        rectangles: [...s.rectangles, { ...e, id: nanoid() }],
      })),
    removeRectangle: (id) =>
      set((s) => ({
        rectangles: s.rectangles.filter((el) => el.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
      })),
    updateRectangle: (id, partial) =>
      set((s) => ({
        rectangles: s.rectangles.map((el) =>
          el.id === id ? { ...el, ...partial } : el
        ),
      })),

    // ContinuousSource methods
    addContinuousSource: (e) =>
      set((s) => ({
        continuousSources: [
          ...s.continuousSources,
          { ...e, id: nanoid() },
        ],
      })),
    removeContinuousSource: (id) =>
      set((s) => ({
        continuousSources: s.continuousSources.filter(
          (el) => el.id !== id
        ),
        selectedId: s.selectedId === id ? null : s.selectedId,
      })),
    updateContinuousSource: (id, partial) =>
      set((s) => ({
        continuousSources: s.continuousSources.map((el) =>
          el.id === id ? { ...el, ...partial } : el
        ),
      })),

    // GaussianSource methods
    addGaussianSource: (e) =>
      set((s) => ({
        gaussianSources: [
          ...s.gaussianSources,
          { ...e, id: nanoid() },
        ],
      })),
    removeGaussianSource: (id) =>
      set((s) => ({
        gaussianSources: s.gaussianSources.filter(
          (el) => el.id !== id
        ),
        selectedId: s.selectedId === id ? null : s.selectedId,
      })),
    updateGaussianSource: (id, partial) =>
      set((s) => ({
        gaussianSources: s.gaussianSources.map((el) =>
          el.id === id ? { ...el, ...partial } : el
        ),
      })),

    // PmlBoundary methods
    addPmlBoundary: (e) =>
      set((s) => ({
        pmlBoundaries: [...s.pmlBoundaries, { ...e, id: nanoid() }],
      })),
    removePmlBoundary: (id) =>
      set((s) => ({
        pmlBoundaries: s.pmlBoundaries.filter(
          (el) => el.id !== id
        ),
        selectedId: s.selectedId === id ? null : s.selectedId,
      })),
    updatePmlBoundary: (id, partial) =>
      set((s) => ({
        pmlBoundaries: s.pmlBoundaries.map((el) =>
          el.id === id ? { ...el, ...partial } : el
        ),
      })),
  }),
  shallow
);

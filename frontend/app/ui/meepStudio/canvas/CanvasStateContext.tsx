/* 100 % self-contained zustand hook – no extra context needed */
"use client";
import create from "zustand";
import { nanoid } from "nanoid";
import {
  CanvasElement,
  Cylinder,
  Rectangle,
  ContinuousSource,
  GaussianSource,
  PmlBoundary,
} from "@/app/types/meepStudio/canvasElementTypes";

/* helpers --------------------------------------------------- */
type WithoutId<T> = Omit<T, "id">;

/* store ----------------------------------------------------- */
interface CanvasState {
  elements: CanvasElement[];
  selectedId: string | null;

  add: (e: WithoutId<CanvasElement>) => void;
  remove: (id: string) => void;
  select: (id: string | null) => void;
  update: (id: string, partial: Partial<CanvasElement>) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  elements: [],
  selectedId: null,

  add: (e) =>
    set((s) => ({
      elements: [...s.elements, { ...e, id: nanoid() } as CanvasElement],
    })),

  remove: (id) =>
    set((s) => ({
      elements: s.elements.filter((el) => el.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  select: (id) => set({ selectedId: id }),

  update: (id, partial) =>
    set((s) => ({
      elements: s.elements.map((el) =>
        el.id === id ? ({ ...el, ...partial } as CanvasElement) : el
      ),
    })),
}));

import { Vector2d } from "konva/lib/types";

/** Discriminated union tag */
export type ElementType = "cylinder" | "rectangle" | "continuousSource" | "gaussianSource" | "pmlBoundary";

// Geometry types
// Sphere, Cylinder, Wedge, Cone, Block, Ellipsoid, Prism

/** Common to *all* drawables */
interface BaseElement {
  /** stable id – never re-use, generated with nanoid() */
  id: string;
  type: ElementType;
  /** centre position in lattice units (a = 1) */
  pos: Vector2d;
  /** rotation in radians (may stay 0 for now) */
  rotation?: number;
  /** true ⇢ highlighted in UI (selection logic lives in context) */
  selected?: boolean;
}

interface GeometricObject {
  material?: string;
}

/* ---------- geometry ---------- */
export interface Cylinder extends BaseElement {
  kind: "cylinder";
  radius: number;
  
}

export interface Rectangle extends BaseElement {
  kind: "rectangle";
  width: number;
  height: number;
}

/* ---------- sources ---------- */
export interface ContinuousSource extends BaseElement {
  kind: "continuousSource";
  wavelength: number;
  amplitude: number;
}

export interface GaussianSource extends BaseElement {
  kind: "gaussianSource";
  centreFreq: number;
  fwhm: number;
}

/* ---------- boundaries ---------- */
export interface PmlBoundary extends BaseElement {
  kind: "pmlBoundary";
  thickness: number;
}

export type CanvasElement =
  | Cylinder
  | Rectangle
  | ContinuousSource
  | GaussianSource
  | PmlBoundary;

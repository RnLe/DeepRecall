/**
 * Scene Objects - Logical Entities
 * Strokes, images, PDF pages, hotspots, etc.
 */

import type { Point, Rect } from "../core/math";
import type {
  StrokePoint,
  StrokeStyle,
  Stroke as CoreStroke,
} from "@deeprecall/core";

/**
 * Base scene object interface
 */
export interface SceneObject {
  id: string;
  kind: string;
  boundingBox: Rect;
  layer?: string;
  zIndex?: number;
  visible?: boolean;
  locked?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Stroke object (extends core Stroke type)
 */
export interface StrokeObject extends SceneObject {
  kind: "stroke";
  boardId: string;
  points: StrokePoint[];
  style: StrokeStyle;
}

/**
 * Image object
 */
export interface ImageObject extends SceneObject {
  kind: "image";
  boardId: string;
  blobHash: string;
  width: number;
  height: number;
  position: Point;
  rotation?: number;
  scale?: number;
}

/**
 * PDF page object
 */
export interface PdfPageObject extends SceneObject {
  kind: "pdfPage";
  boardId: string;
  documentHash: string;
  pageNumber: number;
  position: Point;
  scale: number;
}

/**
 * Text box object
 */
export interface TextBoxObject extends SceneObject {
  kind: "textBox";
  boardId: string;
  text: string;
  position: Point;
  width: number;
  fontSize: number;
  fontFamily?: string;
  color?: string;
}

/**
 * Hotspot/link object
 */
export interface HotspotObject extends SceneObject {
  kind: "hotspot";
  boardId: string;
  targetUrl?: string;
  targetBoardId?: string;
  targetAnnotationId?: string;
}

/**
 * Union type of all scene objects
 */
export type AnySceneObject =
  | StrokeObject
  | ImageObject
  | PdfPageObject
  | TextBoxObject
  | HotspotObject;

/**
 * Convert core Stroke to SceneObject
 */
export function strokeToSceneObject(stroke: CoreStroke): StrokeObject {
  return {
    ...stroke,
    kind: "stroke",
    visible: true,
    locked: false,
  };
}

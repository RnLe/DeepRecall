/**
 * Spatial Index - R-tree for Hit Testing
 * Worker-based spatial queries using rbush
 */

import RBush from "rbush";
import type { Rect } from "../core/math";
import { MathUtils, expandRect } from "../core/math";
import type { AnySceneObject } from "../scene/objects";

/**
 * R-tree item (bounding box + object ID)
 */
interface RTreeItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
}

/**
 * Convert scene object to R-tree item
 */
function objectToRTreeItem(obj: AnySceneObject): RTreeItem {
  return {
    minX: obj.boundingBox.x,
    minY: obj.boundingBox.y,
    maxX: obj.boundingBox.x + obj.boundingBox.width,
    maxY: obj.boundingBox.y + obj.boundingBox.height,
    id: obj.id,
  };
}

/**
 * Convert Rect to R-tree search box
 */
function rectToSearchBox(rect: Rect) {
  return {
    minX: rect.x,
    minY: rect.y,
    maxX: rect.x + rect.width,
    maxY: rect.y + rect.height,
  };
}

/**
 * Spatial index using R-tree
 */
export class SpatialIndex {
  private tree: RBush<RTreeItem>;
  private objects: Map<string, AnySceneObject>;

  constructor() {
    this.tree = new RBush<RTreeItem>();
    this.objects = new Map();
  }

  /**
   * Insert or update object in index
   */
  insert(obj: AnySceneObject): void {
    // Remove existing entry if present
    this.remove(obj.id);

    // Add to tree and map
    const item = objectToRTreeItem(obj);
    this.tree.insert(item);
    this.objects.set(obj.id, obj);
  }

  /**
   * Insert multiple objects
   */
  insertMany(objects: AnySceneObject[]): void {
    const items = objects.map(objectToRTreeItem);
    this.tree.load(items);
    objects.forEach((obj) => this.objects.set(obj.id, obj));
  }

  /**
   * Remove object from index
   */
  remove(id: string): void {
    const obj = this.objects.get(id);
    if (obj) {
      const item = objectToRTreeItem(obj);
      this.tree.remove(item, (a: RTreeItem, b: RTreeItem) => a.id === b.id);
      this.objects.delete(id);
    }
  }

  /**
   * Clear all objects
   */
  clear(): void {
    this.tree.clear();
    this.objects.clear();
  }

  /**
   * Query objects in region
   */
  queryRegion(region: Rect): string[] {
    const searchBox = rectToSearchBox(region);
    const items = this.tree.search(searchBox);
    return items.map((item: RTreeItem) => item.id);
  }

  /**
   * Query objects near a point (with tolerance)
   */
  queryPoint(x: number, y: number, tolerance: number = 10): string[] {
    const region: Rect = {
      x: x - tolerance,
      y: y - tolerance,
      width: tolerance * 2,
      height: tolerance * 2,
    };
    return this.queryRegion(region);
  }

  /**
   * Find nearest object to a point (within maxDistance)
   */
  findNearest(x: number, y: number, maxDistance: number = 50): string | null {
    const candidates = this.queryPoint(x, y, maxDistance);

    let nearestId: string | null = null;
    let nearestDist = maxDistance;

    for (const id of candidates) {
      const obj = this.objects.get(id);
      if (!obj) continue;

      // Calculate distance to bounding box
      const dist = distanceToRect({ x, y }, obj.boundingBox);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = id;
      }
    }

    return nearestId;
  }

  /**
   * Get object by ID
   */
  getObject(id: string): AnySceneObject | undefined {
    return this.objects.get(id);
  }

  /**
   * Get all object IDs
   */
  getAllIds(): string[] {
    return Array.from(this.objects.keys());
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      count: this.objects.size,
      treeDepth: this.tree.toJSON().height,
    };
  }
}

/**
 * Calculate distance from point to rectangle
 */
function distanceToRect(point: { x: number; y: number }, rect: Rect): number {
  const closestX = Math.max(rect.x, Math.min(point.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(point.y, rect.y + rect.height));

  const dx = point.x - closestX;
  const dy = point.y - closestY;

  return Math.sqrt(dx * dx + dy * dy);
}

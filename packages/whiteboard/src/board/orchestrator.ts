/**
 * Board Orchestrator - Scheduler, Dirty Regions, Undo/Redo
 */

import type { AnySceneObject, StrokeObject } from "../scene/objects";
import type { Rect } from "../core/math";
import { SpatialIndex } from "../index/spatial";
import { LayerManager } from "../scene/layers";

/**
 * Command for undo/redo
 */
export interface Command {
  type: string;
  execute(): void;
  undo(): void;
}

/**
 * Board state
 */
export interface BoardState {
  objects: Map<string, AnySceneObject>;
  dirtyRegions: Set<string>; // Tile IDs that need redraw
}

/**
 * Board orchestrator
 */
export class BoardOrchestrator {
  private state: BoardState;
  private spatialIndex: SpatialIndex;
  private layerManager: LayerManager;
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  constructor() {
    this.state = {
      objects: new Map(),
      dirtyRegions: new Set(),
    };
    this.spatialIndex = new SpatialIndex();
    this.layerManager = new LayerManager();
  }

  /**
   * Get all objects
   */
  getObjects(): AnySceneObject[] {
    return Array.from(this.state.objects.values());
  }

  /**
   * Get visible objects sorted by z-order
   */
  getVisibleObjects(): AnySceneObject[] {
    const objects = this.getObjects();
    const visible = this.layerManager.filterVisibleObjects(objects);
    return this.layerManager.sortObjectsByZOrder(visible);
  }

  /**
   * Get object by ID
   */
  getObject(id: string): AnySceneObject | undefined {
    return this.state.objects.get(id);
  }

  /**
   * Add or update object
   */
  addObject(obj: AnySceneObject): void {
    this.state.objects.set(obj.id, obj);
    this.spatialIndex.insert(obj);
    this.markDirty(obj.boundingBox);
  }

  /**
   * Remove object
   */
  removeObject(id: string): void {
    const obj = this.state.objects.get(id);
    if (obj) {
      this.state.objects.delete(id);
      this.spatialIndex.remove(id);
      this.markDirty(obj.boundingBox);
    }
  }

  /**
   * Query objects in region
   */
  queryRegion(region: Rect): AnySceneObject[] {
    const ids = this.spatialIndex.queryRegion(region);
    return ids
      .map((id) => this.state.objects.get(id))
      .filter((obj): obj is AnySceneObject => obj !== undefined);
  }

  /**
   * Find object at point
   */
  findObjectAt(x: number, y: number, tolerance: number = 10): string | null {
    return this.spatialIndex.findNearest(x, y, tolerance);
  }

  /**
   * Mark region as dirty (needs redraw)
   */
  markDirty(region: Rect): void {
    // TODO: Convert region to tile IDs and add to dirtyRegions
    // For now, just mark entire board as dirty
  }

  /**
   * Clear dirty regions
   */
  clearDirty(): void {
    this.state.dirtyRegions.clear();
  }

  /**
   * Get layer manager
   */
  getLayers(): LayerManager {
    return this.layerManager;
  }

  /**
   * Execute command (with undo/redo support)
   */
  executeCommand(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack
  }

  /**
   * Undo last command
   */
  undo(): void {
    const command = this.undoStack.pop();
    if (command) {
      command.undo();
      this.redoStack.push(command);
    }
  }

  /**
   * Redo last undone command
   */
  redo(): void {
    const command = this.redoStack.pop();
    if (command) {
      command.execute();
      this.undoStack.push(command);
    }
  }

  /**
   * Can undo?
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Can redo?
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Clear all objects
   */
  clear(): void {
    this.state.objects.clear();
    this.spatialIndex.clear();
    this.state.dirtyRegions.clear();
    this.undoStack = [];
    this.redoStack = [];
  }
}

/**
 * Layers - Layer Management
 * Organize objects into named layers with z-order
 */

import type { AnySceneObject } from "./objects";

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  zIndex: number;
}

/**
 * Default layer configuration
 */
export const DEFAULT_LAYERS: Layer[] = [
  {
    id: "background",
    name: "Background",
    visible: true,
    locked: false,
    opacity: 1,
    zIndex: 0,
  },
  {
    id: "pdf",
    name: "PDF",
    visible: true,
    locked: false,
    opacity: 1,
    zIndex: 10,
  },
  {
    id: "media",
    name: "Media",
    visible: true,
    locked: false,
    opacity: 1,
    zIndex: 20,
  },
  {
    id: "strokes",
    name: "Strokes",
    visible: true,
    locked: false,
    opacity: 1,
    zIndex: 30,
  },
  {
    id: "annotations",
    name: "Annotations",
    visible: true,
    locked: false,
    opacity: 1,
    zIndex: 40,
  },
  {
    id: "selection",
    name: "Selection",
    visible: true,
    locked: false,
    opacity: 1,
    zIndex: 50,
  },
];

/**
 * Layer manager
 */
export class LayerManager {
  private layers: Map<string, Layer>;

  constructor(initialLayers: Layer[] = DEFAULT_LAYERS) {
    this.layers = new Map(initialLayers.map((layer) => [layer.id, layer]));
  }

  /**
   * Get all layers sorted by z-index
   */
  getLayers(): Layer[] {
    return Array.from(this.layers.values()).sort((a, b) => a.zIndex - b.zIndex);
  }

  /**
   * Get layer by ID
   */
  getLayer(id: string): Layer | undefined {
    return this.layers.get(id);
  }

  /**
   * Add or update layer
   */
  setLayer(layer: Layer): void {
    this.layers.set(layer.id, layer);
  }

  /**
   * Remove layer
   */
  removeLayer(id: string): void {
    this.layers.delete(id);
  }

  /**
   * Toggle layer visibility
   */
  toggleVisibility(id: string): void {
    const layer = this.layers.get(id);
    if (layer) {
      layer.visible = !layer.visible;
    }
  }

  /**
   * Set layer opacity
   */
  setOpacity(id: string, opacity: number): void {
    const layer = this.layers.get(id);
    if (layer) {
      layer.opacity = Math.max(0, Math.min(1, opacity));
    }
  }

  /**
   * Reorder layer (change z-index)
   */
  reorderLayer(id: string, newZIndex: number): void {
    const layer = this.layers.get(id);
    if (layer) {
      layer.zIndex = newZIndex;
    }
  }

  /**
   * Filter objects by layer visibility
   */
  filterVisibleObjects(objects: AnySceneObject[]): AnySceneObject[] {
    return objects.filter((obj) => {
      if (!obj.visible) return false;
      if (!obj.layer) return true;
      const layer = this.layers.get(obj.layer);
      return layer ? layer.visible : true;
    });
  }

  /**
   * Sort objects by layer z-index and object z-index
   */
  sortObjectsByZOrder(objects: AnySceneObject[]): AnySceneObject[] {
    return [...objects].sort((a, b) => {
      const layerA = a.layer ? this.layers.get(a.layer) : undefined;
      const layerB = b.layer ? this.layers.get(b.layer) : undefined;

      const layerZA = layerA?.zIndex ?? 0;
      const layerZB = layerB?.zIndex ?? 0;

      if (layerZA !== layerZB) {
        return layerZA - layerZB;
      }

      // Within same layer, sort by object z-index
      const objZA = a.zIndex ?? 0;
      const objZB = b.zIndex ?? 0;
      return objZA - objZB;
    });
  }
}

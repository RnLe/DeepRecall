/**
 * Tiling System
 * Manages infinite canvas by dividing into fixed-size tiles
 */

import type { Point, Rect } from "./math";
import { MathUtils } from "./math";

export const TILE_CONFIG = {
  TILE_SIZE: 1024, // World units
  MAX_TILES_CACHE: 256, // LRU cache limit
} as const;

/**
 * Tile coordinate
 */
export interface TileCoord {
  x: number;
  y: number;
  level: number; // LOD level (0 = base, 1 = half res, etc.)
}

/**
 * Tile identifier
 */
export type TileId = string; // Format: "level:x:y"

/**
 * Convert tile coord to unique ID
 */
export function tileCoordToId(coord: TileCoord): TileId {
  return `${coord.level}:${coord.x}:${coord.y}`;
}

/**
 * Parse tile ID back to coord
 */
export function tileIdToCoord(id: TileId): TileCoord {
  const [level, x, y] = id.split(":").map(Number);
  return { level, x, y };
}

/**
 * Get tile coordinate for a world point
 */
export function worldToTile(point: Point, level: number = 0): TileCoord {
  const tileSize = TILE_CONFIG.TILE_SIZE * Math.pow(2, level);
  return {
    x: Math.floor(point.x / tileSize),
    y: Math.floor(point.y / tileSize),
    level,
  };
}

/**
 * Get world bounds for a tile
 */
export function tileToWorldBounds(coord: TileCoord): Rect {
  const tileSize = TILE_CONFIG.TILE_SIZE * Math.pow(2, coord.level);
  return {
    x: coord.x * tileSize,
    y: coord.y * tileSize,
    width: tileSize,
    height: tileSize,
  };
}

/**
 * Get all tiles that intersect with a world region
 */
export function getTilesInRegion(region: Rect, level: number = 0): TileCoord[] {
  const tileSize = TILE_CONFIG.TILE_SIZE * Math.pow(2, level);

  const minTileX = Math.floor(region.x / tileSize);
  const minTileY = Math.floor(region.y / tileSize);
  const maxTileX = Math.floor((region.x + region.width) / tileSize);
  const maxTileY = Math.floor((region.y + region.height) / tileSize);

  const tiles: TileCoord[] = [];
  for (let y = minTileY; y <= maxTileY; y++) {
    for (let x = minTileX; x <= maxTileX; x++) {
      tiles.push({ x, y, level });
    }
  }

  return tiles;
}

/**
 * Determine appropriate LOD level based on zoom
 */
export function getLODLevel(scale: number): number {
  if (scale < 0.25) return 2; // Quarter resolution
  if (scale < 0.5) return 1; // Half resolution
  return 0; // Full resolution
}

/**
 * Check if two tiles are neighbors (adjacent, including diagonals)
 */
export function tilesAreNeighbors(a: TileCoord, b: TileCoord): boolean {
  if (a.level !== b.level) return false;
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx <= 1 && dy <= 1 && (dx > 0 || dy > 0);
}

/**
 * Strokes Electric Repository (Sync Layer)
 *
 * Subscribes to Electric shape for strokes and provides type-safe hooks
 */

import { useShape } from "../electric";
import { type Stroke } from "@deeprecall/core";

/**
 * Subscribe to all strokes (filtered by board on client side)
 */
export function useStrokes(boardId: string | undefined) {
  return useShape<Stroke>({
    table: "strokes",
    where: boardId ? `board_id = '${boardId}'` : undefined,
  });
}

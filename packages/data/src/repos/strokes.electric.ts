/**
 * Strokes Electric Repository (Sync Layer)
 *
 * Subscribes to Electric shape for strokes and provides type-safe hooks
 */

import { useShape } from "../electric";
import { type Stroke } from "@deeprecall/core";

/**
 * Subscribe to all strokes (filtered by board on client side)
 * @param boardId - Optional board ID filter
 * @param userId - Owner filter for multi-tenant isolation
 */
export function useStrokes(boardId: string | undefined, userId?: string) {
  const where: string[] = [];
  if (boardId) where.push(`board_id = '${boardId}'`);
  if (userId) where.push(`owner_id = '${userId}'`);

  return useShape<Stroke>({
    table: "strokes",
    where: where.length > 0 ? where.join(" AND ") : undefined,
  });
}

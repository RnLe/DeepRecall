/**
 * Boards Electric Repository (Sync Layer)
 *
 * Subscribes to Electric shape for boards and provides type-safe hooks
 */

import { useShape } from "../electric";
import { type Board } from "@deeprecall/core";

/**
 * Subscribe to boards shape from Electric
 * @param userId - Owner filter for multi-tenant isolation
 */
export function useBoards(userId?: string) {
  return useShape<Board>({
    table: "boards",
    where: userId ? `owner_id = '${userId}'` : undefined,
  });
}

/**
 * Subscribe to a single board by ID
 */
export function useBoard(id: string | undefined) {
  return useShape<Board>({
    table: "boards",
    where: id ? `id = '${id}'` : undefined,
  });
}

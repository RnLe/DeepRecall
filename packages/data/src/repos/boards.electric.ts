/**
 * Boards Electric Repository (Sync Layer)
 *
 * Subscribes to Electric shape for boards and provides type-safe hooks
 */

import { useShape } from "../electric";
import { type Board } from "@deeprecall/core";

/**
 * Subscribe to boards shape from Electric
 */
export function useBoards() {
  return useShape<Board>({
    table: "boards",
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

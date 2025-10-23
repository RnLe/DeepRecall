/**
 * Local repository for Card entities (Optimistic Layer)
 * Instant writes to Dexie, queued for background sync
 */

import type { Card } from "@deeprecall/core";
import { CardSchema } from "@deeprecall/core";
import { db } from "../db";
import { createWriteBuffer } from "../writeBuffer";

const buffer = createWriteBuffer();

/**
 * Create a new card (instant local write)
 * Writes to Dexie immediately, enqueues for server sync
 */
export async function createCardLocal(
  data: Omit<Card, "id" | "created_ms">
): Promise<Card> {
  const card: Card = {
    ...data,
    id: crypto.randomUUID(),
    created_ms: Date.now(),
  };

  const validated = CardSchema.parse(card);

  // Write to local table (instant)
  await db.cards_local.add({
    id: validated.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: validated,
  });

  // Enqueue for server sync (background)
  await buffer.enqueue({
    table: "cards",
    op: "insert",
    payload: validated,
  });

  console.log(`[CardsLocal] Created card ${card.id} (pending sync)`);
  return validated;
}

/**
 * Update a card (instant local write)
 */
export async function updateCardLocal(
  id: string,
  updates: Partial<Omit<Card, "id" | "created_ms">>
): Promise<void> {
  const updated = { id, ...updates };

  // Write to local table (instant)
  await db.cards_local.add({
    id,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: updated as any, // Partial update data
  });

  // Enqueue for server sync (background)
  await buffer.enqueue({
    table: "cards",
    op: "update",
    payload: updated,
  });

  console.log(`[CardsLocal] Updated card ${id} (pending sync)`);
}

/**
 * Delete a card (instant local write)
 */
export async function deleteCardLocal(id: string): Promise<void> {
  // Write to local table (instant)
  await db.cards_local.add({
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
    data: { id } as any, // Delete only needs ID
  });

  // Enqueue for server sync (background)
  await buffer.enqueue({
    table: "cards",
    op: "delete",
    payload: { id },
  });

  console.log(`[CardsLocal] Deleted card ${id} (pending sync)`);
}

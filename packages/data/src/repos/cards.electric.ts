/**
 * Repository for Card entities (Electric + WriteBuffer version)
 */

import type { Card, ReviewLog } from "@deeprecall/core";
import { CardSchema, ReviewLogSchema } from "@deeprecall/core";
import { useShape } from "../electric";
import { createWriteBuffer } from "../writeBuffer";
import { logger } from "@deeprecall/telemetry";

export function useCards() {
  return useShape<Card>({ table: "cards" });
}

export function useCard(id: string | undefined) {
  const result = useShape<Card>({
    table: "cards",
    where: id ? `id = '${id}'` : undefined,
  });
  return { ...result, data: result.data?.[0] };
}

export function useCardsByDoc(sha256: string) {
  return useShape<Card>({
    table: "cards",
    where: `sha256 = '${sha256}'`,
  });
}

export function useCardsByAnnotation(annotationId: string) {
  return useShape<Card>({
    table: "cards",
    where: `annotation_id = '${annotationId}'`,
  });
}

export function useDueCards(nowMs: number) {
  return useShape<Card>({
    table: "cards",
    where: `due <= ${nowMs}`,
  });
}

const buffer = createWriteBuffer();

export async function createCard(
  data: Omit<Card, "id" | "created_ms">
): Promise<Card> {
  const card: Card = {
    ...data,
    id: crypto.randomUUID(),
    created_ms: Date.now(),
  };
  const validated = CardSchema.parse(card);
  await buffer.enqueue({ table: "cards", op: "insert", payload: validated });
  logger.info("db.local", "Created card", { cardId: card.id });
  return validated;
}

export async function updateCard(
  id: string,
  updates: Partial<Omit<Card, "id" | "created_ms">>
): Promise<void> {
  await buffer.enqueue({
    table: "cards",
    op: "update",
    payload: { id, ...updates },
  });
  logger.info("db.local", "Updated card", { cardId: id });
}

export async function deleteCard(id: string): Promise<void> {
  await buffer.enqueue({ table: "cards", op: "delete", payload: { id } });
  logger.info("db.local", "Deleted card", { cardId: id });
}

export async function createReviewLog(log: ReviewLog): Promise<ReviewLog> {
  const validated = ReviewLogSchema.parse(log);
  await buffer.enqueue({
    table: "review_logs",
    op: "insert",
    payload: validated,
  });
  logger.info("db.local", "Created review log", { logId: log.id });
  return validated;
}

export function useReviewLogsByCard(cardId: string) {
  return useShape<ReviewLog>({
    table: "review_logs",
    where: `card_id = '${cardId}'`,
  });
}

/**
 * Card repository
 * Encapsulates Dexie operations for SRS cards
 */

import { db } from "@/src/db/dexie";
import type { Card, ReviewLog } from "@/src/schema/cards";

export const cardRepo = {
  /** Get all cards for a document */
  byDoc: (sha256: string) => 
    db.cards.where("sha256").equals(sha256).toArray(),

  /** Get cards for a specific annotation */
  byAnnotation: (annotationId: string) =>
    db.cards.where("annotation_id").equals(annotationId).toArray(),

  /** Get cards due for review (due <= now) */
  listDue: (now: number) =>
    db.cards.where("due").belowOrEqual(now).toArray(),

  /** Add or update a card */
  put: (card: Card) => db.cards.put(card),

  /** Remove a card */
  remove: (id: string) => db.cards.delete(id),

  /** Get a single card by id */
  get: (id: string) => db.cards.get(id),
};

export const reviewLogRepo = {
  /** Add a review log entry */
  add: (log: ReviewLog) => db.reviewLogs.add(log),

  /** Get logs for a card */
  byCard: (cardId: string) =>
    db.reviewLogs.where("card_id").equals(cardId).sortBy("review_ms"),
};

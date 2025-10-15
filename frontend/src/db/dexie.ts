/**
 * Dexie database setup
 * Local-first durable storage for annotations, cards, review logs
 */

import Dexie, { type EntityTable } from "dexie";
import type { Annotation } from "@/src/schema/annotations";
import type { Card, ReviewLog } from "@/src/schema/cards";

class DeepRecallDB extends Dexie {
  annotations!: EntityTable<Annotation, "id">;
  cards!: EntityTable<Card, "id">;
  reviewLogs!: EntityTable<ReviewLog, "id">;

  constructor() {
    super("DeepRecallDB");
    this.version(1).stores({
      annotations: "id, sha256, page, type, created_ms",
      cards: "id, annotation_id, sha256, due, state, created_ms",
      reviewLogs: "id, card_id, review_ms",
    });
  }
}

export const db = new DeepRecallDB();

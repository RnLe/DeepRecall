/**
 * Annotation repository
 * Encapsulates Dexie operations for annotations
 */

import { db } from "@/src/db/dexie";
import type { Annotation } from "@/src/schema/annotations";

export const annotationRepo = {
  /** Get all annotations for a document */
  byDoc: (sha256: string) => 
    db.annotations.where("sha256").equals(sha256).toArray(),

  /** Get annotations for a specific page */
  byPage: (sha256: string, page: number) =>
    db.annotations.where({ sha256, page }).toArray(),

  /** Add or update an annotation */
  put: (ann: Annotation) => db.annotations.put(ann),

  /** Remove an annotation */
  remove: (id: string) => db.annotations.delete(id),

  /** Get a single annotation by id */
  get: (id: string) => db.annotations.get(id),
};

/**
 * Repository for Author entities (Electric + WriteBuffer version)
 */

import type { Author } from "@deeprecall/core";
import { AuthorSchema } from "@deeprecall/core";
import { useShape } from "../electric";
import { createWriteBuffer } from "../writeBuffer";
import { logger } from "@deeprecall/telemetry";

export function useAuthors(userId?: string) {
  return useShape<Author>({
    table: "authors",
    where: userId ? `owner_id = '${userId}'` : undefined,
  });
}

export function useAuthor(id: string | undefined) {
  const result = useShape<Author>({
    table: "authors",
    where: id ? `id = '${id}'` : undefined,
  });
  return { ...result, data: result.data?.[0] };
}

export function useAuthorsByIds(ids: string[]) {
  return useShape<Author>({
    table: "authors",
    where:
      ids.length > 0
        ? `id IN (${ids.map((id) => `'${id}'`).join(",")})`
        : undefined,
  });
}

const buffer = createWriteBuffer();

export async function createAuthor(
  data: Omit<Author, "id" | "kind" | "createdAt" | "updatedAt">
): Promise<Author> {
  const now = new Date().toISOString();
  const author: Author = {
    ...data,
    id: crypto.randomUUID(),
    kind: "author",
    createdAt: now,
    updatedAt: now,
  };
  const validated = AuthorSchema.parse(author);
  await buffer.enqueue({ table: "authors", op: "insert", payload: validated });
  logger.info("db.local", "Created author (enqueued)", { authorId: author.id });
  return validated;
}

export async function updateAuthor(
  id: string,
  updates: Partial<Omit<Author, "id" | "kind" | "createdAt">>
): Promise<void> {
  const updated = { id, ...updates, updatedAt: new Date().toISOString() };
  await buffer.enqueue({ table: "authors", op: "update", payload: updated });
  logger.info("db.local", "Updated author (enqueued)", { authorId: id });
}

export async function deleteAuthor(id: string): Promise<void> {
  await buffer.enqueue({ table: "authors", op: "delete", payload: { id } });
  logger.info("db.local", "Deleted author (enqueued)", { authorId: id });
}

export function searchAuthorsByName(
  authors: Author[],
  query: string
): Author[] {
  const lower = query.toLowerCase();
  return authors.filter(
    (a) =>
      a.firstName.toLowerCase().includes(lower) ||
      a.lastName.toLowerCase().includes(lower)
  );
}

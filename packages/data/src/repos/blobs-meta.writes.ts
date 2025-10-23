/**
 * Blob metadata write operations (server-safe, no React hooks)
 * These can be imported in server-side code without triggering React hook errors
 */

import { createWriteBuffer } from "../writeBuffer";

const buffer = createWriteBuffer();

export interface CreateBlobMetaInput {
  sha256: string;
  size: number;
  mime: string;
  filename?: string | null;
  pageCount?: number;
  imageWidth?: number;
  imageHeight?: number;
  lineCount?: number;
}

/**
 * Create a blob metadata entry
 */
export async function createBlobMeta(
  input: CreateBlobMetaInput
): Promise<void> {
  const now = Date.now();

  await buffer.enqueue({
    table: "blobs_meta",
    op: "insert",
    payload: {
      sha256: input.sha256,
      size: input.size,
      mime: input.mime,
      filename: input.filename ?? null,
      page_count: input.pageCount ?? null,
      image_width: input.imageWidth ?? null,
      image_height: input.imageHeight ?? null,
      line_count: input.lineCount ?? null,
      created_ms: now,
    },
  });

  console.log(
    `[BlobsMetaWrites] Created blob meta ${input.sha256.slice(0, 16)}... (enqueued)`
  );
}

/**
 * Update blob metadata
 */
export async function updateBlobMeta(
  sha256: string,
  updates: {
    size?: number;
    mime?: string;
    filename?: string | null;
    pageCount?: number;
    imageWidth?: number;
    imageHeight?: number;
    lineCount?: number;
  }
): Promise<void> {
  await buffer.enqueue({
    table: "blobs_meta",
    op: "update",
    payload: {
      sha256,
      ...(updates.size !== undefined && { size: updates.size }),
      ...(updates.mime !== undefined && { mime: updates.mime }),
      ...(updates.filename !== undefined && { filename: updates.filename }),
      ...(updates.pageCount !== undefined && { page_count: updates.pageCount }),
      ...(updates.imageWidth !== undefined && {
        image_width: updates.imageWidth,
      }),
      ...(updates.imageHeight !== undefined && {
        image_height: updates.imageHeight,
      }),
      ...(updates.lineCount !== undefined && { line_count: updates.lineCount }),
    },
  });

  console.log(
    `[BlobsMetaWrites] Updated blob meta ${sha256.slice(0, 16)}... (enqueued)`
  );
}

/**
 * Delete blob metadata
 */
export async function deleteBlobMeta(sha256: string): Promise<void> {
  await buffer.enqueue({
    table: "blobs_meta",
    op: "delete",
    payload: { sha256 },
  });

  console.log(
    `[BlobsMetaWrites] Deleted blob meta ${sha256.slice(0, 16)}... (enqueued)`
  );
}

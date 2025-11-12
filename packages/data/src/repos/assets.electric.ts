/**
 * Repository for Asset entities (Electric + WriteBuffer version)
 */

import type { Asset } from "@deeprecall/core";
import { AssetSchema } from "@deeprecall/core";
import { useShape } from "../electric";
import { createWriteBuffer } from "../writeBuffer";
import { logger } from "@deeprecall/telemetry";

export function useAssets(userId?: string) {
  return useShape<Asset>({
    table: "assets",
    where: userId ? `owner_id = '${userId}'` : undefined,
  });
}

export function useAsset(id: string | undefined) {
  const result = useShape<Asset>({
    table: "assets",
    where: id ? `id = '${id}'` : undefined,
  });
  return { ...result, data: result.data?.[0] };
}

export function useAssetsByWork(workId: string) {
  return useShape<Asset>({
    table: "assets",
    where: `work_id = '${workId}'`,
  });
}

export function useAssetByHash(sha256: string) {
  const result = useShape<Asset>({
    table: "assets",
    where: `sha256 = '${sha256}'`,
  });
  return { ...result, data: result.data?.[0] };
}

const buffer = createWriteBuffer();

export async function createAsset(
  data: Omit<Asset, "id" | "createdAt" | "updatedAt">
): Promise<Asset> {
  const now = new Date().toISOString();
  const asset: Asset = {
    ...data,
    id: crypto.randomUUID(),
    kind: "asset",
    createdAt: now,
    updatedAt: now,
  };
  const validated = AssetSchema.parse(asset);
  await buffer.enqueue({ table: "assets", op: "insert", payload: validated });
  logger.info("db.postgres", "Created asset (enqueued)", {
    assetId: asset.id,
    workId: asset.workId,
  });
  return validated;
}

export async function updateAsset(
  id: string,
  updates: Partial<Omit<Asset, "id" | "kind" | "createdAt">>
): Promise<void> {
  const updated = { id, ...updates, updatedAt: new Date().toISOString() };
  await buffer.enqueue({ table: "assets", op: "update", payload: updated });
  logger.info("db.postgres", "Updated asset (enqueued)", {
    assetId: id,
    fields: Object.keys(updates),
  });
}

export async function deleteAsset(id: string): Promise<void> {
  await buffer.enqueue({ table: "assets", op: "delete", payload: { id } });
  logger.info("db.postgres", "Deleted asset (enqueued)", { assetId: id });
}

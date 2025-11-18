import { FolderSourceSchema } from "@deeprecall/core";

export function mapRowToFolderSource(row: any) {
  return FolderSourceSchema.parse({
    id: row.id,
    kind: row.kind ?? "folder_source",
    ownerId: row.owner_id,
    deviceId: row.device_id,
    type: row.type,
    displayName: row.display_name,
    path: row.path ?? undefined,
    pathHash: row.path_hash ?? undefined,
    uri: row.uri ?? undefined,
    priority: row.priority,
    isDefault: row.is_default,
    status: row.status,
    metadata: row.metadata ?? undefined,
    lastScanStartedAt: row.last_scan_started_at
      ? new Date(row.last_scan_started_at).toISOString()
      : undefined,
    lastScanCompletedAt: row.last_scan_completed_at
      ? new Date(row.last_scan_completed_at).toISOString()
      : undefined,
    lastError: row.last_error ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  });
}

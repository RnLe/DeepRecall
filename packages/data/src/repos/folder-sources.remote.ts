/**
 * Remote Folder Sources repository (REST via Next.js API)
 */

import type {
  FolderSource,
  FolderSourceRegistration,
  FolderSourceStatus,
  FolderSourceType,
} from "@deeprecall/core";

const API_BASE = "/api/sources";

type ListParams = {
  deviceId?: string;
  type?: FolderSourceType;
  status?: FolderSourceStatus;
};

type UpdatePayload = Partial<
  Omit<
    FolderSource,
    | "id"
    | "ownerId"
    | "kind"
    | "createdAt"
    | "updatedAt"
    | "deviceId"
    | "priority"
  > & { priority: number }
> &
  Pick<FolderSource, "priority" | "isDefault" | "status" | "displayName"> & {
    path?: string | null;
    pathHash?: string | null;
    uri?: string | null;
    metadata?: Record<string, unknown>;
    lastScanStartedAt?: string;
    lastScanCompletedAt?: string;
    lastError?: string | null;
  };

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = await response.json();
      message = data.error || message;
    } catch (_) {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function listRemoteFolderSources(
  params: ListParams = {}
): Promise<FolderSource[]> {
  const search = new URLSearchParams();
  if (params.deviceId) search.set("deviceId", params.deviceId);
  if (params.type) search.set("type", params.type);
  if (params.status) search.set("status", params.status);

  const url = search.toString() ? `${API_BASE}?${search}` : API_BASE;
  const response = await fetch(url, { credentials: "include" });
  const data = await handleResponse<{ sources: FolderSource[] }>(response);
  return data.sources ?? [];
}

export async function registerRemoteFolderSource(
  payload: FolderSourceRegistration & {
    deviceId: string;
    status?: FolderSourceStatus;
  }
): Promise<FolderSource> {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ source: FolderSource }>(response);
  return data.source;
}

export async function updateRemoteFolderSource(
  sourceId: string,
  payload: UpdatePayload
): Promise<FolderSource> {
  const response = await fetch(`${API_BASE}/${sourceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ source: FolderSource }>(response);
  return data.source;
}

export async function deleteRemoteFolderSource(
  sourceId: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/${sourceId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok && response.status !== 204) {
    let message = response.statusText;
    try {
      const data = await response.json();
      message = data.error || message;
    } catch (_) {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }
}

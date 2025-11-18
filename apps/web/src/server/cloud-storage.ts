/**
 * Placeholder cloud storage adapter
 *
 * Desktop/Mobile will eventually talk to a dedicated file-sync service.
 * For now, keep the interface narrow and throw informative errors so API
 * endpoints can safely short-circuit or fall back to local CAS behavior.
 */

import type { Readable } from "node:stream";
import { logger } from "@deeprecall/telemetry";

export type CloudSourceKind = "canonical" | "edge-cache";

export interface CloudSourceRecord {
  id: string;
  ownerId: string;
  displayName: string;
  type: CloudSourceKind;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface CloudReplicationPlan {
  sha256: string;
  presentOnDevices: string[];
  pendingDevices: string[];
  bytes: number;
}

export interface CloudStorageAdapter {
  listSources(ownerId: string): Promise<CloudSourceRecord[]>;
  registerSource(
    record: Omit<CloudSourceRecord, "createdAt" | "updatedAt">
  ): Promise<CloudSourceRecord>;
  deleteSource(sourceId: string): Promise<void>;
  planReplication(sha256: string): Promise<CloudReplicationPlan>;
  fetchBlobStream(sha256: string): Promise<Readable | null>;
}

const notConfiguredError = () =>
  new Error("Cloud storage adapter not configured yet (stub)");

const placeholderAdapter: CloudStorageAdapter = {
  async listSources() {
    logger.debug("sync.coordination", "Cloud storage stub listSources");
    return [];
  },
  async registerSource() {
    throw notConfiguredError();
  },
  async deleteSource() {
    throw notConfiguredError();
  },
  async planReplication() {
    throw notConfiguredError();
  },
  async fetchBlobStream() {
    throw notConfiguredError();
  },
};

export function getCloudStorageAdapter(): CloudStorageAdapter {
  return placeholderAdapter;
}

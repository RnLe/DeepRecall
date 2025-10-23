/**
 * Repository for ReplicationJob entities (Electric + WriteBuffer)
 *
 * ReplicationJob manages background blob sync between devices and cloud storage.
 */

import type { ReplicationJob, ReplicationStatus } from "@deeprecall/core";
import { ReplicationJobSchema } from "@deeprecall/core";
import { useShape } from "../electric";
import { createWriteBuffer } from "../writeBuffer";

/**
 * Get all replication jobs
 */
export function useReplicationJobs() {
  return useShape<ReplicationJob>({ table: "replication_jobs" });
}

/**
 * Get replication jobs by status
 */
export function useReplicationJobsByStatus(
  status: ReplicationStatus | undefined
) {
  return useShape<ReplicationJob>({
    table: "replication_jobs",
    where: status ? `status = '${status}'` : undefined,
  });
}

/**
 * Get replication jobs for a specific blob
 */
export function useReplicationJobsByBlob(sha256: string | undefined) {
  return useShape<ReplicationJob>({
    table: "replication_jobs",
    where: sha256 ? `sha256 = '${sha256}'` : undefined,
  });
}

/**
 * Get a specific replication job by ID
 */
export function useReplicationJob(id: string | undefined) {
  const result = useShape<ReplicationJob>({
    table: "replication_jobs",
    where: id ? `id = '${id}'` : undefined,
  });
  return { ...result, data: result.data?.[0] };
}

/**
 * Get pending replication jobs (sorted by priority)
 */
export function usePendingReplicationJobs() {
  return useShape<ReplicationJob>({
    table: "replication_jobs",
    where: `status = 'pending'`,
  });
}

const buffer = createWriteBuffer();

/**
 * Create a replication job
 */
export async function createReplicationJob(
  data: Omit<
    ReplicationJob,
    "id" | "createdAt" | "updatedAt" | "startedAt" | "completedAt"
  >
): Promise<ReplicationJob> {
  const now = new Date().toISOString();
  const replicationJob: ReplicationJob = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const validated = ReplicationJobSchema.parse(replicationJob);
  await buffer.enqueue({
    table: "replication_jobs",
    op: "insert",
    payload: validated,
  });
  console.log(
    `[ReplicationJobsRepo] Created replication job ${replicationJob.id} for ${replicationJob.sha256} (enqueued)`
  );
  return validated;
}

/**
 * Update a replication job
 */
export async function updateReplicationJob(
  id: string,
  updates: Partial<Omit<ReplicationJob, "id" | "createdAt">>
): Promise<void> {
  const updated = { id, ...updates, updatedAt: new Date().toISOString() };
  await buffer.enqueue({
    table: "replication_jobs",
    op: "update",
    payload: updated,
  });
  console.log(`[ReplicationJobsRepo] Updated replication job ${id} (enqueued)`);
}

/**
 * Delete a replication job
 */
export async function deleteReplicationJob(id: string): Promise<void> {
  await buffer.enqueue({
    table: "replication_jobs",
    op: "delete",
    payload: { id },
  });
  console.log(`[ReplicationJobsRepo] Deleted replication job ${id} (enqueued)`);
}

/**
 * Convenience: Start a replication job
 */
export async function startReplicationJob(id: string): Promise<void> {
  return updateReplicationJob(id, {
    status: "in_progress",
    startedAt: new Date().toISOString(),
  });
}

/**
 * Convenience: Complete a replication job
 */
export async function completeReplicationJob(id: string): Promise<void> {
  return updateReplicationJob(id, {
    status: "completed",
    progress: 100,
    completedAt: new Date().toISOString(),
  });
}

/**
 * Convenience: Fail a replication job
 */
export async function failReplicationJob(
  id: string,
  error: string
): Promise<void> {
  return updateReplicationJob(id, {
    status: "failed",
    error,
  });
}

/**
 * Convenience: Cancel a replication job
 */
export async function cancelReplicationJob(id: string): Promise<void> {
  return updateReplicationJob(id, {
    status: "cancelled",
  });
}

/**
 * Convenience: Update replication progress
 */
export async function updateReplicationProgress(
  id: string,
  progress: number,
  bytesTransferred: number
): Promise<void> {
  return updateReplicationJob(id, {
    progress,
    bytesTransferred,
  });
}

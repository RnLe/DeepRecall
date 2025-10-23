/**
 * Replication Job Hooks
 * React hooks for managing blob replication across devices
 */

import type { ReplicationJob, ReplicationStatus } from "@deeprecall/core";
import { useShape } from "../electric";

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

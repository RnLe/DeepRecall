/**
 * Replication Job Hooks
 * React hooks for managing blob replication across devices
 */

import type { ReplicationJob, ReplicationStatus } from "@deeprecall/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useShape } from "../electric";
import { db } from "../db";

/**
 * Sync Electric data to Dexie (replace entire table)
 */
async function syncElectricToDexie(
  electricData: ReplicationJob[]
): Promise<void> {
  await db.transaction("rw", db.replicationJobs, async () => {
    const currentIds = new Set(
      (await db.replicationJobs.toCollection().primaryKeys()) as string[]
    );
    const electricIds = new Set(electricData.map((e) => e.id));
    const idsToDelete = Array.from(currentIds).filter(
      (id) => !electricIds.has(id)
    );

    if (idsToDelete.length > 0) {
      await db.replicationJobs.bulkDelete(idsToDelete);
      console.log(
        `[Electric→Dexie] Deleted ${idsToDelete.length} stale replication_jobs`
      );
    }
    if (electricData.length > 0) {
      await db.replicationJobs.bulkPut(electricData);
      console.log(
        `[Electric→Dexie] Synced ${electricData.length} replication_jobs`
      );
    } else if (idsToDelete.length === 0 && currentIds.size === 0) {
      console.log(`[Electric→Dexie] replication_jobs: empty (no changes)`);
    }
  });
}

/**
 * Internal sync hook - subscribes to Electric and syncs to Dexie
 * MUST be called exactly once by SyncManager to avoid race conditions
 * DO NOT call from components - use useReplicationJobs() instead
 */
export function useReplicationJobsSync() {
  const electricResult = useShape<ReplicationJob>({
    table: "replication_jobs",
  });
  const queryClient = useQueryClient();

  // Sync Electric → Dexie
  useEffect(() => {
    if (
      !electricResult.isLoading &&
      electricResult.data !== undefined
      // Note: Sync even with stale cache data - having stale data is better than no data
    ) {
      syncElectricToDexie(electricResult.data)
        .then(() => {
          // Invalidate all replication jobs queries to trigger cross-device updates
          queryClient.invalidateQueries({ queryKey: ["replication-jobs"] });
        })
        .catch((error) => {
          console.error(
            "[useReplicationJobsSync] Failed to sync replication_jobs:",
            error
          );
        });
    }
  }, [electricResult.data, electricResult.isFreshData, queryClient]);

  return null;
}

/**
 * Get all replication jobs
 * Read-only - queries Dexie without side effects
 */
export function useReplicationJobs() {
  return useQuery({
    queryKey: ["replication-jobs", "all"],
    queryFn: async () => {
      try {
        return await db.replicationJobs.toArray();
      } catch (error) {
        console.error("[useReplicationJobs] Error:", error);
        return [];
      }
    },
    placeholderData: [],
    staleTime: 0,
  });
}

/**
 * Get replication jobs by status
 * Read-only - queries Dexie without side effects
 */
export function useReplicationJobsByStatus(
  status: ReplicationStatus | undefined
) {
  return useQuery({
    queryKey: ["replication-jobs", "status", status],
    queryFn: async () => {
      if (!status) return [];
      try {
        return await db.replicationJobs
          .where("status")
          .equals(status)
          .toArray();
      } catch (error) {
        console.error("[useReplicationJobsByStatus] Error:", error);
        return [];
      }
    },
    enabled: !!status,
    staleTime: 0,
  });
}

/**
 * Get replication jobs for a specific blob
 * Read-only - queries Dexie without side effects
 */
export function useReplicationJobsByBlob(sha256: string | undefined) {
  return useQuery({
    queryKey: ["replication-jobs", "blob", sha256],
    queryFn: async () => {
      if (!sha256) return [];
      try {
        return await db.replicationJobs
          .where("sha256")
          .equals(sha256)
          .toArray();
      } catch (error) {
        console.error("[useReplicationJobsByBlob] Error:", error);
        return [];
      }
    },
    enabled: !!sha256,
    staleTime: 0,
  });
}

/**
 * Get a specific replication job by ID
 * Read-only - queries Dexie without side effects
 */
export function useReplicationJob(id: string | undefined) {
  return useQuery({
    queryKey: ["replication-jobs", "id", id],
    queryFn: async () => {
      if (!id) return undefined;
      try {
        return await db.replicationJobs.get(id);
      } catch (error) {
        console.error("[useReplicationJob] Error:", error);
        return undefined;
      }
    },
    enabled: !!id,
    staleTime: 0,
  });
}

/**
 * Get pending replication jobs (sorted by priority)
 * Read-only - queries Dexie without side effects
 */
export function usePendingReplicationJobs() {
  return useQuery({
    queryKey: ["replication-jobs", "pending"],
    queryFn: async () => {
      try {
        return await db.replicationJobs
          .where("status")
          .equals("pending")
          .sortBy("priority");
      } catch (error) {
        console.error("[usePendingReplicationJobs] Error:", error);
        return [];
      }
    },
    staleTime: 0,
  });
}

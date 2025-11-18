import { useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { FolderPlus, Info, Loader2 } from "lucide-react";
import type { FolderSourceStatus, FolderSource } from "@deeprecall/core";
import {
  useFolderSources,
  resolveDefaultFolderSource,
} from "@deeprecall/data/hooks";
import { folderSourcesLocal } from "@deeprecall/data/repos";
import { getDeviceId, getDeviceName } from "@deeprecall/data";
import { logger } from "@deeprecall/telemetry";
import { emitNotification } from "../components/NotificationsHost";

type FolderScanStats = {
  fileCount: number;
  maxDepth: number;
  fileLimitBreached: boolean;
  depthLimitBreached: boolean;
};

type PendingSelection = {
  path: string;
  name: string;
  stats: FolderScanStats;
};

const AUTO_FILE_LIMIT = 100;
const AUTO_DEPTH_LIMIT = 5;
const STATUS_COLORS: Record<FolderSourceStatus, string> = {
  idle: "bg-emerald-500/10 text-emerald-200 border border-emerald-500/40",
  scanning: "bg-sky-500/10 text-sky-200 border border-sky-500/40",
  syncing: "bg-indigo-500/10 text-indigo-200 border border-indigo-500/40",
  degraded: "bg-amber-500/10 text-amber-200 border border-amber-500/40",
  error: "bg-rose-500/10 text-rose-200 border border-rose-500/40",
  disabled: "bg-slate-600/40 text-slate-200 border border-slate-500/40",
};

async function analyzeFolder(path: string): Promise<FolderScanStats> {
  let fileCount = 0;
  let maxDepth = 1;
  let fileLimitBreached = false;
  let depthLimitBreached = false;
  const visited = new Set<string>();

  type Entry = Awaited<ReturnType<typeof readDir>>[number];

  async function walk(currentPath: string, depth: number): Promise<void> {
    if (fileLimitBreached || depthLimitBreached) return;
    maxDepth = Math.max(maxDepth, depth);

    if (depth > AUTO_DEPTH_LIMIT) {
      depthLimitBreached = true;
      return;
    }

    let entries: Entry[] = [];

    try {
      entries = await readDir(currentPath);
    } catch (error) {
      logger.error("sync.coordination", "Failed to read directory", {
        path: currentPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Could not read ${currentPath}. Check permissions and try again.`
      );
    }

    for (const entry of entries) {
      if (fileLimitBreached || depthLimitBreached) return;

      if (entry.isFile) {
        fileCount += 1;
        if (fileCount > AUTO_FILE_LIMIT) {
          fileLimitBreached = true;
          return;
        }
      } else if (entry.isDirectory) {
        const childPath = await join(currentPath, entry.name);
        if (visited.has(childPath)) continue;
        visited.add(childPath);
        await walk(childPath, depth + 1);
      }
    }
  }

  visited.add(path);
  await walk(path, 1);

  return {
    fileCount,
    maxDepth,
    fileLimitBreached,
    depthLimitBreached,
  };
}

function formatTimestamp(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch (_error) {
    return value;
  }
}

function getFolderName(path: string) {
  const segments = path.split(/[\\/]+/).filter(Boolean);
  return segments[segments.length - 1] || path;
}

function StatusBadge({ status }: { status: FolderSourceStatus }) {
  const className = STATUS_COLORS[status] ?? STATUS_COLORS.idle;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {status}
    </span>
  );
}

export default function SourcesPage() {
  const [pendingSelection, setPendingSelection] =
    useState<PendingSelection | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [manualSyncingId, setManualSyncingId] = useState<string | null>(null);
  const [deviceId] = useState(() => getDeviceId());
  const [deviceName] = useState(() => getDeviceName());

  const { data: mergedSources = [], isLoading, error } = useFolderSources();

  const defaultSource = useMemo(() => {
    return resolveDefaultFolderSource(mergedSources, deviceId, {
      allowCrossDeviceFallback: true,
    });
  }, [mergedSources, deviceId]);

  const localSources = useMemo(() => {
    return mergedSources.filter((source) => source.deviceId === deviceId);
  }, [mergedSources, deviceId]);

  const manualSources = useMemo(() => {
    return localSources.filter((source) =>
      Boolean(
        (source.metadata as { manualOverride?: boolean } | undefined)
          ?.manualOverride
      )
    );
  }, [localSources]);

  const manualReviewCount = manualSources.length;

  const crossDeviceCount = mergedSources.length - localSources.length;

  const handleFolderSelection = async () => {
    setPendingSelection(null);

    try {
      const selection = await open({
        directory: true,
        multiple: false,
        title: "Select a folder to sync",
      });

      if (!selection) return;

      const folderPath = Array.isArray(selection) ? selection[0] : selection;
      if (!folderPath) return;

      setIsScanning(true);
      const stats = await analyzeFolder(folderPath);
      const name = getFolderName(folderPath);
      const requiresManual =
        stats.fileLimitBreached || stats.depthLimitBreached;

      const selectionData: PendingSelection = {
        path: folderPath,
        name,
        stats,
      };

      if (requiresManual) {
        setPendingSelection(selectionData);
        emitNotification({
          kind: "warning",
          title: "Manual review required",
          description: `"${name}" exceeds automatic limits (${stats.fileLimitBreached ? `>${AUTO_FILE_LIMIT}` : stats.fileCount} files, depth ${
            stats.depthLimitBreached ? `>${AUTO_DEPTH_LIMIT}` : stats.maxDepth
          }). Approve it below to continue.`,
        });
        logger.warn(
          "sync.coordination",
          "Folder selection requires manual approval",
          {
            folderPath,
            fileCount: stats.fileCount,
            maxDepth: stats.maxDepth,
          }
        );
      } else {
        await registerSelection(selectionData, false);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to analyze folder.";
      emitNotification({
        kind: "error",
        title: "Folder scan failed",
        description: message,
      });
    } finally {
      setIsScanning(false);
    }
  };

  async function registerSelection(
    selection: PendingSelection,
    manualOverride: boolean
  ) {
    setIsRegistering(true);
    try {
      await folderSourcesLocal.registerFolderSourceLocal({
        type: "local",
        displayName: selection.name,
        path: selection.path,
        deviceId,
        isDefault: mergedSources.length === 0,
        metadata: {
          fileCount: selection.stats.fileCount,
          maxDepth: selection.stats.maxDepth,
          manualOverride,
        },
      });

      emitNotification({
        kind: "success",
        title: "Folder registered",
        description: `"${selection.name}" is queued for ingestion.`,
      });
      setPendingSelection(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to register folder.";
      emitNotification({
        kind: "error",
        title: "Registration failed",
        description: message,
      });
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleManualSync(source: FolderSource) {
    if (!source.path) {
      emitNotification({
        kind: "error",
        title: "Manual sync unavailable",
        description: "This source does not have a local filesystem path.",
      });
      return;
    }

    setManualSyncingId(source.id);
    try {
      const stats = await analyzeFolder(source.path);
      const now = new Date().toISOString();
      const metadata = {
        ...((source.metadata as Record<string, unknown>) ?? {}),
        manualOverride: false,
        manualApprovedAt: now,
        fileCount: stats.fileCount,
        maxDepth: stats.maxDepth,
        lastManualReviewAt: now,
      } as Record<string, unknown>;

      await folderSourcesLocal.updateFolderSourceLocal(source.id, {
        metadata,
        status: "scanning",
        lastScanStartedAt: now,
      });

      emitNotification({
        kind: "success",
        title: "Manual sync triggered",
        description: `"${source.displayName}" is unlocked (${stats.fileCount} files, depth ${stats.maxDepth}).`,
      });
      logger.info("sync.coordination", "Manual sync released", {
        sourceId: source.id,
        fileCount: stats.fileCount,
        maxDepth: stats.maxDepth,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to scan folder.";
      emitNotification({
        kind: "error",
        title: "Manual sync failed",
        description: message,
      });
      logger.error("sync.coordination", "Manual sync failed", {
        sourceId: source.id,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setManualSyncingId(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-5xl px-8 py-10 space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-gray-500">
              Desktop · Sources
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              Folder Sources
            </h1>
            <p className="text-sm text-gray-400">
              Register trusted folders on this device and keep ingestion under
              control.
            </p>
          </div>
          <button
            type="button"
            onClick={handleFolderSelection}
            disabled={isScanning || isRegistering}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-600/20 px-4 py-2 text-sm font-medium text-blue-100 hover:bg-blue-600/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isScanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderPlus className="h-4 w-4" />
            )}
            {isScanning ? "Scanning..." : "Select Folder"}
          </button>
        </header>

        {error ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error instanceof Error
              ? error.message
              : "Failed to load folder sources."}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/5 bg-white/5 p-4 shadow-inner shadow-black/20">
            <p className="text-xs uppercase tracking-wide text-gray-400">
              Default target
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {defaultSource ? defaultSource.displayName : "Not set"}
            </p>
            <p className="text-xs text-gray-500">
              Device · {defaultSource ? defaultSource.deviceId : deviceName}
            </p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/5 p-4 shadow-inner shadow-black/20">
            <p className="text-xs uppercase tracking-wide text-gray-400">
              Local sources
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {localSources.length}
            </p>
            <p className="text-xs text-gray-500">
              {mergedSources.length} total registered
            </p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/5 p-4 shadow-inner shadow-black/20">
            <p className="text-xs uppercase tracking-wide text-gray-400">
              Cross-device
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {Math.max(crossDeviceCount, 0)}
            </p>
            <p className="text-xs text-gray-500">Read-only context</p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/5 p-4 shadow-inner shadow-black/20">
            <p className="text-xs uppercase tracking-wide text-gray-400">
              Manual review
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {manualReviewCount}
            </p>
            <p className="text-xs text-gray-500">Awaiting manual sync</p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 bg-gray-900/60 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Info className="h-4 w-4 text-gray-400" />
              <span>
                Automatic ingestion is limited to {AUTO_FILE_LIMIT} files and
                depth {AUTO_DEPTH_LIMIT}. Larger folders stay paused until you
                approve them here.
              </span>
            </div>
          </div>
          {pendingSelection ? (
            <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-100">
                    Manual sync required for "{pendingSelection.name}"
                  </p>
                  <p className="text-xs text-amber-200">
                    {pendingSelection.stats.fileLimitBreached
                      ? `>${AUTO_FILE_LIMIT}`
                      : pendingSelection.stats.fileCount}{" "}
                    files · depth{" "}
                    {pendingSelection.stats.depthLimitBreached
                      ? `>${AUTO_DEPTH_LIMIT}`
                      : pendingSelection.stats.maxDepth}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingSelection(null)}
                    className="rounded-lg border border-amber-300/60 px-3 py-2 text-xs font-medium text-amber-100 hover:bg-amber-400/20"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => registerSelection(pendingSelection, true)}
                    disabled={isRegistering}
                    className="rounded-lg border border-amber-300/60 bg-amber-400/20 px-4 py-2 text-xs font-semibold text-amber-50 hover:bg-amber-400/30 disabled:opacity-60"
                  >
                    {isRegistering ? "Registering..." : "Register anyway"}
                  </button>
                </div>
              </div>
              <p className="mt-3 text-xs text-amber-200">
                Manual approval keeps large trees paused until you verify
                storage and bandwidth.
              </p>
            </div>
          ) : null}
          {manualSources.length > 0 ? (
            <div className="mt-6 border-t border-white/5 pt-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-white">
                  Manual review queue
                </h3>
                <p className="text-xs text-gray-400">
                  These folders stay paused until you rerun a scan and approve
                  them. Use manual sync when you are ready to ingest despite the
                  size.
                </p>
              </div>
              <div className="mt-4 space-y-3">
                {manualSources.map((source) => {
                  const metadata = (source.metadata || {}) as {
                    fileCount?: number;
                    maxDepth?: number;
                  };

                  return (
                    <div
                      key={source.id}
                      className="flex flex-col gap-3 rounded-xl border border-amber-400/30 bg-amber-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-amber-100">
                          {source.displayName}
                        </p>
                        <p className="text-xs text-amber-200">
                          {metadata.fileCount ?? "—"} files · depth{" "}
                          {metadata.maxDepth ?? "—"}
                        </p>
                        <p className="text-[11px] text-amber-200/80">
                          {source.path || "Unknown path"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleManualSync(source)}
                          disabled={manualSyncingId === source.id}
                          className="rounded-lg border border-amber-300/60 bg-amber-400/20 px-3 py-2 text-xs font-semibold text-amber-50 hover:bg-amber-400/30 disabled:cursor-wait disabled:opacity-60"
                        >
                          {manualSyncingId === source.id
                            ? "Running manual sync..."
                            : "Start manual sync"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/5 bg-gray-900/60">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Registered Sources
              </h2>
              <p className="text-xs text-gray-400">
                Synced view combines local changes with Electric data.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/5 text-sm">
              <thead className="bg-white/5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Metrics</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-gray-400"
                    >
                      Loading sources...
                    </td>
                  </tr>
                ) : mergedSources.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-gray-400"
                    >
                      No folders registered yet. Select one to get started.
                    </td>
                  </tr>
                ) : (
                  mergedSources.map((source) => {
                    const metadata = (source.metadata || {}) as {
                      fileCount?: number;
                      maxDepth?: number;
                      manualOverride?: boolean;
                    };
                    const badge = metadata.manualOverride ? (
                      <span className="ml-2 inline-flex items-center rounded-full border border-amber-400/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">
                        Manual
                      </span>
                    ) : null;

                    return (
                      <tr
                        key={source.id}
                        className={
                          source.deviceId === deviceId
                            ? "bg-white/5"
                            : undefined
                        }
                      >
                        <td className="px-4 py-3 align-top">
                          <div className="font-semibold text-white flex items-center gap-2">
                            {source.isDefault ? (
                              <span className="text-emerald-300 text-xs uppercase tracking-wide">
                                Default
                              </span>
                            ) : null}
                            {source.displayName}
                          </div>
                          <div className="text-xs text-gray-400">
                            {source.deviceId === deviceId
                              ? "This device"
                              : source.deviceId}
                            {source._local ? " · pending sync" : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-gray-300">
                          {source.path || source.uri || "—"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-col gap-1">
                            <StatusBadge status={source.status} />
                            {badge}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-gray-300">
                          <div className="text-xs text-gray-400">
                            Files: {metadata.fileCount ?? "—"}
                          </div>
                          <div className="text-xs text-gray-400">
                            Depth: {metadata.maxDepth ?? "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-gray-300">
                          {formatTimestamp(source.updatedAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

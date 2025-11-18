"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  useBlobsMeta,
  useDeviceBlobsByDevice,
  useFolderSources,
} from "@deeprecall/data/hooks";
import { resolveDefaultFolderSource } from "@deeprecall/data/hooks/useFolderSources";
import { folderSourcesRemote } from "@deeprecall/data/repos";
import { getDeviceId, getDeviceName } from "@deeprecall/data/utils/deviceId";
import type {
  FolderSourceStatus,
  FolderSourceType,
  FolderSource,
  FolderSourceRegistration,
} from "@deeprecall/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Star, Trash2, AlertTriangle } from "lucide-react";

const STATUS_OPTIONS: FolderSourceStatus[] = [
  "idle",
  "scanning",
  "syncing",
  "degraded",
  "error",
  "disabled",
];

const TYPE_OPTIONS: FolderSourceType[] = ["local", "cloud", "remote-cache"];

const STATUS_BADGE_STYLES: Record<FolderSourceStatus, string> = {
  idle: "bg-emerald-400/10 text-emerald-200 border border-emerald-400/40",
  scanning: "bg-sky-400/10 text-sky-200 border border-sky-400/40",
  syncing: "bg-indigo-400/10 text-indigo-200 border border-indigo-400/40",
  degraded: "bg-amber-400/10 text-amber-200 border border-amber-400/40",
  error: "bg-rose-400/10 text-rose-200 border border-rose-400/40",
  disabled: "bg-slate-600/20 text-slate-200 border border-slate-500/40",
};

type FormState = {
  displayName: string;
  path: string;
  uri: string;
  type: FolderSourceType;
  isDefault: boolean;
  priority: number;
  status: FolderSourceStatus;
};

const EMPTY_FORM: FormState = {
  displayName: "",
  path: "",
  uri: "",
  type: "local",
  isDefault: false,
  priority: 50,
  status: "idle",
};

function formatTimestamp(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch (_error) {
    return value;
  }
}

export default function SourcesHubPage() {
  const queryClient = useQueryClient();
  const [currentDeviceId] = useState(() => getDeviceId());
  const [currentDeviceName] = useState(() => getDeviceName());
  const [formState, setFormState] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    data: mergedSources = [],
    isLoading: mergedLoading,
    error: mergedError,
  } = useFolderSources();

  const remoteQuery = useQuery({
    queryKey: ["folderSources", "remote", "list"],
    queryFn: () => folderSourcesRemote.listRemoteFolderSources(),
  });

  const { data: blobsMeta = [] } = useBlobsMeta();
  const { data: deviceBlobs = [] } = useDeviceBlobsByDevice(currentDeviceId);

  const defaultSource = useMemo(() => {
    return resolveDefaultFolderSource(mergedSources, currentDeviceId, {
      allowCrossDeviceFallback: true,
    });
  }, [mergedSources, currentDeviceId]);

  const localHashes = useMemo(() => {
    return new Set(deviceBlobs.map((entry) => entry.sha256));
  }, [deviceBlobs]);

  const remoteOnlyCount = useMemo(() => {
    if (blobsMeta.length === 0) return 0;
    return blobsMeta.filter((blob) => !localHashes.has(blob.sha256)).length;
  }, [blobsMeta, localHashes]);

  const coveragePercent = useMemo(() => {
    if (blobsMeta.length === 0) return 0;
    const localCount = blobsMeta.length - remoteOnlyCount;
    return Math.round((localCount / blobsMeta.length) * 100);
  }, [blobsMeta.length, remoteOnlyCount]);

  const registerMutation = useMutation({
    mutationFn: (
      payload: FolderSourceRegistration & {
        deviceId: string;
        status?: FolderSourceStatus;
      }
    ) => folderSourcesRemote.registerRemoteFolderSource(payload),
    onSuccess: async () => {
      setFormState(EMPTY_FORM);
      setFormError(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["folderSources", "remote", "list"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["folderSources", "merged"],
        }),
      ]);
      remoteQuery.refetch();
    },
    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (sourceId: string) =>
      folderSourcesRemote.deleteRemoteFolderSource(sourceId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["folderSources", "remote", "list"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["folderSources", "merged"],
        }),
      ]);
      remoteQuery.refetch();
    },
  });

  const markDefaultMutation = useMutation({
    mutationFn: (source: FolderSource) =>
      folderSourcesRemote.updateRemoteFolderSource(source.id, {
        displayName: source.displayName,
        priority: source.priority,
        status: source.status,
        isDefault: true,
        path: source.path,
        pathHash: source.pathHash,
        uri: source.uri,
        metadata: source.metadata,
        lastScanStartedAt: source.lastScanStartedAt ?? undefined,
        lastScanCompletedAt: source.lastScanCompletedAt ?? undefined,
        lastError: source.lastError ?? undefined,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["folderSources", "remote", "list"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["folderSources", "merged"],
        }),
      ]);
      remoteQuery.refetch();
    },
  });

  const localSources = mergedSources.filter(
    (source) => source.deviceId === currentDeviceId
  );
  const crossDeviceSources = mergedSources.filter(
    (source) => source.deviceId !== currentDeviceId
  );

  const remoteSources = remoteQuery.data ?? [];

  const handleFormChange = (
    field: keyof FormState,
    value: string | boolean | number
  ) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRegister = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.displayName.trim()) {
      setFormError("Display name is required");
      return;
    }

    if (formState.type === "local" && !formState.path.trim()) {
      setFormError("Local sources require a path");
      return;
    }

    if (formState.type !== "local" && !formState.uri.trim()) {
      setFormError("Cloud sources require a URI");
      return;
    }

    registerMutation.mutate({
      deviceId: currentDeviceId,
      displayName: formState.displayName.trim(),
      path: formState.path.trim() || undefined,
      uri: formState.uri.trim() || undefined,
      type: formState.type,
      priority: formState.priority,
      isDefault: formState.isDefault,
      status: formState.status,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-10">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Ingestion · Sources
          </p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-white">
                Folder Sources Hub
              </h1>
              <p className="text-sm text-slate-400">
                Track every device source, confirm coverage, and keep remote
                catalog entries in sync.
              </p>
            </div>
            {mergedError ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/60 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">
                <AlertTriangle className="h-4 w-4" />
                {String(mergedError)}
              </div>
            ) : null}
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/20">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Default Source
            </p>
            <p className="mt-3 text-2xl font-semibold text-white">
              {defaultSource ? defaultSource.displayName : "Not configured"}
            </p>
            <p className="text-sm text-slate-400">
              Device ·{" "}
              {defaultSource ? defaultSource.deviceId : currentDeviceName}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/20">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Local Sources
            </p>
            <p className="mt-3 text-2xl font-semibold text-white">
              {localSources.length}
            </p>
            <p className="text-sm text-slate-400">
              {mergedSources.length} total across devices
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/20">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Remote Catalog
            </p>
            <p className="mt-3 text-2xl font-semibold text-white">
              {remoteSources.length}
            </p>
            <p className="text-sm text-slate-400">Managed via /api/sources</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/20">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Local Coverage
            </p>
            <p className="mt-3 text-2xl font-semibold text-white">
              {coveragePercent}%
            </p>
            <p className="text-sm text-slate-400">
              {remoteOnlyCount} blobs remote-only
            </p>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">
                Synced Sources (Dexie/Electric)
              </h2>
              <p className="text-sm text-slate-400">
                Real-time view of merged records, including optimistic local
                entries.
              </p>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50">
            <table className="min-w-full divide-y divide-white/5 text-sm">
              <thead className="bg-white/5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Device</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-transparent">
                {mergedLoading ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-slate-400"
                      colSpan={6}
                    >
                      Loading sources…
                    </td>
                  </tr>
                ) : mergedSources.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-slate-400"
                      colSpan={6}
                    >
                      No folder sources registered yet.
                    </td>
                  </tr>
                ) : (
                  mergedSources.map((source) => (
                    <tr
                      key={source.id}
                      className={
                        source.isDefault ? "bg-emerald-500/5" : undefined
                      }
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white flex items-center gap-2">
                          {source.isDefault ? (
                            <span className="text-emerald-300">
                              <Star className="h-3 w-3" />
                            </span>
                          ) : null}
                          {source.displayName}
                        </div>
                        <div className="text-xs text-slate-400">
                          priority {source.priority}
                          {source._local ? " · pending sync" : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {source.deviceId}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-300">
                        {source.type.replace("-", " ")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_STYLES[source.status]}`}
                        >
                          {source.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {source.path || source.uri || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {formatTimestamp(source.updatedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {crossDeviceSources.length > 0 ? (
            <p className="text-xs text-slate-500">
              Includes {crossDeviceSources.length} source(s) from other devices
              for context.
            </p>
          ) : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  Server Catalog (/api/sources)
                </h2>
                <p className="text-sm text-slate-400">
                  Ground truth table powering desktop and mobile scanners.
                </p>
              </div>
              <div className="flex-1" />
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1.5 text-sm text-white transition hover:border-white/40"
                onClick={() => remoteQuery.refetch()}
                disabled={remoteQuery.isFetching}
              >
                <RefreshCw
                  className={`h-4 w-4 ${remoteQuery.isFetching ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
            {remoteQuery.error ? (
              <p className="text-sm text-rose-300">
                {(remoteQuery.error as Error).message}
              </p>
            ) : null}
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="min-w-full divide-y divide-white/10 text-sm">
                <thead className="bg-white/5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Device</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-slate-950/40">
                  {remoteSources.length === 0 ? (
                    <tr>
                      <td
                        className="px-4 py-6 text-center text-slate-400"
                        colSpan={4}
                      >
                        No sources registered in Postgres yet.
                      </td>
                    </tr>
                  ) : (
                    remoteSources.map((source) => (
                      <tr key={source.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">
                            {source.displayName}
                          </div>
                          <div className="text-xs text-slate-400">
                            {source.path || source.uri || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {source.deviceId}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_STYLES[source.status]}`}
                          >
                            {source.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                markDefaultMutation.mutate(
                                  source as FolderSource
                                )
                              }
                              className="rounded-full border border-white/20 px-3 py-1 text-xs text-white hover:border-white/40"
                            >
                              Set default
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteMutation.mutate(source.id)}
                              className="rounded-full border border-rose-500/30 px-3 py-1 text-xs text-rose-200 hover:border-rose-400/60"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
            <h2 className="text-xl font-semibold text-white">
              Register New Source
            </h2>
            <p className="text-sm text-slate-400">
              Send a record straight to Postgres; desktop/mobile devices will
              pick it up instantly.
            </p>
            {formError ? (
              <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {formError}
              </div>
            ) : null}
            <form className="mt-5 space-y-4" onSubmit={handleRegister}>
              <div>
                <label className="text-xs uppercase text-slate-400">
                  Display Name
                </label>
                <input
                  type="text"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
                  value={formState.displayName}
                  onChange={(event) =>
                    handleFormChange("displayName", event.target.value)
                  }
                  placeholder="External SSD"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs uppercase text-slate-400">
                    Device Path
                  </label>
                  <input
                    type="text"
                    className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
                    value={formState.path}
                    onChange={(event) =>
                      handleFormChange("path", event.target.value)
                    }
                    placeholder="/Volumes/Notes"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-slate-400">
                    Remote URI
                  </label>
                  <input
                    type="text"
                    className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none"
                    value={formState.uri}
                    onChange={(event) =>
                      handleFormChange("uri", event.target.value)
                    }
                    placeholder="s3://bucket/path"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs uppercase text-slate-400">
                    Type
                  </label>
                  <select
                    className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                    value={formState.type}
                    onChange={(event) =>
                      handleFormChange("type", event.target.value)
                    }
                  >
                    {TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase text-slate-400">
                    Status
                  </label>
                  <select
                    className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                    value={formState.status}
                    onChange={(event) =>
                      handleFormChange("status", event.target.value)
                    }
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs uppercase text-slate-400">
                    Priority
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-white/40"
                    value={formState.priority}
                    onChange={(event) =>
                      handleFormChange("priority", Number(event.target.value))
                    }
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      className="rounded border-white/20 bg-slate-950 text-emerald-400 focus:ring-emerald-500"
                      checked={formState.isDefault}
                      onChange={(event) =>
                        handleFormChange("isDefault", event.target.checked)
                      }
                    />
                    Mark as default
                  </label>
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending
                  ? "Registering…"
                  : "Register source"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

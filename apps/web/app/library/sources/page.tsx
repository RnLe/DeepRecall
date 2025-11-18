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
  FolderSource,
  FolderSourceRegistration,
  FolderSourceStatus,
  FolderSourceType,
} from "@deeprecall/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Star, Trash2 } from "lucide-react";

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
  idle: "bg-emerald-50 text-emerald-700 border-emerald-200",
  scanning: "bg-blue-50 text-blue-700 border-blue-200",
  syncing: "bg-indigo-50 text-indigo-700 border-indigo-200",
  degraded: "bg-amber-50 text-amber-700 border-amber-200",
  error: "bg-rose-50 text-rose-700 border-rose-200",
  disabled: "bg-slate-100 text-slate-600 border-slate-200",
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

export default function FolderSourcesPage() {
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
  }, [blobsMeta, remoteOnlyCount]);

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

  const remoteSources = remoteQuery.data ?? [];

  return (
    <div className="space-y-10 p-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-500">
          Library · Sources
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">
          Folder Sources & Explorer Wiring
        </h1>
        <p className="text-base text-slate-600">
          Track every registered folder, confirm remote coverage, and register
          new sources without leaving the web client.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Default Source</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {defaultSource ? defaultSource.displayName : "Not configured"}
          </p>
          <p className="text-sm text-slate-500">
            Device: {defaultSource ? defaultSource.deviceId : currentDeviceName}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Registered (local)</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {localSources.length}
          </p>
          <p className="text-sm text-slate-500">
            {mergedSources.length} total across devices
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Remote Catalog</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {remoteSources.length}
          </p>
          <p className="text-sm text-slate-500">via /api/sources</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Local Coverage</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {coveragePercent}%
          </p>
          <p className="text-sm text-slate-500">
            {remoteOnlyCount} blobs remote-only
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Synced Sources (Electric/Dexie)
            </h2>
            <p className="text-sm text-slate-500">
              Real-time view from merged repo; includes optimistic local writes.
            </p>
          </div>
          {mergedError ? (
            <p className="text-sm text-rose-600">{String(mergedError)}</p>
          ) : null}
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {mergedLoading ? (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-slate-500"
                    colSpan={6}
                  >
                    Loading sources…
                  </td>
                </tr>
              ) : mergedSources.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-slate-500"
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
                      source.isDefault ? "bg-emerald-50/40" : undefined
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {source.displayName}
                      </div>
                      <div className="text-xs text-slate-500">
                        priority {source.priority}
                        {source._local ? " · pending sync" : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {source.deviceId}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">
                      {source.type.replace("-", " ")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_STYLES[source.status]}`}
                      >
                        {source.isDefault ? (
                          <Star className="mr-1 h-3 w-3 fill-current" />
                        ) : null}
                        {source.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {source.path || source.uri || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
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

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Server Catalog (/api/sources)
            </h2>
            <p className="text-sm text-slate-500">
              Direct view of the backend table used by Desktop/Mobile scanners.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            onClick={() => remoteQuery.refetch()}
            disabled={remoteQuery.isFetching}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
        {remoteQuery.error ? (
          <p className="text-sm text-rose-600">
            Failed to load sources: {String(remoteQuery.error)}
          </p>
        ) : null}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Scan</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {remoteQuery.isLoading ? (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-slate-500"
                    colSpan={5}
                  >
                    Loading remote sources…
                  </td>
                </tr>
              ) : remoteSources.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-slate-500"
                    colSpan={5}
                  >
                    No sources returned from the API yet.
                  </td>
                </tr>
              ) : (
                remoteSources.map((source) => {
                  const isDeleting =
                    deleteMutation.isPending &&
                    deleteMutation.variables === source.id;
                  const isDefaulting =
                    markDefaultMutation.isPending &&
                    markDefaultMutation.variables?.id === source.id;
                  return (
                    <tr key={source.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {source.displayName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {source.path || source.uri || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {source.deviceId}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_STYLES[source.status]}`}
                        >
                          {source.isDefault ? (
                            <Star className="mr-1 h-3 w-3 fill-current" />
                          ) : null}
                          {source.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatTimestamp(source.lastScanCompletedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                            disabled={source.isDefault || isDefaulting}
                            onClick={() => markDefaultMutation.mutate(source)}
                          >
                            <Star className="h-3 w-3" /> Default
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-700 shadow-sm hover:bg-rose-50 disabled:opacity-50"
                            onClick={() => deleteMutation.mutate(source.id)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">
          Register New Source
        </h2>
        <p className="text-sm text-slate-500">
          Writes directly to `/api/sources`; the merged hook updates as soon as
          the write lands.
        </p>
        <form
          onSubmit={handleRegister}
          className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2"
        >
          <label className="space-y-1 text-sm font-medium text-slate-700">
            Display Name
            <input
              type="text"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
              value={formState.displayName}
              onChange={(event) =>
                handleFormChange("displayName", event.target.value)
              }
              placeholder="Research Archive"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            Source Type
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
              value={formState.type}
              onChange={(event) =>
                handleFormChange("type", event.target.value as FolderSourceType)
              }
            >
              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            Local Path
            <input
              type="text"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
              value={formState.path}
              onChange={(event) => handleFormChange("path", event.target.value)}
              placeholder="/Users/me/Documents/DeepRecall"
              disabled={formState.type !== "local"}
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            Cloud URI
            <input
              type="text"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
              value={formState.uri}
              onChange={(event) => handleFormChange("uri", event.target.value)}
              placeholder="s3://bucket/prefix or https://drive.google.com/..."
              disabled={formState.type === "local"}
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            Priority ({formState.priority})
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              className="mt-2 w-full"
              value={formState.priority}
              onChange={(event) =>
                handleFormChange("priority", Number(event.target.value))
              }
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            Initial Status
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
              value={formState.status}
              onChange={(event) =>
                handleFormChange(
                  "status",
                  event.target.value as FolderSourceStatus
                )
              }
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={formState.isDefault}
              onChange={(event) =>
                handleFormChange("isDefault", event.target.checked)
              }
            />
            Set as default for this device
          </label>

          <div className="flex flex-col justify-end gap-2">
            {formError ? (
              <p className="text-sm text-rose-600">{formError}</p>
            ) : null}
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? "Registering…" : "Register Source"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

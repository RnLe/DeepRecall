export { default } from "../../sources/page";
/*
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
*/

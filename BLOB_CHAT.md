Me:
For my DeepRecall project I need to rethink how I save and manage date (my blobs). The files of this project all outline how the current framework looks like. But this is insufficient. I start with a general description of how the state of the project is right now. Then I'll explain why I see that this is troublesome and how I want this to work. Let's then brainstorm about how we could achieve this, maybe even gaining some simplicity. Right now, all my complex (relationship) data lives in postgres, except for raw files. Annotations, works / literature, activities, boards, strokes, etc. All this data is very lightweight and can live in postgres. The optimistic update framework writes into local dexie first, and then syncs back with electric, though I can simply deactivate the electric initialization when I'm in guest mode. And this is also the tricky part. Guests are allowed to use everything, but don't sync to postgres. For this, I need the user to sign in so that I can give the rows an owner_id. The user can sign in via next auth, or OAuth, Google or GitHub. This works well. The postgres database already has owner_ids in almost every table. But there's a problem with blobs. Right now, each file lives in the local CAS. The app detects files and wraps them in very lightweight CAS blobs. There are then wrapped for postgres so that my backend has an entity it can work with; link these blobs to literature, annotations, etc. Right now, I have three types of these: Device blob, to track which blob is on which device. A metadata blob to track some metadata, like filetype, page count (if any), resolution, etc. And an Asset, which is a wrapped blob which is linkeable. But I just realize that all these three types are basically the same, and that I can merge these! This would simplify things. But now there's a delicate issue. Local blobs are detected by the system and are not linkeable. This is intended as these blobs might be different on each platform. postgres only trades with the "shells" of these files; the metadata which tracks on which device this blob is from, what the path is, etc. But this postgres data of course has an owner_id. The local blobs don't. But if a guest is logged in, the user shall be able to work normally, even without sync. But this is not possible if the postgres blobs don't have an owner_id and can't be created. The idea is that a guest can work locally and independently of postgres. When signing in (and when a sync would happen), the local dexie data is synced to postgres. But here, a handshake needs to happen; or at least some protocol. Because only when signing in, the owner_id is known. This would mean the user locally works "normally" with a fake owner_id; and when he signs in, the real owner_id is inserted to all data and ONLY THEN, the data is synced. Does this sound right? Any thoughts about this? So basically, I want to do this: 1) Merge Assets, Device Blobs and Blobs Metadata. 2) As a guest, deactivate sync and work with a temporary owner_id. 3) When signing in, scan for changes that want to sync, fetch the owner_id and replace all temporary owner_ids with the real one. I need a framework to handle confilcts as well, but I will add this later. This would be too big right now. Lets brainstorm about this!

Dev:

Short version: your direction is solid, but swap the “fake owner_id then rewrite” idea for “owner-less local writes and server-assigned owner on flush,” and don’t physically merge Asset / BlobMeta / DeviceBlob. Merge them **logically** (a unified view/type in the bridge layer), keep them **separate** in Postgres. That preserves dedup, many-to-many links, device presence, and keeps the guest→account upgrade clean. The rest lines up with what you’ve already built.

Here’s a crisp plan.

# 0) Keep the two-layer shape exactly as-is

- **Layer 1 (CAS = bytes on device):** platform adapters only; no auth, no owner.
- **Layer 2 (Electric = tiny metadata):** `blobs_meta`, `device_blobs`, `assets`, `works`, etc. All RLS-guarded with `owner_id`. This is the “directory” of the bytes.

This split is the backbone of your current system (fast local UX + tiny cross-device sync). Don’t collapse it.

# 1) Don’t physically merge Asset / BlobMeta / DeviceBlob

They look similar from the UI’s vantage point, but they have **different lifecycles and cardinalities**:

- **BlobMeta (1 row per SHA-256):** global facts about the content (size, mime, filename).
- **DeviceBlob (N rows per SHA-256):** presence on each device (device_id, path/health/present).
- **Asset (N rows per SHA-256):** _semantic_ references into the library (work linkage, role, permissions), many assets may point to the same blob.

If you collapse these, you lose:

- **Deduplication** (one blob, many assets),
- **Per-device presence** (one blob, many devices),
- and you complicate conflict handling (link changes vs. file presence vs. metadata).
  Your own docs already standardize this separation and rely on it for device badges, admin panels, and future P2P/cloud sync. Keep it. Build a **unified “handle” in code**, not in SQL.

If you want a single thing to pass around, define a bridge-layer type and resolvers:

```ts
// packages/data/src/types/unified.ts
export interface BlobHandle {
  sha256: string;
  meta?: { filename?: string; mime?: string; size?: number };
  devices: Array<{
    deviceId: string;
    present: boolean;
    path?: string;
    health?: string;
  }>;
  assets: Array<{ id: string; workId?: string; role?: string }>;
  availableLocally: boolean;
}

// Query function (bridge layer): Electric first, CAS for availability.
export async function getBlobHandle(
  sha256: string,
  cas: BlobCAS
): Promise<BlobHandle> {
  // 1) read blobs_meta + device_blobs + assets via Electric hooks/repos
  // 2) check cas.has(sha256)
  // 3) return merged BlobHandle
}
```

You already use this “bridge merges Electric + CAS” pattern (`useBlobResolution`, unified lists, badges). Extend it rather than changing the DB.

# 2) Guest mode: skip the “temporary owner_id”. Use owner-less local writes.

Your auth/RLS guide already solves this neatly:

- **Guest:** write to `*_local` in Dexie; **do not enqueue** to server. Electric can be off. Database name is `deeprecall_guest_<deviceId>` so nothing leaks.
- **On sign-in:** switch Dexie to `deeprecall_<userId>_<deviceId>`, **replay/flush** the guest `_local` writes through the normal batch endpoint. The server sets `SET LOCAL app.user_id=$userId`; Postgres fills `owner_id` by default (or you set it server-side), and RLS ensures isolation. No “fake owner” rewrite pass needed.

This avoids:

- massive `UPDATE ... SET owner_id = real` cascades,
- Electric shape mismatches (it filters by true `owner_id`),
- and weird corner cases if the user cancels mid-upgrade.

You already have the building blocks: conditional enqueue (guests don’t enqueue), DB naming/switch, and `upgradeGuestToUser()` to migrate/flush. Lean on those.

Minimal mechanics:

- **While guest:**
  - Writes: Dexie `*_local` only; write buffer **skipped**.
  - Blobs: store in CAS; **no** `blobs_meta/device_blobs` rows yet.
  - UI: show a small “Local only” banner.

- **Sign-in event:**
  1. Get `userId` from session; init device UUID (persistent).
  2. Run `upgradeGuestToUser()` which:
     - builds batch ops from guest `_local`,
     - sends to `/api/writes/batch` **with session** (server sets `app.user_id`),
     - for each local CAS blob, call the **existing** coordination step (create `blobs_meta` iff missing; insert/update `device_blobs` for this `device_id`).

  3. Electric streams back the rows; SyncManager writes the synced tables; guest DB is cleared.

- **After sign-in:** normal optimistic writes resume (local→buffer→batch→Postgres→Electric→Dexie). Keep “one writer” discipline to Dexie synced tables (SyncManager).

# 3) Device IDs & blob coordination (keep as you’ve done)

- Always use **real persistent device UUIDs** (never “server/web/mobile”). Presence and badges depend on it, and it makes the guest→user upgrade deterministic when coordinating local blobs. Your Phase-3 notes already hardened this across platforms.

# 4) What to actually change in your codebase

Minimal, targeted adjustments—no schema upheaval:

1. **Formalize the “Unified Blob Handle”** (bridge layer) used by UI lists, dialogs, and readers—so the UI stops thinking in three tables. You’re mostly there (`useUnifiedBlobList`, `useBlobResolution`); finish the sweep.

2. **Drop the idea of temporary owner IDs in Dexie.**
   - Keep `owner_id` **out of client data**; treat Dexie as owner-less cache.
   - On server, **ignore** any incoming `owner_id`; rely on `SET LOCAL app.user_id` and defaults/RLS. You already set this up in batch writes.

3. **Ensure all guest writes skip the write buffer.**
   This is already implemented across repos (conditional enqueue). Keep it consistent for any new entities.

4. **Keep the three blob tables; add a SQL view only if you want admin/ops convenience.**
   A read-only view like `v_blob_inventory` that left-joins `blobs_meta` with `device_blobs` (aggregated) is fine for dashboards. Don’t make the app depend on it; keep app logic in the bridge layer.

# 5) Conflict strategy (later, but the hook points are ready)

Your sync guide already enforces “one writer to Dexie synced tables.” When you add conflict detection, run it **before** writing Electric→Dexie in the SyncManager, use LWW for scalar fields, union/append for sets (strokes, tags), and create conflict copies when needed. The hook scaffolding is in your plan.

# 6) Sanity checks / pitfalls to avoid

- **Do not** attempt an owner_id rewrite sweep post-login; it’s brittle and unnecessary under RLS. Let the server assign ownership at insert-time.
- **Do not** push CAS bytes or paths into Electric; keep it metadata-only. CAS remains a dumb byte store; Electric is the directory.
- **Do not** attribute devices as “server”. Always thread the real `device_id` through web uploads and backfill (“Sync to Electric”). You already fixed this.
- **Shapes must filter by owner** (belt-and-suspenders), because Electric reads from a logical replication slot. You already do this.

---

### Verdict on your 1–3:

1. **Merge the three blob _types_ at the API level, not the DB.** Keep three tables; expose one `BlobHandle` in code. ✔️

2. **Guest mode with temporary owner_id:** replace with owner-less local writes, conditional buffer enqueue, and DB naming (`guest_<device>`). ✔️

3. **On sign-in:** run the existing **guest→user upgrade**: switch DB name, coordinate local blobs, flush `_local` to server where `owner_id` is assigned automatically, then clear guest DB. ✔️

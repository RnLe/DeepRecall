# Quick Start: Blob Unification

> **Immediate next steps to fix blob storage inconsistencies**

## 🎯 The Core Problem

**Current State**:

- Web: Stores `{hash}.pdf`, relies on Electric ✅
- Desktop: Stores `{hash}.pdf`, only local SQLite ❌
- Mobile: Stores `{hash}` (no ext), only local JSON ❌

**Issue**: Desktop and Mobile don't write to Electric `blobs_meta`, breaking cross-device sync.

## 🔧 Fix #1: MIME Detection (2 hours)

**Why**: Need to handle files without extensions (Mobile) and validate uploads.

**Create**: `packages/core/src/utils/mime.ts`

```typescript
// Magic byte detection
export function detectMimeFromBuffer(buffer: ArrayBuffer): string {
  // PDF: 0x25 0x50 0x44 0x46 (%PDF)
  // PNG: 0x89 0x50 0x4E 0x47
  // JPEG: 0xFF 0xD8 0xFF
  // ...
}

// Extension fallback
export function detectMimeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
}

// Validation
export const SUPPORTED_TYPES = {
  documents: ["application/pdf"],
  images: ["image/png", "image/jpeg", "image/webp"],
  text: ["text/plain", "text/markdown"],
};

export function isSupportedMimeType(mime: string): boolean {
  return Object.values(SUPPORTED_TYPES).flat().includes(mime);
}
```

**Export**: Add to `packages/core/src/utils/index.ts`

---

## 🔧 Fix #2: Desktop Electric Integration (1 hour)

**Problem**: Tauri stores blobs locally but doesn't tell Electric.

**Location**: `apps/desktop/src-tauri/src/commands/blobs.rs::store_blob`

**Add after line 106** (after `insert_path()`):

```rust
// NEW: Coordinate with Electric
let device_id = get_device_id()?;
let metadata = serde_json::json!({
    "sha256": hash,
    "size": data.len(),
    "mime": mime,
    "filename": filename,
    "createdAt": chrono::Utc::now().to_rfc3339(),
});

// Call write buffer endpoint
reqwest::Client::new()
    .post("http://localhost:3000/api/writes/blobs")
    .json(&metadata)
    .send()
    .await
    .map_err(|e| format!("Electric coordination failed: {}", e))?;
```

**Also add**: Device ID persistence (store in Tauri app data dir)

---

## 🔧 Fix #3: Mobile Electric Integration (1 hour)

**Problem**: Capacitor stores blobs locally but doesn't tell Electric.

**Location**: `apps/mobile/src/blob-storage/capacitor.ts::put`

**Add after line 230** (after `this.saveCatalog()`):

```typescript
// NEW: Coordinate with Electric
import { createBlobMetaLocal } from "@deeprecall/data/repos/blobs-meta.writes";

await createBlobMetaLocal({
  sha256,
  size: source.size,
  mime,
  filename,
  createdAt: new Date().toISOString(),
});

// Also mark present on this device
import { markBlobPresentLocal } from "@deeprecall/data/repos/device-blobs.writes";
await markBlobPresentLocal(sha256);
```

**Import**: Add `@deeprecall/data` to mobile's `package.json` dependencies.

---

## 🔧 Fix #4: Unified Blob Resolution Hook (2 hours)

**Why**: Components should query Electric metadata first, not local CAS.

**Create**: `packages/data/src/hooks/useBlobResolution.ts`

```typescript
import { useBlobMeta } from "./useBlobsMeta";
import type { BlobCAS } from "@deeprecall/blob-storage";

/**
 * Resolve blob for frontend display
 * Combines Electric metadata + CAS availability
 */
export function useBlobResolution(sha256: string, cas: BlobCAS) {
  const { data: meta } = useBlobMeta(sha256);

  return useQuery({
    queryKey: ["blob", "resolution", sha256],
    queryFn: async () => {
      if (!meta) return null;

      const availableLocally = await cas.has(sha256);
      const url = availableLocally ? cas.getUrl(sha256) : null;

      return {
        sha256,
        filename: meta.filename,
        mime: meta.mime,
        size: meta.size,
        availableLocally,
        url,
      };
    },
    enabled: !!meta,
  });
}
```

**Export**: Add to `packages/data/src/hooks/index.ts`

**Use in**: Library WorkCard, Reader PDF loader, Admin panel

---

## 🔧 Fix #5: Blob Status Indicator (1 hour)

**Why**: Show users which files are local vs. cloud.

**Create**: `packages/ui/src/library/BlobStatusBadge.tsx`

```typescript
import type { BlobCAS } from "@deeprecall/blob-storage";
import { useDeviceBlobs } from "@deeprecall/data";
import { Badge } from "../components/ui/badge";

interface Props {
  sha256: string;
  cas: BlobCAS;
}

export function BlobStatusBadge({ sha256, cas }: Props) {
  const { data: devices = [] } = useDeviceBlobs(sha256);
  const [isLocal, setIsLocal] = useState(false);

  useEffect(() => {
    cas.has(sha256).then(setIsLocal);
  }, [sha256, cas]);

  const deviceCount = devices.filter(d => d.present).length;

  return (
    <Badge variant={isLocal ? "default" : "outline"}>
      {isLocal ? "📱 Local" : "☁️ Remote"} • {deviceCount} device{deviceCount !== 1 ? 's' : ''}
    </Badge>
  );
}
```

**Add to**: WorkCard component, Admin blob list

---

## ✅ Validation Checklist

After implementing fixes:

- [ ] Upload PDF on Desktop → appears in Web admin panel
- [ ] Upload image on Mobile → appears in Desktop library
- [ ] Admin panel shows device count per blob
- [ ] WorkCard shows "Local" badge for available files
- [ ] Extension-less files (Mobile) resolve correct MIME type
- [ ] Electric `blobs_meta` table populated from all 3 platforms

---

## 🚀 Deploy Order

1. **Deploy Fix #1** (MIME utils) → merge to main, no runtime changes
2. **Deploy Fix #4** (resolution hook) → merge to main, backward compatible
3. **Deploy Fix #2 + #3** together → Desktop + Mobile Electric coordination
4. **Deploy Fix #5** (status badge) → UI polish

---

## 📊 Success Metrics

**Before**: Only Web uploads sync across devices (67% coverage)
**After**: All 3 platforms sync blobs via Electric (100% coverage)

**User Impact**:

- Upload on Desktop → instantly appears in Mobile library
- Download on Mobile → desktop shows "Available on 2 devices"
- Robust cross-platform file management

---

_Start with Fix #1 (MIME detection) — it's self-contained and unblocks the rest._

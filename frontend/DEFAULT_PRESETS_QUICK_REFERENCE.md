# Default Presets - Quick Reference

## What Changed

5 default presets are now available from the start:

- **Paper** (Research papers)
- **Textbook** (Educational books)
- **Thesis** (PhD/Master's theses)
- **Script** (Lecture materials)
- **Slides** (Presentations)

## User Guide

### Access Preset Manager

1. Navigate to Library page
2. Access via menu or direct link to `/library` (preset manager tab)

### Initialize/Reset Defaults

1. Open Preset Manager
2. Click "Initialize Defaults" button (shows count if some are missing)
3. Confirm the action
4. All 5 default presets will be available

### Customize a Default Preset

1. Find the preset in "Default Presets" section (blue "Default" badge)
2. Click "Duplicate to Customize"
3. Edit your copy freely (original remains protected)

### Default Presets Features

- ✅ Auto-initialized on first app startup
- ✅ Cannot be edited or deleted (protected)
- ✅ Can be duplicated for customization
- ✅ Can be reset to original at any time
- ✅ Named consistently for easy identification

## Developer Guide

### Hooks

```typescript
// Get all presets (system + user)
const presets = usePresets();

// Get work presets grouped by type
const { system, user } = useWorkPresets();

// Check missing defaults
const missing = useMissingDefaultPresets();
// Returns: string[] (e.g., ["Script", "Slides"])

// Reset defaults
const resetDefaults = useResetDefaultPresets();
resetDefaults.mutate(); // Reset all
resetDefaults.mutate(["Paper"]); // Reset specific

// Initialize presets (happens automatically on startup)
const initPresets = useInitializePresets();
initPresets.mutate();
```

### Repository Functions

```typescript
import {
  initializePresets,
  resetSystemPresets,
  resetDefaultPresetsByName,
  getMissingDefaultPresets,
} from "@/src/repo/presets.init";

// Initialize (idempotent)
await initializePresets();

// Reset all system presets
await resetSystemPresets();

// Reset specific by name
const result = await resetDefaultPresetsByName(["Paper", "Textbook"]);
// result = { reset: 2, skipped: 0 }

// Check what's missing
const missing = await getMissingDefaultPresets();
// missing = ["Script", "Slides"]
```

### Default Preset Names

```typescript
import { DEFAULT_PRESET_NAMES } from "@/src/repo/presets.default";
// ["Paper", "Textbook", "Thesis", "Script", "Slides"]
```

## Architecture

### Data Flow

```
App Startup
  ├─> providers.tsx (PresetInitializer)
  ├─> useInitializePresets()
  ├─> initializePresets()
  ├─> Check existing by name
  └─> Add missing presets to Dexie

User Clicks "Reset Defaults"
  ├─> PresetManager.tsx
  ├─> useResetDefaultPresets()
  ├─> resetDefaultPresetsByName()
  ├─> Delete matching names (isSystem=true)
  ├─> Re-add from DEFAULT_PRESETS
  └─> React Query invalidates cache
       └─> useLiveQuery auto-updates UI
```

### Storage Layer

- **Source of Truth**: `presets.default.ts` (5 default preset definitions)
- **Runtime State**: Dexie/IndexedDB (`db.presets` table)
- **Cache Layer**: React Query + useLiveQuery (live updates)
- **UI State**: None (read-only from Dexie)

### Protection Mechanism

```typescript
// In presets.ts repo
export async function updatePreset(id: string, updates: Partial<Preset>) {
  const existing = await db.presets.get(id);
  if (existing.isSystem) {
    throw new Error("Cannot update system preset");
  }
  // ... update
}

export async function deletePreset(id: string) {
  const existing = await db.presets.get(id);
  if (existing.isSystem) {
    throw new Error("Cannot delete system preset");
  }
  // ... delete
}
```

## UI Locations

### Where Presets Appear

1. **PresetManager** (`/library` - preset tab)
   - View all presets (system + user)
   - Reset defaults button
   - Duplicate system presets
   - Edit/delete user presets

2. **LibraryLeftSidebar** (Library page)
   - Quick preset buttons
   - Shows work count per preset
   - One-click create with preset

3. **CreateWorkDialog** (Library page)
   - Preset selector step
   - Full form with preset fields
   - Create new preset option

4. **LinkBlobDialog** (When linking orphaned files)
   - Preset selector for new work
   - Quick work creation

## Common Patterns

### Check If Preset Is System

```typescript
const preset = usePreset(presetId);
const isSystem = preset?.isSystem ?? false;

// In UI
{isSystem && (
  <span className="badge">Default</span>
)}
```

### Filter Only User Presets

```typescript
const presets = usePresets();
const userPresets = presets?.filter((p) => !p.isSystem) || [];
```

### Create Work From Default Preset

```typescript
// User selects "Paper" preset in sidebar
onCreateWorkWithPreset(paperPreset.id);
// Opens CreateWorkDialog with preset pre-selected
// Form shows Paper-specific fields
```

## Testing

### Manual Testing Checklist

- [ ] Fresh DB: Presets auto-initialize on startup
- [ ] Reset: "Reset Defaults" recreates all 5
- [ ] Protection: Cannot edit/delete system presets
- [ ] Duplicate: Can duplicate and edit copy
- [ ] Count: Missing preset count updates correctly
- [ ] Create: Can create work from default preset
- [ ] Persist: Presets survive browser refresh

### Reset Test Scenarios

```typescript
// Scenario 1: All defaults exist
await resetDefaultPresetsByName();
// Result: { reset: 5, skipped: 0 }

// Scenario 2: Some deleted
// User deletes their "Paper (Copy)" (OK)
// User tries to delete "Paper" system preset (blocked)
await resetDefaultPresetsByName(["Paper"]);
// Result: { reset: 1, skipped: 0 }

// Scenario 3: Fresh database
const missing = await getMissingDefaultPresets();
// missing = ["Paper", "Textbook", "Thesis", "Script", "Slides"]
```

## Troubleshooting

### Presets Not Appearing

```typescript
// Check if initialized
const presets = usePresets();
console.log("Preset count:", presets?.length);

// Manual init
const initPresets = useInitializePresets();
initPresets.mutate();
```

### Reset Not Working

```typescript
// Check for errors
resetDefaults.mutate(undefined, {
  onError: (error) => console.error("Reset failed:", error),
  onSuccess: (result) => console.log("Reset:", result),
});
```

### System Preset Accidentally Modified

- Not possible via UI (edit/delete disabled)
- If manually modified in DB: Run "Reset Defaults"
- This recreates all 5 from source definitions

## Best Practices

1. **Don't hardcode preset IDs** - They're UUIDs and change on reset
2. **Check by name** - Use `preset.name` for logic, not `preset.id`
3. **Duplicate for customization** - Never try to edit system presets
4. **Reset liberally** - It's a safe, idempotent operation
5. **Use hooks** - Don't call repo functions directly in components

## Future Enhancements

Potential improvements for later:

- **Preset versioning** - Track schema changes over time
- **Preset templates** - Community-shared preset library
- **Import/Export** - Share custom presets as JSON
- **Preset analytics** - Track usage patterns
- **Preset suggestions** - AI-recommended presets based on content

# Default Presets - Manual Initialization System

## Problem Fixed

Previously, default presets were auto-initialized on every app refresh, causing potential duplicates and unwanted behavior. This has been completely redesigned.

## New Approach

### No Auto-Initialization

- Default presets are **NOT** automatically created
- Users must manually initialize them via PresetManager
- This prevents duplicates and gives users full control

### Two-Button System

#### 1. "Initialize Missing" Button

- **When it appears**: Only when one or more default presets are missing
- **What it does**: Adds ONLY the missing default presets
- **Color**: Blue (prominent call-to-action)
- **Detection**: Checks by preset name, not ID
- **Example**: If you have "Paper" and "Textbook", button shows "Initialize Missing (3)" for Script, Slides, Thesis

#### 2. "Reset to Default" Button (per-preset)

- **Where it appears**: On each default preset card (Paper, Textbook, Thesis, Script, Slides)
- **What it does**: Resets THAT SPECIFIC preset to its original configuration
- **Color**: Amber (warning color)
- **Detection**: Only shows if preset name exactly matches a default name
- **Example**: If user renamed "Paper" to "Academic Paper", reset button disappears (it's now a custom preset)

## How It Works

### Preset Identity: Name-Based

```typescript
// Presets are identified by their NAME, not ID
DEFAULT_PRESET_NAMES = ["Paper", "Textbook", "Thesis", "Script", "Slides"];

// Detection logic:
const isDefaultPreset = DEFAULT_PRESET_NAMES.includes(preset.name);
const canBeReset = preset.isSystem && isDefaultPreset;
```

### Duplicate Prevention

```typescript
// Check existing presets by name
const existingNames = new Set(existingPresets.map((p) => p.name));

// Only add presets that don't exist
const presetsToAdd = DEFAULT_PRESETS.filter((p) => !existingNames.has(p.name));
```

### User Workflow

#### First Time User (Empty Database)

1. User opens PresetManager
2. Sees "Initialize Missing (5)" button
3. Clicks button → Confirm dialog
4. All 5 default presets are created
5. Button disappears (all defaults now exist)

#### User Wants to Reset "Paper" Preset

1. User finds "Paper" card in "Default Presets" section
2. Sees two buttons: "Duplicate to Customize" and "Reset to Default"
3. Clicks "Reset to Default" → Confirm dialog
4. Old "Paper" preset is deleted
5. Fresh "Paper" preset from defaults is added
6. All other presets remain unchanged

#### User Renames "Paper" to "Academic Paper"

1. User duplicates "Paper" preset
2. Renames copy to "Academic Paper"
3. Now has both "Paper" (with reset button) and "Academic Paper" (custom)
4. If user deletes original "Paper", it becomes "missing"
5. "Initialize Missing (1)" button appears to restore it

#### User Accidentally Breaks a Default

1. User's "Textbook" preset gets corrupted (rare edge case)
2. User clicks "Reset to Default" on "Textbook" card
3. Corrupted version is deleted
4. Fresh "Textbook" is recreated from source
5. Takes <1 second

## Implementation Details

### Key Functions

```typescript
// Initialize only missing presets (idempotent)
async function initializePresets(): Promise<void>;

// Reset a single preset by name
async function resetSinglePresetByName(name: string): Promise<boolean>;

// Get list of missing default preset names
async function getMissingDefaultPresets(): Promise<string[]>;

// Get status of all defaults
async function getDefaultPresetsStatus(): Promise<
  Array<{
    name: string;
    exists: boolean;
    isDefault: boolean;
  }>
>;
```

### React Hooks

```typescript
// Initialize missing defaults
const initPresets = useInitializePresets();
initPresets.mutate();

// Reset single preset
const resetSingle = useResetSinglePreset();
resetSingle.mutate("Paper");

// Check what's missing (live query)
const missing = useMissingDefaultPresets();
// missing = ["Script", "Slides", "Thesis"]
```

### UI States

#### PresetManager Header

```tsx
{
  missingDefaults && missingDefaults.length > 0 && (
    <button onClick={handleInitializeMissing}>
      Initialize Missing ({missingDefaults.length})
    </button>
  );
}
```

#### PresetCard Actions

```tsx
{isSystem ? (
  <>
    <button onClick={onDuplicate}>Duplicate to Customize</button>
    {onReset && (
      <button onClick={onReset}>Reset to Default</button>
    )}
  </>
) : (
  // User preset: Edit, Duplicate, Delete
)}
```

## Edge Cases Handled

### Case 1: User Deletes a Default Preset

- **Problem**: User somehow deletes "Paper" system preset
- **Solution**: "Initialize Missing (1)" button appears
- **Result**: User can restore it with one click

### Case 2: User Renames a Default Preset

- **Problem**: Preset still has `isSystem: true` but name is now "My Paper"
- **Solution**: Reset button disappears (name doesn't match)
- **Result**: It's now treated as a custom preset
- **Note**: Original "Paper" is now "missing" and can be re-initialized

### Case 3: Database Corruption

- **Problem**: Preset has invalid fields or broken structure
- **Solution**: Reset button still works (deletes + recreates)
- **Result**: Fresh preset from source code

### Case 4: Multiple Refreshes

- **Problem**: User refreshes page 10 times
- **Solution**: No presets are created (no auto-init)
- **Result**: Zero side effects

### Case 5: Preset Definition Changes (Code Update)

- **Problem**: Developer updates "Paper" preset fields in code
- **Solution**: User clicks "Reset to Default" on "Paper" card
- **Result**: Old version deleted, new version from code added

## Testing Scenarios

### Test 1: Fresh Database

```
1. Clear IndexedDB
2. Open PresetManager
3. Verify: "Initialize Missing (5)" button visible
4. Click button
5. Verify: All 5 presets created
6. Verify: Button disappears
```

### Test 2: Partial Initialization

```
1. Manually create "Paper" and "Textbook"
2. Open PresetManager
3. Verify: "Initialize Missing (3)" button visible
4. Click button
5. Verify: Only Script, Slides, Thesis are created
6. Verify: Paper and Textbook unchanged
```

### Test 3: Reset Single Preset

```
1. Have all 5 defaults initialized
2. Find "Thesis" card
3. Click "Reset to Default"
4. Confirm dialog
5. Verify: Thesis preset recreated
6. Verify: Other 4 presets unchanged
```

### Test 4: Rename Detection

```
1. Initialize "Paper" preset
2. Duplicate it to create "Paper (Copy)"
3. Verify: "Paper" has reset button, "Paper (Copy)" doesn't
4. Delete "Paper"
5. Verify: "Initialize Missing (1)" appears
6. Rename "Paper (Copy)" to "Paper"
7. Verify: Reset button appears (name matches)
```

### Test 5: Multiple Refreshes

```
1. Initialize all 5 defaults
2. Refresh page 10 times
3. Verify: Still exactly 5 presets (no duplicates)
4. Verify: No initialization messages in console
```

## Files Changed

### Core Logic

- `src/repo/presets.init.ts`
  - Removed auto-initialization behavior
  - Added `resetSinglePresetByName()`
  - Added `getDefaultPresetsStatus()`
  - Improved name-based detection

### Hooks

- `src/hooks/usePresets.ts`
  - Added `useResetSinglePreset()`
  - Added `useDefaultPresetsStatus()`
  - Kept `useInitializePresets()` for manual init

### UI

- `app/providers.tsx`
  - **Removed** auto-initialization on startup
  - Now just logs "ready" message

- `app/library/PresetManager.tsx`
  - Replaced "Reset Defaults" with "Initialize Missing"
  - Added `handleResetSingle()` function
  - Added `onReset` prop to PresetCard
  - Reset button only shows for exact name matches
  - Amber styling for reset buttons (warning color)

### Data Structure

- `src/repo/presets.default.ts`
  - Unchanged (still uses uuidv4() for IDs)
  - IDs don't matter because detection is name-based

## Advantages of This Approach

1. **No Surprises**: Nothing happens automatically
2. **Explicit Control**: User decides when to initialize
3. **Granular Reset**: Can reset individual presets
4. **Smart Detection**: Name-based, not ID-based
5. **Duplicate-Proof**: Impossible to create duplicates
6. **Rename-Safe**: If renamed, treated as custom
7. **Fast**: Detection is O(n) where n = # of presets (~5-20)
8. **Reliable**: No refresh-triggered side effects

## UI/UX Flow

```
User opens PresetManager
  ↓
Has 0 defaults?
  YES → Show "Initialize Missing (5)" button (blue, prominent)
  NO → Check each default
    ↓
    For each default preset card:
      ↓
      Name matches default? (e.g., exactly "Paper")
        YES → Show "Reset to Default" button (amber, warning)
        NO → No reset button (it's custom now)
```

## Common Questions

**Q: What if I want to reset ALL defaults at once?**
A: Delete all 5 system presets (or just the ones you want), then click "Initialize Missing". This recreates them from source.

**Q: Can I rename a default preset?**
A: Yes, but it becomes a custom preset. The reset button disappears. Original can be re-initialized.

**Q: What if I customize "Paper" and want to keep both versions?**
A: Duplicate "Paper" to "Paper (Custom)", edit the copy. Original "Paper" keeps its reset button.

**Q: Will presets auto-update when I pull new code?**
A: No. You must manually reset presets to get new field definitions.

**Q: What if the default names change in code (e.g., "Paper" → "Research Paper")?**
A: Old "Paper" won't match anymore. New "Research Paper" will show as missing. This is intentional.

## Migration from Old System

If users have old auto-initialized presets with duplicate names:

```typescript
// Run once in console to clean up
import { db } from "@/src/db/dexie";

// Find duplicates
const presets = await db.presets.toArray();
const byName = new Map();
presets.forEach((p) => {
  if (p.isSystem) {
    if (!byName.has(p.name)) {
      byName.set(p.name, []);
    }
    byName.get(p.name).push(p);
  }
});

// Delete all but first of each name
for (const [name, list] of byName) {
  if (list.length > 1) {
    const toDelete = list.slice(1).map((p) => p.id);
    await db.presets.bulkDelete(toDelete);
    console.log(`Cleaned up ${toDelete.length} duplicate "${name}" presets`);
  }
}
```

## Summary

The new system is **manual**, **explicit**, and **granular**. Users have complete control over when defaults are initialized and when they're reset. No automatic behavior means no surprises. Name-based detection ensures reliability and prevents duplicates forever.

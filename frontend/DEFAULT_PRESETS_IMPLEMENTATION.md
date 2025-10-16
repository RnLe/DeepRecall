# Default Presets Implementation

## Overview

Implemented a system for hard-coded default presets that are initialized on app startup and can be reset/initialized by users at any time. The presets are fully editable through duplication, maintaining the mental model boundaries.

## Default Presets

The following 5 default presets are now available:

1. **Paper** - Research papers and conference publications
2. **Textbook** - Educational textbooks and course books
3. **Thesis** - PhD dissertations, Master's theses, and Bachelor's theses
4. **Script** - Lecture scripts, course materials, and teaching notes
5. **Slides** - Presentation slides, talks, and seminars

## Key Features

### 1. Automatic Initialization

- Default presets are automatically initialized on app startup
- Uses idempotent initialization (safe to call multiple times)
- Only adds missing presets, doesn't duplicate existing ones

### 2. User Control via PresetManager

- New "Initialize Defaults" / "Reset Defaults" button in PresetManager UI
- Shows count of missing default presets
- Allows users to reset specific presets by name to their original configuration
- Confirmation dialog before reset

### 3. System Preset Protection

- Default presets marked as `isSystem: true`
- Cannot be edited or deleted directly
- Users can duplicate them to create customizable versions
- Clear visual distinction in UI (blue "Default" badge)

### 4. Smart Reset Behavior

- `resetDefaultPresetsByName()` - Resets specific presets by name
- Only affects presets with matching names from the defaults list
- Preserves all other user and system presets
- Returns count of reset and skipped presets

## File Changes

### Core Files Modified

1. **`src/repo/presets.default.ts`**
   - Replaced "Course Notes" with "Script" preset
   - Added new "Slides" preset
   - Exported `DEFAULT_PRESET_NAMES` constant for easy lookup
   - All 5 presets have detailed field configurations

2. **`src/repo/presets.init.ts`**
   - Updated `initializePresets()` to check by name instead of ID
   - Added `resetDefaultPresetsByName()` for selective reset
   - Added `getMissingDefaultPresets()` to check what's missing
   - Improved idempotency and error handling

3. **`src/hooks/usePresets.ts`**
   - Added `useResetSystemPresets()` hook
   - Added `useResetDefaultPresets()` hook with optional name filter
   - Added `useMissingDefaultPresets()` hook for UI indicators
   - All hooks properly invalidate React Query cache

4. **`app/providers.tsx`**
   - Re-enabled automatic preset initialization on app startup
   - Proper effect management with `useRef` to prevent double-initialization

5. **`app/library/PresetManager.tsx`**
   - Added "Initialize Defaults" / "Reset Defaults" button
   - Shows count of missing presets dynamically
   - Separated system presets and user presets into distinct sections
   - System presets show "Default" badge and only allow duplication
   - User presets show full edit/delete/duplicate controls
   - Improved layout with section headers and icons

## Mental Model Compliance

✅ **Single Source of Truth**

- Default preset definitions live in `presets.default.ts`
- Dexie holds the runtime state (IndexedDB)
- React Query manages cache invalidation

✅ **Local-First**

- All preset data stored in browser (IndexedDB via Dexie)
- No server calls for presets
- Deterministic initialization

✅ **Boundaries Respected**

- Presets are durable knowledge → **Dexie** (not Zustand)
- UI interactions use **React Query mutations** with proper invalidation
- No circular dependencies or loops

✅ **Idempotent Operations**

- Safe to call `initializePresets()` multiple times
- Name-based detection prevents duplicates
- Reset operations are predictable and reversible

## Usage

### For Users

1. **First Run**: Default presets are automatically created
2. **To Reset**: Go to Library → Preset Manager → Click "Reset Defaults"
3. **To Customize**: Duplicate any default preset and edit the copy
4. **To Initialize Missing**: Button shows count of missing defaults

### For Developers

```typescript
// Initialize on startup (already done in providers.tsx)
const initializePresets = useInitializePresets();
initializePresets.mutate();

// Reset all defaults
const resetDefaults = useResetDefaultPresets();
resetDefaults.mutate(); // resets all 5

// Reset specific presets
resetDefaults.mutate(["Paper", "Textbook"]); // only these two

// Check what's missing
const missing = useMissingDefaultPresets();
// missing = ["Script", "Slides"] if only those are missing

// Direct repository calls
import { resetDefaultPresetsByName } from "@/src/repo/presets.init";
const result = await resetDefaultPresetsByName(["Paper"]);
// result = { reset: 1, skipped: 0 }
```

## Database Schema

The Dexie schema already supports the `isSystem` field:

```typescript
presets: "id, name, targetEntity, isSystem, createdAt, updatedAt";
```

This allows efficient queries for system vs. user presets:

- `db.presets.where("isSystem").equals(1).toArray()` - Get all system presets
- `db.presets.where("isSystem").equals(0).toArray()` - Get all user presets

## Testing Checklist

- [x] Default presets auto-initialize on app startup
- [x] No duplicate presets created on multiple startups
- [x] "Reset Defaults" button works correctly
- [x] System presets cannot be edited/deleted
- [x] System presets can be duplicated
- [x] User presets can be edited/deleted/duplicated
- [x] Missing preset count updates dynamically
- [x] No TypeScript compilation errors
- [x] Mental model boundaries respected

## Future Enhancements

1. **Preset Import/Export**: Allow users to share custom presets as JSON
2. **Preset Templates**: Community-contributed preset library
3. **Preset Versioning**: Track changes to presets over time
4. **Preset Analytics**: Show which presets are most used

## Summary

The implementation provides a clean, user-friendly way to manage default presets while maintaining full control and customization. Users can always return to the defaults, and the system prevents accidental data loss by protecting system presets while allowing duplication for customization.

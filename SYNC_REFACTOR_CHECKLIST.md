# Sync Refactor Checklist

Track progress splitting hooks into sync (write) and read versions.

## Hooks to Refactor

- [x] `usePresets.ts`
- [x] `useWorks.ts`
- [x] `useAuthors.ts`
- [x] `useAssets.ts`
- [x] `useEdges.ts`
- [x] `useAnnotations.ts`
- [x] `useActivities.ts`
- [x] `useCards.ts`
- [x] `useCollections.ts`
- [x] `useReviewLogs.ts`
- [x] `useReplicationJobs.ts`
- [x] `useBlobsMeta.ts`
- [x] `useDeviceBlobs.ts`
- [x] `useBlobBridge.ts` (no changes needed - utility hook)

## Implementation Steps

1. Split hook into `use<Entity>Sync()` and `use<Entity>()`
2. Add sync hook to `SyncManager` component
3. Test that entity syncs correctly
4. Verify no race conditions in logs

## Completion

- [x] All hooks refactored
- [x] `SyncManager` created in providers
- [x] All sync hooks registered
- [x] Manual testing complete

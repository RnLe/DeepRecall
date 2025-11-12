/**
 * @deeprecall/data - Hooks Index
 * Export custom React hooks for data access
 */

export * from "./usePresets";
export * from "./useAuthors";
export * from "./useWorks";
export * from "./useActivities";
export * from "./useAnnotations";
export * from "./useAssets";
export * from "./useCards";
export * from "./useCollections";
export * from "./useEdges";
export * from "./useReviewLogs";

// Blob coordination hooks
export * from "./useBlobsMeta";
export * from "./useDeviceBlobs";
export * from "./useReplicationJobs";

// System monitoring hooks
export * from "./useSystemMonitoring";

// Boards and strokes (note-taking canvas)
export * from "./useBoards";
export * from "./useStrokes";

// Library bridge hooks (combines CAS + Electric)
export * from "./useBlobBridge";

// Entitlements and feature gating
export * from "./useEntitlements";

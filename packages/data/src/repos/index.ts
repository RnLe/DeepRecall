/**
 * @deeprecall/data - Repositories Index
 * Export all Dexie repository modules
 */

export * as activities from "./activities";
export * as annotations from "./annotations";
export * as assets from "./assets";
export * as authors from "./authors";
export * as cards from "./cards";
export * as collections from "./collections";
export * as edges from "./edges";
export * as library from "./library";
export * as presets from "./presets";
export * as works from "./works";
export * as folderSourcesLocal from "./folder-sources.local";
export * as folderSourcesMerged from "./folder-sources.merged";

// Export Electric-enabled repos separately
export * as activitiesElectric from "./activities.electric";
export * as annotationsElectric from "./annotations.electric";
export * as assetsElectric from "./assets.electric";
export * as authorsElectric from "./authors.electric";
export * as cardsElectric from "./cards.electric";
export * as collectionsElectric from "./collections.electric";
export * as edgesElectric from "./edges.electric";
export * as worksElectric from "./works.electric";
export * as folderSourcesElectric from "./folder-sources.electric";
export * as folderSourcesRemote from "./folder-sources.remote";

// Export blob coordination repos (Electric-only, no Dexie versions)
export * as blobsMetaElectric from "./blobs-meta.electric";
export * as deviceBlobsElectric from "./device-blobs.electric";
export * as replicationJobsElectric from "./replication-jobs.electric";

// Export blob write operations (client-safe, no server dependencies)
export * from "./blobs-meta.writes";
export * from "./device-blobs.writes";
export * from "./blobs-meta.local"; // Local-only blob operations (guest mode)

// NOTE: blobs.server.ts is NOT exported here because it contains Node.js-only code (pg library)
// Import it directly in server-side code: import { ... } from "@deeprecall/data/repos/blobs.server"

// Export preset utilities
export * from "./presets.init";
export * from "./presets.default";

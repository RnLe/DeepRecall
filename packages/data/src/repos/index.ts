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

// Export Electric-enabled repos separately
export * as activitiesElectric from "./activities.electric";
export * as annotationsElectric from "./annotations.electric";
export * as assetsElectric from "./assets.electric";
export * as authorsElectric from "./authors.electric";
export * as cardsElectric from "./cards.electric";
export * as collectionsElectric from "./collections.electric";
export * as edgesElectric from "./edges.electric";
export * as worksElectric from "./works.electric";

// Export preset utilities
export * from "./presets.init";
export * from "./presets.default";

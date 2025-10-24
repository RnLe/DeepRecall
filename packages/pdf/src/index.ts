/**
 * @deeprecall/pdf
 * PDF.js rendering facades, tiling, viewport transforms, and caching
 */

export * from "./utils";
export * from "./hooks";

// Re-export configuration function at package root for convenience
export { configurePdfWorker } from "./utils/pdf";

/**
 * Server initialization
 * Import this in instrumentation.ts to run at Next.js startup
 */

let initialized = false;

export async function initializeServer() {
  if (initialized) return;

  console.log("🚀 Initializing DeepRecall server...");

  // Lazy import to avoid loading native modules during Edge instrumentation
  const { initDB } = await import("./db");
  initDB();

  initialized = true;
  console.log("✅ Server ready");
}

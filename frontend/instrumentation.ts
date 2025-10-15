/**
 * Next.js instrumentation hook
 * Runs once at server startup (before any requests)
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Initialize server (directories and DB)
    const { initializeServer } = await import("./src/server/init");
    await initializeServer();
  }
}

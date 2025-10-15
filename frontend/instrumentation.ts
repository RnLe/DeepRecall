/**
 * Next.js instrumentation hook
 * Runs once at server startup (before any requests)
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // DB initialization happens lazily on first API call via getDB()
    // This avoids loading the native module during instrumentation
    console.log(
      "🚀 DeepRecall server starting (DB will initialize on first use)..."
    );
  }
}

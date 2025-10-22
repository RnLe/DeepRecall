/**
 * Admin Utility: Reset Presets
 * Run this once to clean up duplicate presets
 */

import { db } from "@deeprecall/data/db";
import { resetSystemPresets } from "@deeprecall/data/repos/presets.init";

export async function cleanupDuplicatePresets() {
  console.log("🧹 Cleaning up duplicate presets...");

  try {
    // Delete ALL presets (system and user)
    const allPresets = await db.presets.toArray();
    console.log(`Found ${allPresets.length} presets`);

    await db.presets.clear();
    console.log("✅ Cleared all presets");

    // Re-seed system presets
    await resetSystemPresets();
    console.log("✅ Re-seeded system presets");

    const finalCount = await db.presets.count();
    console.log(`✅ Cleanup complete! ${finalCount} presets remaining`);
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
  }
}

// Export for console access
if (typeof window !== "undefined") {
  (window as any).cleanupDuplicatePresets = cleanupDuplicatePresets;
}

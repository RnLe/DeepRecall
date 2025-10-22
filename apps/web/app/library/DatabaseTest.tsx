/**
 * Database Test Component
 * Quick utility to test if Dexie is working
 */

"use client";

import { useEffect, useState } from "react";
import { db } from "@deeprecall/data/db";

export function DatabaseTest() {
  const [status, setStatus] = useState<string>("Testing...");

  useEffect(() => {
    async function testDatabase() {
      try {
        console.log("🧪 Testing database...");

        // Test 1: Can we open the database?
        await db.open();
        console.log("✅ Database opened successfully");

        // Test 2: Can we count works?
        const workCount = await db.works.count();
        console.log(`✅ Works count: ${workCount}`);

        // Test 3: Can we fetch all works?
        const works = await db.works.toArray();
        console.log(`✅ Works fetched:`, works);

        // Test 4: Can we count presets?
        const presetCount = await db.presets.count();
        console.log(`✅ Presets count: ${presetCount}`);

        setStatus(
          `✅ Database OK - ${workCount} works, ${presetCount} presets`
        );
      } catch (error) {
        console.error("❌ Database test failed:", error);
        setStatus(
          `❌ Database error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    testDatabase();
  }, []);

  return (
    <div className="fixed bottom-4 right-4 bg-neutral-800 border border-neutral-700 rounded-lg p-4 text-sm text-neutral-300 max-w-md shadow-lg">
      <div className="font-semibold mb-1">Database Status</div>
      <div className="text-xs">{status}</div>
    </div>
  );
}

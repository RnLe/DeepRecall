/**
 * DELETE /api/admin/database
 * Clears all records from the database (does NOT delete files)
 */

import { NextResponse } from "next/server";
import { clearDatabase } from "@/src/server/cas";

export async function DELETE() {
  try {
    await clearDatabase();
    return NextResponse.json({ success: true, message: "Database cleared" });
  } catch (error) {
    console.error("Error clearing database:", error);
    return NextResponse.json(
      { error: "Failed to clear database" },
      { status: 500 }
    );
  }
}

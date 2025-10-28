import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      message: "Blob deduplication endpoint - not implemented yet",
    },
    { status: 501 }
  );
}

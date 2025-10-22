/**
 * POST /api/library/create-markdown
 * Create a markdown note from text content
 * Returns blob metadata for client to create Asset
 */

import { NextRequest, NextResponse } from "next/server";
import { createMarkdownBlob } from "@/src/server/cas";
import { z } from "zod";

const CreateMarkdownSchema = z.object({
  content: z.string().min(1),
  title: z.string().min(1),
  annotationId: z.string().optional(),
  workId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = CreateMarkdownSchema.parse(body);

    // Generate filename from title
    const filename = `${input.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;

    // Create markdown blob
    const { hash, size } = await createMarkdownBlob(input.content, filename);

    console.log(`Created markdown: ${filename} → ${hash.slice(0, 16)}...`);

    return NextResponse.json({
      blob: {
        sha256: hash,
        size,
        mime: "text/markdown",
        filename,
      },
      metadata: {
        title: input.title,
        annotationId: input.annotationId,
        workId: input.workId,
        tags: input.tags,
      },
    });
  } catch (error) {
    console.error("Markdown creation failed:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create markdown note",
      },
      { status: 500 }
    );
  }
}

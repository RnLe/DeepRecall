/**
 * Deterministic ID Generation for Annotations
 * Uses SHA-256 hash of canonical representation to ensure idempotency
 */

/**
 * Generate deterministic annotation ID
 * Hash of: sha256 + page + sorted coords + type
 *
 * This ensures:
 * - Same annotation coordinates = same ID (no duplicates on re-import)
 * - Different coordinates = different ID
 * - ID can be regenerated from annotation data alone
 *
 * @param sha256 PDF hash
 * @param page Page number (1-indexed)
 * @param type Annotation type
 * @param coords Normalized rectangles (will be sorted for canonical ordering)
 * @returns Deterministic annotation ID (hex string)
 */
export async function generateAnnotationId(
  sha256: string,
  page: number,
  type: "rectangle" | "highlight",
  coords: Array<{ x: number; y: number; width: number; height: number }>
): Promise<string> {
  // Sort coordinates for canonical ordering (by y, then x)
  const sorted = [...coords].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 0.0001) return a.y - b.y;
    return a.x - b.x;
  });

  // Create canonical string representation
  const parts = [
    sha256,
    `page:${page}`,
    `type:${type}`,
    ...sorted.map(
      (r) =>
        `rect:${r.x.toFixed(6)},${r.y.toFixed(6)},${r.width.toFixed(6)},${r.height.toFixed(6)}`
    ),
  ];

  const canonical = parts.join("|");

  // Hash to generate ID
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
}

/**
 * Extract all rectangles from annotation data for ID generation
 * Handles both rectangle and highlight annotations
 */
export function extractRectanglesForId(
  data:
    | {
        type: "rectangle";
        rects: Array<{ x: number; y: number; width: number; height: number }>;
      }
    | {
        type: "highlight";
        ranges: Array<{
          text: string;
          rects: Array<{ x: number; y: number; width: number; height: number }>;
        }>;
      }
): Array<{ x: number; y: number; width: number; height: number }> {
  if (data.type === "rectangle") {
    return data.rects;
  } else {
    // For highlights, flatten all rects from all ranges
    return data.ranges.flatMap((range) => range.rects);
  }
}

/**
 * Regenerate ID for an existing annotation (useful for validation/migration)
 */
export async function regenerateAnnotationId(annotation: {
  sha256: string;
  page: number;
  data:
    | {
        type: "rectangle";
        rects: Array<{ x: number; y: number; width: number; height: number }>;
      }
    | {
        type: "highlight";
        ranges: Array<{
          text: string;
          rects: Array<{ x: number; y: number; width: number; height: number }>;
        }>;
      };
}): Promise<string> {
  const coords = extractRectanglesForId(annotation.data);
  return generateAnnotationId(
    annotation.sha256,
    annotation.page,
    annotation.data.type,
    coords
  );
}

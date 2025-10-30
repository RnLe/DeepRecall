/**
 * MIME Type Detection Utilities
 *
 * Handles MIME type detection from multiple sources:
 * 1. Magic bytes (binary signatures)
 * 2. File extensions
 * 3. Validation against supported types
 *
 * Used across all platforms for consistent file type handling,
 * especially for extension-less files (Mobile storage).
 */

/**
 * Supported file types organized by category
 */
export const SUPPORTED_TYPES = {
  documents: ["application/pdf"],
  images: [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ],
  text: ["text/plain", "text/markdown", "text/html", "text/csv"],
  structured: ["application/json", "application/xml", "text/xml"],
} as const;

/**
 * All supported MIME types (flattened)
 */
export const ALL_SUPPORTED_TYPES = Object.values(SUPPORTED_TYPES).flat();

/**
 * MIME type to file extension mapping
 */
const MIME_TO_EXTENSION: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/html": "html",
  "text/csv": "csv",
  "application/json": "json",
  "application/xml": "xml",
  "text/xml": "xml",
};

/**
 * File extension to MIME type mapping
 */
const EXTENSION_TO_MIME: Record<string, string> = {
  // Documents
  pdf: "application/pdf",

  // Images
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",

  // Text
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  html: "text/html",
  htm: "text/html",
  csv: "text/csv",

  // Structured data
  json: "application/json",
  xml: "application/xml",

  // LaTeX (special case - treat as text)
  tex: "text/plain",
  bib: "text/plain",
};

/**
 * Magic byte signatures for binary file detection
 * First few bytes of files uniquely identify many formats
 */
const MAGIC_BYTES: Array<{
  mime: string;
  signature: number[];
  offset?: number;
}> = [
  // PDF: %PDF
  { mime: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46] },

  // PNG: .PNG
  {
    mime: "image/png",
    signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },

  // JPEG: ÿØÿ
  { mime: "image/jpeg", signature: [0xff, 0xd8, 0xff] },

  // GIF: GIF87a or GIF89a
  { mime: "image/gif", signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },
  { mime: "image/gif", signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] },

  // WebP: RIFF....WEBP
  { mime: "image/webp", signature: [0x52, 0x49, 0x46, 0x46] }, // RIFF (WebP is at offset 8)
];

/**
 * Detect MIME type from ArrayBuffer using magic bytes
 *
 * @param buffer - File content as ArrayBuffer
 * @returns Detected MIME type or 'application/octet-stream' if unknown
 *
 * @example
 * const buffer = await file.arrayBuffer();
 * const mime = detectMimeFromBuffer(buffer);
 * // => 'application/pdf' or 'image/png' etc.
 */
export function detectMimeFromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // Check magic bytes
  for (const magic of MAGIC_BYTES) {
    const offset = magic.offset || 0;
    const signature = magic.signature;

    // Check if buffer is long enough
    if (bytes.length < offset + signature.length) {
      continue;
    }

    // Compare bytes
    let matches = true;
    for (let i = 0; i < signature.length; i++) {
      if (bytes[offset + i] !== signature[i]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      // Special case: WebP needs additional validation at offset 8
      if (magic.mime === "image/webp") {
        if (bytes.length >= 12) {
          const webpSignature = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
          const webpMatches = webpSignature.every(
            (byte, i) => bytes[8 + i] === byte
          );
          if (webpMatches) {
            return "image/webp";
          }
        }
      } else {
        return magic.mime;
      }
    }
  }

  // Try text-based detection
  const textMime = detectTextBasedMime(bytes);
  if (textMime) {
    return textMime;
  }

  // Unknown binary format
  return "application/octet-stream";
}

/**
 * Detect text-based file formats
 * Checks for common text patterns (JSON, XML, HTML, etc.)
 */
function detectTextBasedMime(bytes: Uint8Array): string | null {
  // Only check first 1KB for performance
  const sampleSize = Math.min(bytes.length, 1024);
  const sample = bytes.slice(0, sampleSize);

  // Try to decode as UTF-8 text
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(sample);
  } catch {
    // Not valid UTF-8, probably binary
    return null;
  }

  // Trim whitespace for easier matching
  const trimmed = text.trim();

  // JSON: starts with { or [
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(text);
      return "application/json";
    } catch {
      // Not valid JSON, might be plain text
    }
  }

  // XML/HTML: starts with < or <?xml
  if (trimmed.startsWith("<?xml")) {
    return "application/xml";
  }

  if (trimmed.startsWith("<!DOCTYPE html") || trimmed.startsWith("<html")) {
    return "text/html";
  }

  // SVG: XML with <svg
  if (trimmed.includes("<svg")) {
    return "image/svg+xml";
  }

  // Markdown: Check for common markdown patterns
  if (
    /^#+\s/.test(trimmed) || // Headers
    /^\*\*|\*\s/.test(trimmed) || // Bold or lists
    /^\[.+\]\(.+\)/.test(trimmed) // Links
  ) {
    return "text/markdown";
  }

  // CSV: Look for comma-separated values
  const lines = trimmed.split("\n").slice(0, 5);
  if (lines.length > 1 && lines.every((line) => line.includes(","))) {
    return "text/csv";
  }

  // Default to plain text if it's readable UTF-8
  return "text/plain";
}

/**
 * Detect MIME type from filename extension
 *
 * @param filename - Filename with extension
 * @returns MIME type or 'application/octet-stream' if unknown
 *
 * @example
 * detectMimeFromFilename('document.pdf') // => 'application/pdf'
 * detectMimeFromFilename('image.jpg')    // => 'image/jpeg'
 * detectMimeFromFilename('unknown.xyz')  // => 'application/octet-stream'
 */
export function detectMimeFromFilename(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 2) {
    return "application/octet-stream";
  }

  const ext = parts[parts.length - 1].toLowerCase();
  return EXTENSION_TO_MIME[ext] || "application/octet-stream";
}

/**
 * Get file extension for a MIME type
 *
 * @param mime - MIME type string
 * @returns File extension without dot, or null if unknown
 *
 * @example
 * getExtensionForMime('application/pdf') // => 'pdf'
 * getExtensionForMime('image/jpeg')      // => 'jpg'
 * getExtensionForMime('unknown/type')    // => null
 */
export function getExtensionForMime(mime: string): string | null {
  return MIME_TO_EXTENSION[mime] || null;
}

/**
 * Check if a MIME type is supported by the application
 *
 * @param mime - MIME type to check
 * @returns true if supported, false otherwise
 *
 * @example
 * isSupportedMimeType('application/pdf') // => true
 * isSupportedMimeType('video/mp4')       // => false
 */
export function isSupportedMimeType(mime: string): boolean {
  return ALL_SUPPORTED_TYPES.includes(mime as any);
}

/**
 * Get the category of a MIME type
 *
 * @param mime - MIME type
 * @returns Category name or 'unknown'
 *
 * @example
 * getMimeCategory('application/pdf') // => 'documents'
 * getMimeCategory('image/png')       // => 'images'
 * getMimeCategory('video/mp4')       // => 'unknown'
 */
export function getMimeCategory(
  mime: string
): keyof typeof SUPPORTED_TYPES | "unknown" {
  for (const [category, mimes] of Object.entries(SUPPORTED_TYPES)) {
    if ((mimes as readonly string[]).includes(mime)) {
      return category as keyof typeof SUPPORTED_TYPES;
    }
  }
  return "unknown";
}

/**
 * Comprehensive MIME detection from File object
 * Tries multiple detection methods in order:
 * 1. File.type property (browser-provided)
 * 2. Magic bytes from file content
 * 3. Filename extension
 *
 * @param file - File object to analyze
 * @returns Promise<string> - Detected MIME type
 *
 * @example
 * const file = input.files[0];
 * const mime = await detectMimeFromFile(file);
 * // => 'application/pdf'
 */
export async function detectMimeFromFile(file: File): Promise<string> {
  // 1. Try browser-provided MIME type
  if (file.type && file.type !== "application/octet-stream") {
    return file.type;
  }

  // 2. Try magic bytes (read first 16 bytes)
  try {
    const slice = file.slice(0, 16);
    const buffer = await slice.arrayBuffer();
    const detectedMime = detectMimeFromBuffer(buffer);

    if (detectedMime !== "application/octet-stream") {
      return detectedMime;
    }
  } catch (error) {
    console.warn("Failed to detect MIME from buffer:", error);
  }

  // 3. Fallback to filename extension
  return detectMimeFromFilename(file.name);
}

/**
 * Validate file size against reasonable limits
 * Prevents uploading unreasonably large files
 *
 * @param size - File size in bytes
 * @param mime - MIME type of the file
 * @returns { valid: boolean; reason?: string }
 *
 * @example
 * validateFileSize(1024 * 1024 * 50, 'application/pdf')
 * // => { valid: true }
 *
 * validateFileSize(1024 * 1024 * 1024, 'image/png')
 * // => { valid: false, reason: 'Image files must be under 50 MB' }
 */
export function validateFileSize(
  size: number,
  mime: string
): { valid: boolean; reason?: string } {
  const MB = 1024 * 1024;

  const limits = {
    "application/pdf": 200 * MB, // PDFs can be large (textbooks)
    "image/png": 50 * MB,
    "image/jpeg": 50 * MB,
    "image/gif": 50 * MB,
    "image/webp": 50 * MB,
    "text/plain": 10 * MB,
    "text/markdown": 10 * MB,
    "application/json": 10 * MB,
  };

  const limit = limits[mime as keyof typeof limits];

  if (!limit) {
    // Unknown type: default to 100 MB
    if (size > 100 * MB) {
      return {
        valid: false,
        reason: "File must be under 100 MB",
      };
    }
    return { valid: true };
  }

  if (size > limit) {
    const category = getMimeCategory(mime);
    const limitMB = Math.floor(limit / MB);
    return {
      valid: false,
      reason: `${category.charAt(0).toUpperCase() + category.slice(1)} files must be under ${limitMB} MB`,
    };
  }

  return { valid: true };
}

/**
 * Human-readable file size formatting
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 *
 * @example
 * formatFileSize(1536) // => "1.5 KB"
 * formatFileSize(1048576) // => "1.0 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const KB = bytes / 1024;
  if (KB < 1024) {
    return `${KB.toFixed(1)} KB`;
  }

  const MB = KB / 1024;
  if (MB < 1024) {
    return `${MB.toFixed(1)} MB`;
  }

  const GB = MB / 1024;
  return `${GB.toFixed(1)} GB`;
}

/**
 * File metadata extraction utilities
 * Extracts dimensions, line counts, and other file-specific metadata
 */

import { readFile } from "fs/promises";
import sizeOf from "image-size";
import { logger } from "@deeprecall/telemetry";

/**
 * Extract metadata from a file based on its MIME type
 * @param filePath - absolute path to file
 * @param mime - MIME type
 * @returns metadata object with type-specific fields
 */
export async function extractFileMetadata(
  filePath: string,
  mime: string
): Promise<{
  imageWidth?: number;
  imageHeight?: number;
  lineCount?: number;
}> {
  const metadata: {
    imageWidth?: number;
    imageHeight?: number;
    lineCount?: number;
  } = {};

  try {
    // Extract image dimensions
    if (mime.startsWith("image/")) {
      try {
        const buffer = await readFile(filePath);
        const dimensions = sizeOf(buffer);
        if (dimensions.width && dimensions.height) {
          metadata.imageWidth = dimensions.width;
          metadata.imageHeight = dimensions.height;
        }
      } catch (error) {
        logger.warn("server.api", "Failed to extract image dimensions", {
          filePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Extract line count for text files
    if (
      mime === "text/plain" ||
      mime === "text/markdown" ||
      mime.startsWith("text/")
    ) {
      try {
        const content = await readFile(filePath, "utf-8");
        metadata.lineCount = content.split("\n").length;
      } catch (error) {
        logger.warn("server.api", "Failed to count lines", {
          filePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    logger.error("server.api", "Error extracting file metadata", {
      filePath,
      mime,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return metadata;
}

/**
 * Extract metadata from a buffer based on its MIME type
 * @param buffer - file buffer
 * @param mime - MIME type
 * @returns metadata object with type-specific fields
 */
export async function extractBufferMetadata(
  buffer: Buffer,
  mime: string
): Promise<{
  imageWidth?: number;
  imageHeight?: number;
  lineCount?: number;
}> {
  const metadata: {
    imageWidth?: number;
    imageHeight?: number;
    lineCount?: number;
  } = {};

  try {
    // Extract image dimensions
    if (mime.startsWith("image/")) {
      try {
        const dimensions = sizeOf(buffer);
        if (dimensions.width && dimensions.height) {
          metadata.imageWidth = dimensions.width;
          metadata.imageHeight = dimensions.height;
        }
      } catch (error) {
        logger.warn("server.api", "Failed to extract image dimensions", {
          source: "buffer",
          mime,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Extract line count for text files
    if (
      mime === "text/plain" ||
      mime === "text/markdown" ||
      mime.startsWith("text/")
    ) {
      try {
        const content = buffer.toString("utf-8");
        metadata.lineCount = content.split("\n").length;
      } catch (error) {
        logger.warn("server.api", "Failed to count lines from buffer", {
          mime,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    logger.error("server.api", "Error extracting buffer metadata", {
      mime,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return metadata;
}

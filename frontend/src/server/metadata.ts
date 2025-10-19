/**
 * File metadata extraction utilities
 * Extracts dimensions, line counts, and other file-specific metadata
 */

import { readFile } from "fs/promises";
import sizeOf from "image-size";

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
        console.warn(
          `Failed to extract image dimensions from ${filePath}:`,
          error
        );
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
        console.warn(`Failed to count lines in ${filePath}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error extracting metadata from ${filePath}:`, error);
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
        console.warn(`Failed to extract image dimensions from buffer:`, error);
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
        console.warn(`Failed to count lines in buffer:`, error);
      }
    }
  } catch (error) {
    console.error(`Error extracting metadata from buffer:`, error);
  }

  return metadata;
}

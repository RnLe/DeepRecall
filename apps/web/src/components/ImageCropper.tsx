/**
 * ImageCropper Component
 *
 * Allows users to:
 * 1. Upload an image (max 10MB, max 4000x4000px)
 * 2. Auto-compress large images to ~2MB
 * 3. Select a square crop region
 * 4. Save both original (compressed) and display (up to 1000x1000px) versions
 *
 * Preserves crop region metadata for future edits.
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, X, Move } from "lucide-react";

interface CropRegion {
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
  size: number; // 0-1 normalized
}

interface ImageCropperProps {
  /** Initial image URL (for editing existing avatars) */
  initialImageUrl?: string;
  /** Initial crop region (for editing existing avatars) */
  initialCropRegion?: CropRegion;
  /** Callback when save is clicked */
  onSave: (data: {
    originalBlob: Blob;
    displayBlob: Blob;
    cropRegion: CropRegion;
  }) => Promise<void>;
  /** Callback when cancel is clicked */
  onCancel: () => void;
  /** Optional initial file to load (for drag-and-drop) */
  initialFile?: File;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DIMENSION = 4000;
const TARGET_ORIGINAL_SIZE = 2 * 1024 * 1024; // 2MB
const DISPLAY_SIZE = 1000; // 1000x1000px (or smaller if original doesn't allow)

export function ImageCropper({
  initialImageUrl,
  initialCropRegion,
  onSave,
  onCancel,
  initialFile,
}: ImageCropperProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(
    initialImageUrl || null
  );
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(
    null
  );
  const [cropRegion, setCropRegion] = useState<CropRegion>(
    initialCropRegion || { x: 0.25, y: 0.25, size: 0.5 }
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<"move" | "resize" | null>(null);
  const [resizeCorner, setResizeCorner] = useState<
    "tl" | "tr" | "bl" | "br" | null
  >(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [imageStats, setImageStats] = useState<{
    width: number;
    height: number;
    fileSize: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Process initial file if provided
  useEffect(() => {
    if (initialFile) {
      processFile(initialFile);
    }
  }, [initialFile]);

  // Load image when URL changes
  useEffect(() => {
    if (!imageUrl) return;

    const img = new Image();
    img.onload = () => {
      setOriginalImage(img);
      setError(null);

      // Set image stats if not already set (for initialImageUrl case)
      if (!imageStats) {
        // For existing avatars, we may not have the exact file size, so estimate
        setImageStats({
          width: img.width,
          height: img.height,
          fileSize: 0, // Unknown for existing images
        });
      }
    };
    img.onerror = () => {
      setError("Failed to load image");
    };
    img.src = imageUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl]);

  // Draw image and crop overlay
  useEffect(() => {
    if (!canvasRef.current || !originalImage) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to fit container while maintaining aspect ratio
    const containerWidth = canvas.parentElement?.clientWidth || 500;
    const containerHeight = canvas.parentElement?.clientHeight || 500;
    const aspectRatio = originalImage.width / originalImage.height;

    let displayWidth = containerWidth;
    let displayHeight = containerWidth / aspectRatio;

    if (displayHeight > containerHeight) {
      displayHeight = containerHeight;
      displayWidth = containerHeight * aspectRatio;
    }

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    // Draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);

    // Draw crop overlay
    const cropX = cropRegion.x * canvas.width;
    const cropY = cropRegion.y * canvas.height;
    const cropSize = cropRegion.size * Math.min(canvas.width, canvas.height);

    // Darken outside crop area
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, cropY);
    ctx.fillRect(0, cropY, cropX, cropSize);
    ctx.fillRect(
      cropX + cropSize,
      cropY,
      canvas.width - (cropX + cropSize),
      cropSize
    );
    ctx.fillRect(
      0,
      cropY + cropSize,
      canvas.width,
      canvas.height - (cropY + cropSize)
    );

    // Draw crop box
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 3;
    ctx.strokeRect(cropX, cropY, cropSize, cropSize);

    // Draw corner handles (larger and more visible)
    const handleSize = 12;
    ctx.fillStyle = "#3b82f6";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;

    // Top-left
    ctx.fillRect(
      cropX - handleSize / 2,
      cropY - handleSize / 2,
      handleSize,
      handleSize
    );
    ctx.strokeRect(
      cropX - handleSize / 2,
      cropY - handleSize / 2,
      handleSize,
      handleSize
    );

    // Top-right
    ctx.fillRect(
      cropX + cropSize - handleSize / 2,
      cropY - handleSize / 2,
      handleSize,
      handleSize
    );
    ctx.strokeRect(
      cropX + cropSize - handleSize / 2,
      cropY - handleSize / 2,
      handleSize,
      handleSize
    );

    // Bottom-left
    ctx.fillRect(
      cropX - handleSize / 2,
      cropY + cropSize - handleSize / 2,
      handleSize,
      handleSize
    );
    ctx.strokeRect(
      cropX - handleSize / 2,
      cropY + cropSize - handleSize / 2,
      handleSize,
      handleSize
    );

    // Bottom-right
    ctx.fillRect(
      cropX + cropSize - handleSize / 2,
      cropY + cropSize - handleSize / 2,
      handleSize,
      handleSize
    );
    ctx.strokeRect(
      cropX + cropSize - handleSize / 2,
      cropY + cropSize - handleSize / 2,
      handleSize,
      handleSize
    );
  }, [originalImage, cropRegion]);

  // Draw preview
  useEffect(() => {
    if (!previewCanvasRef.current || !originalImage) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 200;
    canvas.height = 200;

    // Calculate source crop coordinates
    const sourceX = cropRegion.x * originalImage.width;
    const sourceY = cropRegion.y * originalImage.height;
    const sourceSize =
      cropRegion.size * Math.min(originalImage.width, originalImage.height);

    // Draw cropped region
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      originalImage,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      canvas.width,
      canvas.height
    );
  }, [originalImage, cropRegion]);

  // Process a file (used by both file input and drag-and-drop)
  const processFile = async (file: File) => {
    setError(null);

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(
        `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
      );
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    setIsProcessing(true);

    try {
      // Load image
      const img = await loadImage(file);

      // Validate dimensions
      if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
        setError(
          `Image too large. Maximum dimensions are ${MAX_DIMENSION}x${MAX_DIMENSION}px`
        );
        setIsProcessing(false);
        return;
      }

      // Compress if needed
      let processedBlob: Blob = file;
      if (file.size > TARGET_ORIGINAL_SIZE) {
        processedBlob = await compressImage(img, TARGET_ORIGINAL_SIZE);
      }

      const url = URL.createObjectURL(processedBlob);
      setImageUrl(url);
      setImageStats({
        width: img.width,
        height: img.height,
        fileSize: processedBlob.size,
      });
      setIsProcessing(false);
    } catch (err) {
      setError("Failed to process image");
      setIsProcessing(false);
    }
  };

  // Handle file selection from input
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  // Handle canvas mouse down
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Calculate crop region in canvas pixel coordinates
    const cropX = cropRegion.x * canvas.width;
    const cropY = cropRegion.y * canvas.height;
    const cropSize = cropRegion.size * Math.min(canvas.width, canvas.height);

    const handleSize = 12; // Match the drawn handle size
    const threshold = handleSize; // Pixel threshold for handle detection

    // Check if clicking on corners (in pixel coordinates)
    if (
      Math.abs(mouseX - cropX) < threshold &&
      Math.abs(mouseY - cropY) < threshold
    ) {
      setDragMode("resize");
      setResizeCorner("tl");
    } else if (
      Math.abs(mouseX - (cropX + cropSize)) < threshold &&
      Math.abs(mouseY - cropY) < threshold
    ) {
      setDragMode("resize");
      setResizeCorner("tr");
    } else if (
      Math.abs(mouseX - cropX) < threshold &&
      Math.abs(mouseY - (cropY + cropSize)) < threshold
    ) {
      setDragMode("resize");
      setResizeCorner("bl");
    } else if (
      Math.abs(mouseX - (cropX + cropSize)) < threshold &&
      Math.abs(mouseY - (cropY + cropSize)) < threshold
    ) {
      setDragMode("resize");
      setResizeCorner("br");
    } else if (
      mouseX >= cropX &&
      mouseX <= cropX + cropSize &&
      mouseY >= cropY &&
      mouseY <= cropY + cropSize
    ) {
      // Clicking inside crop region - move mode
      setDragMode("move");
    } else {
      return;
    }

    setIsDragging(true);
    setDragStart({ x: mouseX / canvas.width, y: mouseY / canvas.height });
  };

  // Handle canvas mouse move
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging || !dragStart || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / canvas.width;
      const y = (event.clientY - rect.top) / canvas.height;

      const dx = x - dragStart.x;
      const dy = y - dragStart.y;

      if (dragMode === "move") {
        // Move the crop region
        setCropRegion((prev) => {
          const newX = Math.max(0, Math.min(1 - prev.size, prev.x + dx));
          const newY = Math.max(0, Math.min(1 - prev.size, prev.y + dy));
          return { ...prev, x: newX, y: newY };
        });
      } else if (dragMode === "resize" && resizeCorner) {
        // Resize from corner
        setCropRegion((prev) => {
          let newX = prev.x;
          let newY = prev.y;
          let newSize = prev.size;

          switch (resizeCorner) {
            case "tl":
              // Top-left: adjust x, y, and size
              newX = prev.x + dx;
              newY = prev.y + dy;
              newSize = prev.size - Math.max(dx, dy);
              break;
            case "tr":
              // Top-right: adjust y and size
              newY = prev.y + dy;
              newSize = prev.size - dy;
              break;
            case "bl":
              // Bottom-left: adjust x and size
              newX = prev.x + dx;
              newSize = prev.size - dx;
              break;
            case "br":
              // Bottom-right: just increase size
              newSize = prev.size + Math.max(dx, dy);
              break;
          }

          // Constrain to bounds
          newX = Math.max(0, newX);
          newY = Math.max(0, newY);
          newSize = Math.max(0.1, Math.min(1 - Math.max(newX, newY), newSize));

          // Ensure square stays in bounds
          if (newX + newSize > 1) newSize = 1 - newX;
          if (newY + newSize > 1) newSize = 1 - newY;

          return { x: newX, y: newY, size: newSize };
        });
      }

      setDragStart({ x, y });
    },
    [isDragging, dragStart, dragMode, resizeCorner]
  );

  // Handle canvas mouse up
  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
    setDragMode(null);
    setResizeCorner(null);
  };

  // Handle save
  const handleSave = async () => {
    if (!originalImage || !imageUrl) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Create original blob (already compressed if needed)
      const response = await fetch(imageUrl);
      const originalBlob = await response.blob();

      // Create display blob (100x100px crop)
      const displayBlob = await createDisplayBlob(originalImage, cropRegion);

      await onSave({ originalBlob, displayBlob, cropRegion });
    } catch (err) {
      setError("Failed to save image");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900">
      {/* Header with buttons */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-neutral-100">
            {initialImageUrl ? "Edit Avatar" : "Upload Avatar"}
          </h3>
          <div className="flex items-center gap-2">
            {imageUrl && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm rounded-lg transition-colors"
                >
                  Change Image
                </button>
                <button
                  onClick={handleSave}
                  disabled={isProcessing}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? "Saving..." : "Save"}
                </button>
              </>
            )}
            <button
              onClick={onCancel}
              className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden px-6 py-6">
        <div className="h-full max-w-7xl mx-auto">
          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-lg text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          {/* Upload area */}
          {!imageUrl && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDraggingOver
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-neutral-700 hover:border-blue-500"
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 bg-neutral-800 rounded-full">
                  <Upload className="w-8 h-8 text-neutral-400" />
                </div>
                <div>
                  <p className="text-neutral-300 font-medium mb-1">
                    {isDraggingOver
                      ? "Drop image here"
                      : "Click to upload or drag & drop image"}
                  </p>
                  <p className="text-sm text-neutral-500">
                    Max {MAX_FILE_SIZE / 1024 / 1024}MB, {MAX_DIMENSION}x
                    {MAX_DIMENSION}px
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Image editor - Two Column Layout */}
          {imageUrl && originalImage && imageStats && (
            <div className="grid grid-cols-2 gap-6 h-full">
              {/* LEFT COLUMN - Image and Selection */}
              <div className="flex flex-col h-full">
                {/* Canvas */}
                <div className="flex-1 relative bg-neutral-800 rounded-lg overflow-hidden min-h-0">
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 cursor-move"
                  />
                </div>
              </div>

              {/* RIGHT COLUMN - Preview and Stats */}
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-neutral-800/50 border border-neutral-700/50 rounded-lg">
                  <h3 className="text-sm font-medium text-neutral-300 mb-4">
                    Preview
                  </h3>
                  <div className="flex flex-col items-center gap-2">
                    {/* Large Preview */}
                    <canvas
                      ref={previewCanvasRef}
                      className="rounded-full border-2 border-neutral-700"
                    />
                    <p className="text-xs text-neutral-500">
                      Final result (up to 1000×1000px)
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-neutral-800/50 border border-neutral-700/50 rounded-lg">
                  <h3 className="text-sm font-medium text-neutral-300 mb-3">
                    Image Information
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Original Size:</span>
                      <span className="text-neutral-200">
                        {imageStats.width} × {imageStats.height}px
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Selected Area:</span>
                      <span className="text-neutral-200">
                        {Math.round(
                          cropRegion.size *
                            Math.min(imageStats.width, imageStats.height)
                        )}
                        px²
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">File Size:</span>
                      <span className="text-neutral-200">
                        {(imageStats.fileSize / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Output Size:</span>
                      <span className="text-neutral-200">
                        {Math.min(
                          DISPLAY_SIZE,
                          Math.round(
                            cropRegion.size *
                              Math.min(imageStats.width, imageStats.height)
                          )
                        )}{" "}
                        ×{" "}
                        {Math.min(
                          DISPLAY_SIZE,
                          Math.round(
                            cropRegion.size *
                              Math.min(imageStats.width, imageStats.height)
                          )
                        )}
                        px
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Load an image from a file
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Compress an image to target size
 */
async function compressImage(
  img: HTMLImageElement,
  targetSize: number
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  // Start with original dimensions
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  // Binary search for optimal quality
  let quality = 0.9;
  let blob = await canvasToBlob(canvas, "image/jpeg", quality);

  while (blob.size > targetSize && quality > 0.1) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
  }

  return blob;
}

/**
 * Create display blob (up to 1000x1000px crop, or original size if smaller)
 */
async function createDisplayBlob(
  img: HTMLImageElement,
  cropRegion: CropRegion
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  // Calculate crop dimensions in original image space
  const cropSize = cropRegion.size * Math.min(img.width, img.height);
  const cropX = cropRegion.x * img.width;
  const cropY = cropRegion.y * img.height;

  // Use the smaller of DISPLAY_SIZE or actual crop size to avoid upscaling
  const outputSize = Math.min(DISPLAY_SIZE, cropSize);

  canvas.width = outputSize;
  canvas.height = outputSize;

  // Draw cropped and scaled image
  ctx.drawImage(
    img,
    cropX,
    cropY,
    cropSize,
    cropSize,
    0,
    0,
    outputSize,
    outputSize
  );

  return canvasToBlob(canvas, "image/jpeg", 0.9);
}

/**
 * Convert canvas to blob
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create blob"));
      },
      type,
      quality
    );
  });
}

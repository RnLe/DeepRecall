"use client";

import { useEffect, useState } from "react";

interface GPUStatus {
  available: boolean;
  renderer: string | null;
  vendor: string | null;
  backend: "webgpu" | "webgl" | "none";
}

export function GPUIndicator() {
  const [status, setStatus] = useState<GPUStatus>({
    available: false,
    renderer: null,
    vendor: null,
    backend: "none",
  });

  useEffect(() => {
    async function detectGPU() {
      const result: GPUStatus = {
        available: false,
        renderer: null,
        vendor: null,
        backend: "none",
      };

      // Check WebGPU
      if ("gpu" in navigator) {
        try {
          const adapter = await (navigator as any).gpu.requestAdapter();
          if (adapter) {
            result.available = true;
            result.backend = "webgpu";
            result.renderer = adapter.name ?? "WebGPU";
            result.vendor = null;
            setStatus(result);
            return;
          }
        } catch (e) {
          console.warn("[GPUIndicator] WebGPU check failed:", e);
        }
      }

      // Check WebGL
      try {
        const canvas = document.createElement("canvas");
        const gl =
          canvas.getContext("webgl2") ||
          canvas.getContext("webgl") ||
          canvas.getContext("experimental-webgl");

        if (gl) {
          result.available = true;
          result.backend = "webgl";

          // Get detailed renderer info
          const debugInfo = (gl as WebGLRenderingContext).getExtension(
            "WEBGL_debug_renderer_info"
          );
          if (debugInfo) {
            result.vendor = (gl as WebGLRenderingContext).getParameter(
              debugInfo.UNMASKED_VENDOR_WEBGL
            );
            result.renderer = (gl as WebGLRenderingContext).getParameter(
              debugInfo.UNMASKED_RENDERER_WEBGL
            );
          } else {
            result.renderer = "WebGL (details hidden)";
          }

          // Clean up
          const loseContext = (gl as WebGLRenderingContext).getExtension(
            "WEBGL_lose_context"
          );
          loseContext?.loseContext();
        }
      } catch (e) {
        console.warn("[GPUIndicator] WebGL check failed:", e);
      }

      setStatus(result);
    }

    detectGPU();
  }, []);

  const dotColor = status.available ? "bg-green-500" : "bg-red-500";
  const textColor = status.available ? "text-green-400" : "text-red-400";

  const tooltipLines: string[] = [];
  if (status.available) {
    tooltipLines.push(`${status.backend.toUpperCase()} available`);
    if (status.vendor) tooltipLines.push(status.vendor);
    if (status.renderer) tooltipLines.push(status.renderer);
  } else {
    tooltipLines.push("GPU acceleration unavailable");
    tooltipLines.push("Check chrome://gpu for details");
  }

  const tooltipText = tooltipLines.join("\n");

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1 rounded text-xs ${textColor} cursor-help`}
      title={tooltipText}
    >
      <span className="font-mono">GPU</span>
      <span className={`w-2 h-2 rounded-full ${dotColor} animate-pulse`} />
    </div>
  );
}

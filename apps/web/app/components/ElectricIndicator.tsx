"use client";

import { useState, useEffect } from "react";

interface ElectricStatus {
  connected: boolean;
  url?: string;
  error?: string;
}

export function ElectricIndicator() {
  const [status, setStatus] = useState<ElectricStatus>({
    connected: false,
  });

  useEffect(() => {
    const checkConnection = async () => {
      const electricUrl =
        process.env.NEXT_PUBLIC_ELECTRIC_URL || "http://localhost:5133";
      const sourceId = process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_ID;
      const secret = process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET;

      try {
        // Test a simple shape query with Electric Cloud credentials
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // Build test URL with credentials (query a known table with offset=-1 for quick response)
        const params = new URLSearchParams({
          table: "works",
          offset: "-1", // Just get the shape handle, no data
        });

        if (sourceId) params.append("source_id", sourceId);
        if (secret) params.append("secret", secret);

        const response = await fetch(`${electricUrl}?${params.toString()}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // Electric returns 200 with shape data
        if (response.ok) {
          setStatus({
            connected: true,
            url: electricUrl,
          });
        } else {
          setStatus({
            connected: false,
            url: electricUrl,
            error: `HTTP ${response.status}`,
          });
        }
      } catch (error) {
        setStatus({
          connected: false,
          url: electricUrl,
          error: error instanceof Error ? error.message : "Connection failed",
        });
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, []);

  const dotColor = status.connected ? "bg-green-500" : "bg-red-500";
  const textColor = status.connected ? "text-green-400" : "text-red-400";

  const tooltipLines: string[] = [];
  if (status.connected) {
    tooltipLines.push("✅ Electric Sync Connected");
    if (status.url) tooltipLines.push(`URL: ${status.url}`);
  } else {
    tooltipLines.push("❌ Electric Sync Disconnected");
    if (status.url) tooltipLines.push(`Attempted: ${status.url}`);
    if (status.error) tooltipLines.push(`Error: ${status.error}`);
  }

  const tooltipText = tooltipLines.join("\n");

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs ${textColor} cursor-help`}
      title={tooltipText}
    >
      <span className="font-mono">⚡</span>
      <span
        className={`w-2 h-2 rounded-full ${dotColor} ${status.connected ? "animate-pulse" : ""}`}
      />
    </div>
  );
}

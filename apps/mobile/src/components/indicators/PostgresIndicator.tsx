import { useState, useEffect } from "react";
import { getApiBaseUrl } from "../../config/api";

interface PostgresStatus {
  connected: boolean;
  url?: string;
  error?: string;
}

export function PostgresIndicator() {
  const [status, setStatus] = useState<PostgresStatus>({
    connected: false,
  });

  useEffect(() => {
    const checkConnection = async () => {
      // Mobile uses HTTP API for database writes, not direct Postgres
      const apiUrl = `${getApiBaseUrl()}/api/writes/batch`;

      try {
        // Test the write buffer API endpoint
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // Try to POST an empty batch (should succeed with 200)
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ changes: [] }), // API expects 'changes' not 'writes'
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          setStatus({
            connected: true,
            url: apiUrl,
          });
        } else {
          setStatus({
            connected: false,
            url: apiUrl,
            error: `HTTP ${response.status}`,
          });
        }
      } catch (error) {
        setStatus({
          connected: false,
          url: apiUrl,
          error: error instanceof Error ? error.message : "Connection failed",
        });
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 60000); // Check every 60s (1 minute)

    return () => clearInterval(interval);
  }, []);

  const dotColor = status.connected ? "bg-green-500" : "bg-red-500";
  const textColor = status.connected ? "text-green-400" : "text-red-400";

  const tooltipLines: string[] = [];
  if (status.connected) {
    tooltipLines.push("✅ API Connected");
    if (status.url) tooltipLines.push(`URL: ${status.url}`);
  } else {
    tooltipLines.push("❌ API Disconnected");
    if (status.url) tooltipLines.push(`Attempted: ${status.url}`);
    if (status.error) tooltipLines.push(`Error: ${status.error}`);
  }

  const tooltipText = tooltipLines.join("\n");

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs ${textColor} cursor-help`}
      title={tooltipText}
    >
      <span className="font-mono">API</span>
      <span
        className={`w-2 h-2 rounded-full ${dotColor} ${status.connected ? "animate-pulse" : ""}`}
      />
    </div>
  );
}

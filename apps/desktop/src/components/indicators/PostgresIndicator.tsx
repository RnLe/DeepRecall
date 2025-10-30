import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface PostgresStatus {
  connected: boolean;
  host?: string;
  port?: number;
  database?: string;
  error?: string;
}

export function PostgresIndicator() {
  const [status, setStatus] = useState<PostgresStatus>({
    connected: false,
  });

  useEffect(() => {
    const checkConnection = async () => {
      // Read from environment variables (matches Rust backend)
      const host = import.meta.env.VITE_POSTGRES_HOST || "localhost";
      const port = parseInt(import.meta.env.VITE_POSTGRES_PORT || "5432");
      const database = import.meta.env.VITE_POSTGRES_DB || "deeprecall";

      try {
        // Try a simple query to check connection (works is required table)
        const result = await invoke<any[]>("query_postgres_table", {
          table: "works", // Changed from tableName to table
        });

        // If we got here without error, connection is good
        setStatus({
          connected: true,
          host,
          port,
          database,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        setStatus({
          connected: false,
          host,
          port,
          database,
          error: errorMsg,
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
    tooltipLines.push("✅ PostgreSQL Connected");
    if (status.host) tooltipLines.push(`Host: ${status.host}:${status.port}`);
    if (status.database) tooltipLines.push(`Database: ${status.database}`);
  } else {
    tooltipLines.push("❌ PostgreSQL Disconnected");
    if (status.host)
      tooltipLines.push(`Attempted: ${status.host}:${status.port}`);
    if (status.database) tooltipLines.push(`Database: ${status.database}`);
    if (status.error) tooltipLines.push(`Error: ${status.error}`);
  }

  const tooltipText = tooltipLines.join("\n");

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs ${textColor} cursor-help`}
      title={tooltipText}
    >
      <span className="font-mono">PG</span>
      <span
        className={`w-2 h-2 rounded-full ${dotColor} ${status.connected ? "animate-pulse" : ""}`}
      />
    </div>
  );
}

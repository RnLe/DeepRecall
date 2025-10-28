"use client";

import { useState, useEffect } from "react";

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
      // Read from environment variables
      const host = process.env.NEXT_PUBLIC_POSTGRES_HOST || "localhost";
      const port = parseInt(
        process.env.NEXT_PUBLIC_POSTGRES_PORT || "5432",
        10
      );
      const database = process.env.NEXT_PUBLIC_POSTGRES_DB || "deeprecall";

      try {
        // Use API route to check Postgres connection
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch("/api/health/postgres", {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          setStatus({
            connected: true,
            host,
            port,
            database,
          });
        } else {
          const error = await response.text().catch(() => "Connection failed");
          setStatus({
            connected: false,
            host,
            port,
            database,
            error,
          });
        }
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
    const interval = setInterval(checkConnection, 30000); // Check every 30s

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

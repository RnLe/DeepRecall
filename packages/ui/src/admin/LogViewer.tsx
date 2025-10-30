/**
 * Console Log Viewer Component
 * Shows captured console logs for mobile debugging
 *
 * NOTE: This is a temporary debugging tool.
 * Remove when proper telemetry is implemented.
 */

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getConsoleLogger, type LogEntry } from "@deeprecall/data";

interface LogViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogViewerDialog({ open, onOpenChange }: LogViewerDialogProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<"all" | "log" | "warn" | "error">("all");
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to log updates
  useEffect(() => {
    const logger = getConsoleLogger();
    setLogs(logger.getLogs());

    const unsubscribe = logger.subscribe((newLogs: LogEntry[]) => {
      setLogs(newLogs);
    });

    return unsubscribe;
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (filter !== "all" && log.level !== filter) return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Handle clear
  const handleClear = () => {
    getConsoleLogger().clear();
  };

  // Handle export
  const handleExport = () => {
    const text = getConsoleLogger().exportAsText();
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle copy
  const handleCopy = async () => {
    const text = getConsoleLogger().exportAsText();
    await navigator.clipboard.writeText(text);
  };

  // Get log color
  const getLogColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "error":
        return "text-red-400";
      case "warn":
        return "text-yellow-400";
      case "info":
        return "text-blue-400";
      default:
        return "text-gray-300";
    }
  };

  // Get log icon
  const getLogIcon = (level: LogEntry["level"]) => {
    switch (level) {
      case "error":
        return "❌";
      case "warn":
        return "⚠️";
      case "info":
        return "ℹ️";
      default:
        return "📝";
    }
  };

  if (!open) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="relative w-full max-w-6xl h-[90vh] flex flex-col bg-gray-900 text-gray-100 border border-gray-700 rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          margin: "auto",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-lg font-semibold">Console Logs</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              {filteredLogs.length} / {logs.length} logs
            </span>
            <button
              onClick={() => onOpenChange(false)}
              className="text-gray-400 hover:text-gray-100 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-700">
          {/* Filter buttons */}
          <div className="flex gap-1">
            {(["all", "log", "warn", "error"] as const).map((level) => (
              <button
                key={level}
                onClick={() => setFilter(level)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  filter === level
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-1 text-sm bg-gray-800 border border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Auto-scroll toggle */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-gray-400">Auto-scroll</span>
          </label>

          {/* Action buttons */}
          <button
            onClick={handleCopy}
            className="px-3 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            📋 Copy
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            💾 Export
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1 text-xs rounded bg-red-600 hover:bg-red-700 transition-colors"
          >
            🗑️ Clear
          </button>
        </div>

        {/* Log entries */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-3 bg-gray-950 font-mono text-xs"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No logs to display
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex gap-2 py-1 hover:bg-gray-800/50 rounded px-2 -mx-2"
              >
                <span className="text-gray-500 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className="shrink-0">{getLogIcon(log.level)}</span>
                <span className={`flex-1 break-all ${getLogColor(log.level)}`}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Stats footer */}
        <div className="flex items-center justify-between text-xs text-gray-500 px-4 py-3 border-t border-gray-700">
          <span>
            Errors: {logs.filter((l) => l.level === "error").length} | Warnings:{" "}
            {logs.filter((l) => l.level === "warn").length}
          </span>
          <span>Max: 500 logs (oldest are removed)</span>
        </div>
      </div>
    </div>
  );

  // Render in portal to ensure it's at the end of the DOM (above everything else)
  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : null;
}

/**
 * Compact log viewer button for header
 */
export function LogViewerButton() {
  const [open, setOpen] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [warnCount, setWarnCount] = useState(0);

  // Subscribe to log updates to show badge
  useEffect(() => {
    const logger = getConsoleLogger();

    const unsubscribe = logger.subscribe((logs: LogEntry[]) => {
      setErrorCount(logs.filter((l: LogEntry) => l.level === "error").length);
      setWarnCount(logs.filter((l: LogEntry) => l.level === "warn").length);
    });

    return unsubscribe;
  }, []);

  const hasBadge = errorCount > 0 || warnCount > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
        title="View console logs"
      >
        📋 Logs
        {hasBadge && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white">
            {errorCount > 0 ? errorCount : warnCount}
          </span>
        )}
      </button>
      <LogViewerDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

"use client";

/**
 * Console Logger Utility
 * Captures console.log/warn/error for in-app debugging
 *
 * NOTE: This is a temporary debugging tool for mobile.
 * Remove when proper telemetry is implemented.
 */

export interface LogEntry {
  id: string;
  timestamp: number;
  level: "log" | "warn" | "error" | "info";
  message: string;
  args: any[];
}

class ConsoleLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 500; // Keep last 500 logs
  private originalConsole: {
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
    info: typeof console.info;
  };
  private listeners: Set<(logs: LogEntry[]) => void> = new Set();

  constructor() {
    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      info: console.info.bind(console),
    };
  }

  /**
   * Start capturing console output
   */
  start() {
    const captureLog = (
      level: LogEntry["level"],
      original: (...args: any[]) => void
    ) => {
      return (...args: any[]) => {
        // Call original console method
        original(...args);

        // Capture log entry
        const entry: LogEntry = {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          level,
          message: args
            .map((arg) => {
              if (typeof arg === "object") {
                try {
                  return JSON.stringify(arg, null, 2);
                } catch (e) {
                  return String(arg);
                }
              }
              return String(arg);
            })
            .join(" "),
          args,
        };

        this.addLog(entry);
      };
    };

    console.log = captureLog("log", this.originalConsole.log);
    console.info = captureLog("info", this.originalConsole.info);
    console.warn = captureLog("warn", this.originalConsole.warn);
    console.error = captureLog("error", this.originalConsole.error);

    console.log("[ConsoleLogger] Started capturing logs");
  }

  /**
   * Stop capturing console output
   */
  stop() {
    console.log = this.originalConsole.log;
    console.info = this.originalConsole.info;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;

    this.originalConsole.log("[ConsoleLogger] Stopped capturing logs");
  }

  /**
   * Add log entry and notify listeners
   */
  private addLog(entry: LogEntry) {
    this.logs.push(entry);

    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Get all captured logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear all logs
   */
  clear() {
    this.logs = [];
    this.notifyListeners();
  }

  /**
   * Subscribe to log updates
   */
  subscribe(callback: (logs: LogEntry[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of log changes
   */
  private notifyListeners() {
    const logs = this.getLogs();
    this.listeners.forEach((callback) => callback(logs));
  }

  /**
   * Export logs as text
   */
  exportAsText(): string {
    return this.logs
      .map((log) => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        const level = log.level.toUpperCase().padEnd(5);
        return `[${time}] ${level} ${log.message}`;
      })
      .join("\n");
  }

  /**
   * Export logs as JSON
   */
  exportAsJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Singleton instance
export const consoleLogger = new ConsoleLogger();

/**
 * Initialize console logging (call once at app startup)
 */
export function initConsoleLogger() {
  consoleLogger.start();
}

/**
 * Get console logger instance
 */
export function getConsoleLogger() {
  return consoleLogger;
}

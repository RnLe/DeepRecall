/**
 * Connection Status Indicator
 *
 * Platform-agnostic component displaying system connection status.
 * Shows 4 possible states with appropriate icons and tooltips:
 *
 * 1. synced (green) - All systems operational
 * 2. syncing (yellow) - Connected but sync in progress
 * 3. offline (red) - No internet connection
 * 4. server-down (red) - Internet OK but server unreachable
 */

import { Check, Loader2, WifiOff, ServerOff } from "lucide-react";
import type { OverallConnectionStatus } from "@deeprecall/data/stores";

export interface ConnectionStatusIndicatorProps {
  status: OverallConnectionStatus;
  className?: string;
  showLabel?: boolean; // Show text label next to icon
}

const statusConfig = {
  synced: {
    icon: Check,
    label: "Synced",
    className: "text-green-600 dark:text-green-400",
    tooltip: "All systems operational",
  },
  syncing: {
    icon: Loader2,
    label: "Syncing",
    className: "text-yellow-600 dark:text-yellow-400 animate-spin",
    tooltip: "Syncing data...",
  },
  offline: {
    icon: WifiOff,
    label: "Offline",
    className: "text-red-600 dark:text-red-400",
    tooltip: "No internet connection",
  },
  "server-down": {
    icon: ServerOff,
    label: "Server Down",
    className: "text-red-600 dark:text-red-400",
    tooltip: "Server unreachable",
  },
} as const;

export function ConnectionStatusIndicator({
  status,
  className = "",
  showLabel = false,
}: ConnectionStatusIndicatorProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      title={config.tooltip}
    >
      <Icon className={`h-4 w-4 ${config.className}`} />
      {showLabel && (
        <span className={`text-sm ${config.className}`}>{config.label}</span>
      )}
    </div>
  );
}

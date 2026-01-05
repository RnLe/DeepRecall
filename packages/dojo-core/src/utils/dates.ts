/**
 * Date and time utilities
 */

// =============================================================================
// Date Formatting
// =============================================================================

/**
 * Get current ISO datetime string
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Get current date as ISO date string (YYYY-MM-DD)
 */
export function todayISO(): string {
  return new Date().toISOString().split("T")[0]!;
}

/**
 * Parse a date string to Date object
 */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

/**
 * Format a date for display (e.g., "Dec 4, 2024")
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a date and time for display (e.g., "Dec 4, 2024 at 2:30 PM")
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// =============================================================================
// Duration Formatting
// =============================================================================

/**
 * Format seconds as a human-readable duration
 * e.g., 125 → "2m 5s", 3665 → "1h 1m"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
}

/**
 * Format minutes as a human-readable duration
 * e.g., 90 → "1h 30m", 45 → "45m"
 */
export function formatMinutes(minutes: number): string {
  return formatDuration(minutes * 60);
}

// =============================================================================
// Date Calculations
// =============================================================================

/**
 * Get the start of today (midnight)
 */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of today (23:59:59.999)
 */
export function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get the start of the current week (Sunday)
 */
export function startOfWeek(): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of the current week (Saturday)
 */
export function endOfWeek(): Date {
  const d = new Date();
  d.setDate(d.getDate() + (6 - d.getDay()));
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Get the difference in days between two dates
 */
export function diffDays(date1: Date, date2: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((date2.getTime() - date1.getTime()) / MS_PER_DAY);
}

/**
 * Check if a date is today
 */
export function isToday(date: Date | string): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date | string): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.getTime() < Date.now();
}

/**
 * Check if two dates are on the same day
 */
export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === "string" ? new Date(date1) : date1;
  const d2 = typeof date2 === "string" ? new Date(date2) : date2;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

// =============================================================================
// Streak Calculation
// =============================================================================

/**
 * Calculate consecutive days streak
 * @param practiceDates - Array of ISO date strings (sorted newest first)
 */
export function calculateStreak(practiceDates: string[]): number {
  if (practiceDates.length === 0) return 0;

  // Sort by date descending
  const sorted = [...practiceDates].sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  // Check if the most recent is today or yesterday
  const mostRecent = new Date(sorted[0]!);
  const today = startOfToday();
  const yesterday = addDays(today, -1);

  if (mostRecent < yesterday) {
    // Streak is broken
    return 0;
  }

  // Count consecutive days
  let streak = 1;
  let currentDate = mostRecent;

  for (let i = 1; i < sorted.length; i++) {
    const prevDate = new Date(sorted[i]!);
    const expectedDate = addDays(currentDate, -1);

    if (isSameDay(prevDate, expectedDate)) {
      streak++;
      currentDate = prevDate;
    } else if (isSameDay(prevDate, currentDate)) {
      // Same day, continue
      continue;
    } else {
      // Gap in dates, streak ends
      break;
    }
  }

  return streak;
}

// timesToString.ts
// Small helper function to convert a date (float timestamp from time.time() from Python) to a string
// As of now:
// "X seconds ago", "X minutes ago", "X hours ago", "X days ago"
// "X weeks ago", "X months ago", "X years ago"

export const agoTimeToString = (
  timestamp: number,
  compactUnderDay: boolean = false
): string => {
  const now = Date.now() / 1000; // Convert to seconds
  const diff = now - timestamp;

  // compact mode: any interval under 1 day
  if (compactUnderDay && diff < 86400) {
    return "less than a day ago";
  }

  if (diff < 60) {
    return `${Math.floor(diff)} seconds ago`;
  } else if (diff < 3600) {
    return `${Math.floor(diff / 60)} minutes ago`;
  } else if (diff < 86400) {
    return `${Math.floor(diff / 3600)} hours ago`;
  } else if (diff < 604800) {
    return `${Math.floor(diff / 86400)} days ago`;
  } else if (diff < 2419200) {
    return `${Math.floor(diff / 604800)} weeks ago`;
  } else if (diff < 29030400) {
    return `${Math.floor(diff / 2419200)} months ago`;
  } else {
    return `${Math.floor(diff / 29030400)} years ago`;
  }
}

// Helper method to convert seconds to a string
// Format: "Xh Ym Zs" (e.g. "1h 2m 3s")
// If showDecimal is true, seconds are shown with one decimal point; otherwise, as an integer.
export const secondsToString = (seconds: number, showDecimal: boolean = false): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  let result = '';
  if (hours > 0) {
    result += `${hours}h `;
  }
  if (minutes > 0) {
    result += `${minutes}m `;
  }
  
  const secsStr = showDecimal ? secs.toFixed(1) : `${Math.floor(secs)}`;
  result += `${secsStr}s`;

  return result.trim();
}

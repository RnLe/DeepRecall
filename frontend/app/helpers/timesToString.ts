// timesToString.ts
// Small helper function to convert a date (float timestamp from time.time() from Python) to a string
// As of now:
// "X seconds ago", "X minutes ago", "X hours ago", "X days ago"
// "X weeks ago", "X months ago", "X years ago"

export const agoTimeToString = (timestamp: number): string => {
  const now = Date.now() / 1000; // Convert to seconds
  const diff = now - timestamp;

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
export const secondsToString = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  let result = '';
  if (hours > 0) {
    result += `${hours}h `;
  }
  if (minutes > 0) {
    result += `${minutes}m `;
  }
  if (secs > 0) {
    result += `${secs}s`;
  }
  
  return result.trim();
}

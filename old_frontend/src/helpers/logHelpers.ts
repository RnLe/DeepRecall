// logHelpers.ts

export const formatLogMessage = (log: any): string => {
  if (typeof log === "object" && log !== null && "status" in log && "message" in log) {
    switch (log.status) {
      case 'info':
        return `ℹ️ ${log.message}`;
      case 'success':
        return `✅ ${log.message}`;
      case 'error':
        return `❌ ${log.message}`;
      default:
        return log.message;
    }
  }
  return typeof log === "string" ? log : "";
};

export const getOrdinal = (day: number): string => {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

export const formatReadableDateTime = (ts: number): string => {
  if (ts <= 0) return "N/A";
  const date = new Date(ts * 1000);
  const day = date.getDate();
  const ordinal = day > 3 && day < 21 ? "th" : (["st", "nd", "rd"][((day % 10) - 1)] || "th");
  const month = date.toLocaleString('en-US', { month: 'long' });
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-US', { hour12: true });
  return `${month} ${day}${ordinal} ${year}, ${time}`;
};

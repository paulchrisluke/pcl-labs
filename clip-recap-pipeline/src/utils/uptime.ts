// Track worker start time for uptime calculation
const WORKER_START_TIME = Date.now();

/**
 * Calculate human-readable uptime duration
 */
export function calculateUptime(): string {
  const now = Date.now();
  const uptimeMs = now - WORKER_START_TIME;
  
  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

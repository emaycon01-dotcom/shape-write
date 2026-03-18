/**
 * Client-side rate limiting / abuse detection.
 * Tracks actions in sessionStorage and blocks if thresholds are exceeded.
 */

interface RateEntry {
  timestamps: number[];
}

const STORAGE_KEY = "bellarus_rate_limits";

function getEntries(): Record<string, RateEntry> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveEntries(entries: Record<string, RateEntry>) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/**
 * Record an action and check if rate limit is exceeded.
 * @returns true if BLOCKED (limit exceeded)
 */
export function checkRateLimit(
  action: string,
  maxCount: number,
  windowMs: number
): boolean {
  const entries = getEntries();
  const now = Date.now();

  if (!entries[action]) {
    entries[action] = { timestamps: [] };
  }

  // Clean old entries
  entries[action].timestamps = entries[action].timestamps.filter(
    (t) => now - t < windowMs
  );

  // Add current
  entries[action].timestamps.push(now);
  saveEntries(entries);

  return entries[action].timestamps.length > maxCount;
}

// Specific checks
export function checkPixAbuse(): boolean {
  // 5 PIX generations in 2 minutes
  return checkRateLimit("pix_qr", 5, 2 * 60 * 1000);
}

export function checkPreviewAbuse(): boolean {
  // 20 previews in 1 hour
  return checkRateLimit("preview_gen", 20, 60 * 60 * 1000);
}

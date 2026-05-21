type RateLimitEntry = { count: number; resetAt: number }

const store = new Map<string, RateLimitEntry>()

interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number
  /** Window size in seconds */
  windowSec: number
}

/**
 * Returns true if the request should be blocked (limit exceeded).
 * Uses IP as the key; falls back to "unknown" when header is absent.
 */
export function isRateLimited(ip: string, options: RateLimitOptions): boolean {
  const { limit, windowSec } = options
  const now = Date.now()
  const entry = store.get(ip)

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowSec * 1000 })
    return false
  }

  entry.count += 1
  if (entry.count > limit) return true

  return false
}

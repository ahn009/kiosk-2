// In-process sliding-window rate limiter (per key, e.g. client IP).
// Suitable for a single instance. For multi-instance deployments put the
// app behind a gateway limiter or swap this for a Redis-backed counter.
import { NextRequest, NextResponse } from "next/server";

const buckets = new Map<string, number[]>();

function now() {
  return Date.now();
}

function prune(key: string, windowMs: number): number[] {
  const cutoff = now() - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  buckets.set(key, hits);
  return hits;
}

export interface RateLimitResult {
  allowed: boolean;
  /** ms until the oldest hit leaves the window (0 when allowed) */
  retryAfterMs: number;
}

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): RateLimitResult {
  const hits = prune(key, windowMs);
  if (hits.length < max) {
    hits.push(now());
    buckets.set(key, hits);
    // Opportunistic memory hygiene.
    if (buckets.size > 10000) {
      for (const [k, v] of buckets) {
        if (v.length === 0 || v[v.length - 1] <= now() - windowMs) buckets.delete(k);
        if (buckets.size <= 8000) break;
      }
    }
    return { allowed: true, retryAfterMs: 0 };
  }
  const retryAfterMs = Math.max(0, hits[0] + windowMs - now());
  return { allowed: false, retryAfterMs };
}

/** Best-effort client IP: first X-Forwarded-For entry, else "unknown". */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0].trim();
    if (first) return first;
  }
  return "unknown";
}

/** 429 JSON response with Retry-After. */
export function rateLimited(retryAfterMs: number): NextResponse {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  const res = NextResponse.json(
    { error: "Too many requests — slow down" },
    { status: 429 },
  );
  res.headers.set("Retry-After", String(seconds));
  return res;
}

// Presets
export const LOGIN_LIMIT = { max: 5, windowMs: 60_000 }; // 5/min per IP
export const KIOSK_LIMIT = { max: 120, windowMs: 60_000 }; // 120/min per IP
export const STRICT_LIMIT = { max: 10, windowMs: 60_000 }; // 10/min per IP

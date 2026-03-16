import type { Context, Next } from "hono";
import type { AppContextEnv } from "../types";

/**
 * Simple sliding-window rate limiter using module-level Map.
 * Workers isolates persist across requests within the same instance,
 * so this catches sustained abuse from a single IP within one isolate.
 * Not globally coordinated — for stronger protection, use Cloudflare WAF rules.
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60; // per IP per window

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

// Periodic cleanup to avoid unbounded growth
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < WINDOW_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

export async function rateLimiter(c: Context<AppContextEnv>, next: Next) {
  const ip =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  cleanup();

  const now = Date.now();
  let entry = store.get(ip);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    store.set(ip, entry);
  } else {
    entry.count++;
  }

  c.header("X-RateLimit-Limit", String(MAX_REQUESTS));
  c.header("X-RateLimit-Remaining", String(Math.max(0, MAX_REQUESTS - entry.count)));

  if (entry.count > MAX_REQUESTS) {
    return c.json(
      { error: "rate_limited", message: "Too many requests. Please try again later." },
      429,
    );
  }

  await next();
}

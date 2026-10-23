/** Per-IP request budget: a KV counter per hashed IP per clock hour. */
import type { KvStore } from "../config";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current hour window ends. */
  retryAfter: number;
}

export interface RateLimiter {
  check(ip: string): Promise<RateLimitResult>;
}

export function createRateLimiter(kv: KvStore, limitPerHour: number, now: () => number = Date.now): RateLimiter {
  return {
    async check(ip) {
      const t = now();
      const hour = Math.floor(t / 3_600_000);
      const retryAfter = Math.max(1, Math.ceil(((hour + 1) * 3_600_000 - t) / 1000));
      const key = `rl:${await hashIp(ip)}:${hour}`;
      const count = Number((await kv.get(key)) ?? 0);
      if (count >= limitPerHour) return { allowed: false, remaining: 0, retryAfter };
      // KV is eventually consistent, so the count is approximate under bursts — enough for abuse protection.
      await kv.put(key, String(count + 1), { expirationTtl: Math.max(60, retryAfter + 60) });
      return { allowed: true, remaining: limitPerHour - count - 1, retryAfter };
    },
  };
}

/** IPs are never stored in clear text. */
async function hashIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`my-ai-persona:${ip}`));
  return [...new Uint8Array(digest).slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

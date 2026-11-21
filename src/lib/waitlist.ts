import { createHmac } from "node:crypto";
import { z } from "zod";

export const signupSchema = z.object({
  email: z.email().max(254).transform((value) => value.trim().toLowerCase()),
  launchConsent: z.literal(true),
  marketingConsent: z.boolean(),
  company: z.string().max(100),
}).strict();

export const SUCCESS_MESSAGE = "You're on the list. We'll be in touch when Seila launches.";
export const RATE_LIMIT = 8;
export const WINDOW_MS = 15 * 60 * 1000;

export function rateBucket(ip: string, now: Date, secret: string) {
  const windowStart = Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS;
  const bucketKey = createHmac("sha256", secret)
    .update(`${windowStart}:${ip}`)
    .digest("hex");
  return {
    bucketKey,
    expiresAt: new Date(windowStart + WINDOW_MS),
  };
}

export function requestIp(request: Request): string | null {
  const header = process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for")
    : request.headers.get("x-forwarded-for");
  const first = header?.split(",", 1)[0]?.trim();
  return first && first.length <= 64 ? first : null;
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

import { getPool } from "@/lib/db";
import { RATE_LIMIT, SUCCESS_MESSAGE, rateBucket, requestIp, sameOrigin, signupSchema } from "@/lib/waitlist";

export const runtime = "nodejs";

const jsonHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ message: "This request could not be verified." }, { status: 403, headers: jsonHeaders });
  }
  if (Number(request.headers.get("content-length") || 0) > 2048) {
    return Response.json({ message: "The form response is too large." }, { status: 413, headers: jsonHeaders });
  }

  let payload: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 2048) {
      return Response.json({ message: "The form response is too large." }, { status: 413, headers: jsonHeaders });
    }
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ message: "Enter a valid email and try again." }, { status: 400, headers: jsonHeaders });
  }
  const result = signupSchema.safeParse(payload);
  if (!result.success) {
    return Response.json({ message: "Enter a valid email and agree to the launch notification." }, { status: 400, headers: jsonHeaders });
  }
  if (result.data.company) {
    return Response.json({ message: SUCCESS_MESSAGE }, { headers: jsonHeaders });
  }

  const ip = requestIp(request);
  const secret = process.env.WAITLIST_RATE_LIMIT_SECRET;
  if (!ip || !secret || secret.length < 32) {
    return Response.json({ message: "Signups are temporarily unavailable." }, { status: 503, headers: jsonHeaders });
  }
  const { bucketKey, expiresAt } = rateBucket(ip, new Date(), secret);
  const client = await Promise.resolve()
    .then(() => getPool().connect())
    .catch(() => null);
  if (!client) {
    return Response.json({ message: "We couldn't save your email. Please try again later." }, { status: 503, headers: jsonHeaders });
  }
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM public.waitlist_rate_limits WHERE expires_at < now()");
    const limited = await client.query<{ attempts: number }>(
      `INSERT INTO public.waitlist_rate_limits (bucket_key, attempts, expires_at)
       VALUES ($1, 1, $2)
       ON CONFLICT (bucket_key) DO UPDATE
       SET attempts = public.waitlist_rate_limits.attempts + 1
       RETURNING attempts`,
      [bucketKey, expiresAt],
    );
    if (limited.rows[0].attempts > RATE_LIMIT) {
      await client.query("COMMIT");
      return Response.json(
        { message: "Too many attempts. Please try again in a few minutes." },
        { status: 429, headers: { ...jsonHeaders, "Retry-After": "900" } },
      );
    }
    await client.query(
      `INSERT INTO public.waitlist_signups
         (email, launch_notification_consent_at, marketing_consent_at)
       VALUES ($1, now(), CASE WHEN $2 THEN now() ELSE NULL END)
       ON CONFLICT DO NOTHING`,
      [result.data.email, result.data.marketingConsent],
    );
    await client.query("COMMIT");
    return Response.json({ message: SUCCESS_MESSAGE }, { headers: jsonHeaders });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";
    console.error("Waitlist signup database failure", { code });
    return Response.json({ message: "We couldn't save your email. Please try again later." }, { status: 503, headers: jsonHeaders });
  } finally {
    client.release();
  }
}

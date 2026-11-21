import { beforeEach, describe, expect, it, vi } from "vitest";

const { connect } = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock("@/lib/db", () => ({ getPool: () => ({ connect }) }));
import { POST } from "./route";

function request(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost:3000/api/waitlist", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      host: "localhost:3000",
      "content-type": "application/json",
      "x-forwarded-for": "192.0.2.10",
    },
    body: JSON.stringify({
      email: "person@example.com",
      launchConsent: true,
      marketingConsent: false,
      company: "",
      ...overrides,
    }),
  });
}

describe("POST /api/waitlist", () => {
  const query = vi.fn();
  const release = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WAITLIST_RATE_LIMIT_SECRET = "a".repeat(64);
    delete process.env.VERCEL;
    query.mockImplementation(async (sql: string) =>
      sql.includes("RETURNING attempts") ? { rows: [{ attempts: 1 }] } : { rows: [], rowCount: 1 },
    );
    connect.mockResolvedValue({ query, release });
  });

  it("rejects invalid input before connecting to the database", async () => {
    const response = await POST(request({ email: "not-an-email" }));
    expect(response.status).toBe(400);
    expect(connect).not.toHaveBeenCalled();
  });

  it("silently accepts a filled honeypot without a database write", async () => {
    const response = await POST(request({ company: "bot" }));
    expect(response.status).toBe(200);
    expect(connect).not.toHaveBeenCalled();
  });

  it("stores a valid signup and commits", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO public.waitlist_signups"))).toBe(true);
    expect(query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
    expect(release).toHaveBeenCalledOnce();
  });

  it("returns the same response for an existing email", async () => {
    const first = await POST(request());
    query.mockImplementation(async (sql: string) =>
      sql.includes("RETURNING attempts") ? { rows: [{ attempts: 2 }] } : { rows: [], rowCount: 0 },
    );
    const repeated = await POST(request());
    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toEqual(await first.json());
  });

  it("rate limits before inserting a signup", async () => {
    query.mockImplementation(async (sql: string) =>
      sql.includes("RETURNING attempts") ? { rows: [{ attempts: 9 }] } : { rows: [] },
    );
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO public.waitlist_signups"))).toBe(false);
  });
});

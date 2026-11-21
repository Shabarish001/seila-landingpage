import { describe, expect, it } from "vitest";
import { rateBucket, sameOrigin, signupSchema } from "./waitlist";

describe("waitlist validation", () => {
  it("accepts a valid email with separate optional marketing consent", () => {
    const result = signupSchema.safeParse({
      email: "Person@Example.COM",
      launchConsent: true,
      marketingConsent: false,
      company: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("person@example.com");
  });

  it("rejects bad email and absent launch consent", () => {
    expect(signupSchema.safeParse({ email: "bad", launchConsent: true, marketingConsent: false, company: "" }).success).toBe(false);
    expect(signupSchema.safeParse({ email: "valid@example.com", launchConsent: false, marketingConsent: false, company: "" }).success).toBe(false);
  });

  it("uses stable, secret-dependent rate buckets within a window", () => {
    const first = rateBucket("192.0.2.1", new Date("2026-11-21T12:01:00Z"), "a".repeat(64));
    const second = rateBucket("192.0.2.1", new Date("2026-11-21T12:10:00Z"), "a".repeat(64));
    const other = rateBucket("192.0.2.2", new Date("2026-11-21T12:01:00Z"), "a".repeat(64));
    expect(first.bucketKey).toBe(second.bucketKey);
    expect(first.bucketKey).not.toBe(other.bucketKey);
    expect(first.bucketKey).not.toContain("192.0.2.1");
  });

  it("requires the request origin to match the host", () => {
    const valid = new Request("https://seila.example/api/waitlist", {
      headers: { origin: "https://seila.example", host: "seila.example" },
    });
    const invalid = new Request("https://seila.example/api/waitlist", {
      headers: { origin: "https://outside.example", host: "seila.example" },
    });
    expect(sameOrigin(valid)).toBe(true);
    expect(sameOrigin(invalid)).toBe(false);
  });
});

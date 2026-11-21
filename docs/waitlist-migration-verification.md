# Waitlist migration verification

Applied with explicit owner approval on 21 November 2026 to the existing
Supabase project `ehrpbxjscqhhpwjylwgx`, using verified TLS and hostname checks.

Migration: `sql/20261121_create_waitlist.sql`.
SHA-256: `fcd83c94760fcf5afc8d5fd38d1f223ded30a6b0d0d72ba5221aa42be846449b`.
Its BEGIN/COMMIT transaction created only `public.waitlist_signups` and
`public.waitlist_rate_limits`, their indexes, and their RLS/access settings.
Both tables have RLS enabled and no SELECT grants to `anon` or `authenticated`.
The email unique index uses `lower(btrim(email))`.

## Endpoint test

Tested the existing production build locally against the hosted database.
The first local server lacked outbound network access and returned a temporary
failure without storing a signup. Restarting the same build with network access
allowed the complete test to pass; no application changes were needed.

Test email:
`seila-waitlist-test-3ae3a574-5166-4a7d-b6f2-9a83484a44e2@example.com`.
This reserved example.com address was synthetic test data. No email was sent.

- First signup: HTTP 200, exactly one database row, creation and launch consent
  timestamps present, marketing consent NULL.
- Uppercase duplicate: HTTP 200 with the identical confirmation message;
  exactly one row remained.
- Rate limiting: first eight requests HTTP 200, ninth HTTP 429.
- Cleanup: deleted only the unique test signup and its test rate counter.
  Final waitlist signup count: 0. Final rate counter count: 0.

## Existing data

Compared exact row counts and sorted row-content hashes before and after for
all 42 pre-existing tables. All matched. Only the two approved tables were added.
`public.affiliate_products` retains all 422 rows with matching contents.

Work remained on `feature/seila-waitlist`. No UI changes, remote push, or Vercel
deployment were performed. Logo and privacy contact setup remain independent
launch tasks described in the main README.

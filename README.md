# Seila coming soon

A mobile-first Next.js landing page with a private Supabase PostgreSQL waitlist.
The existing `public.affiliate_products` catalogue is not queried or changed by this app.

## Local development

1. Use Node.js 20.9 or newer and run `npm install`.
2. Keep the existing Supabase connection in ignored `.env`. Add a random
   `WAITLIST_RATE_LIMIT_SECRET` of at least 32 characters. See `.env.example`
   for variable names. Download the project's database CA certificate from
   Supabase Database Settings → SSL Configuration and set
   `SUPABASE_DB_CA_FILE` to its local path. Never commit `.env` or the local CA file.
3. Run `npm run dev` and open `http://localhost:3000`.
4. Run `npm test`, `npm run typecheck`, and `npm run build`.

The form uses a server-only PostgreSQL connection. A dry local build does not
create tables or submit signups. Until the waitlist migration is approved and
applied, valid submissions return a temporary error.

## Database migration — approval required

`sql/20261121_create_waitlist.sql` creates two related tables in `public`:

- `waitlist_signups` stores email and separate launch/marketing consent times.
  A unique index on `lower(btrim(email))` prevents case-insensitive duplicates.
- `waitlist_rate_limits` stores short-lived keyed request counters for the
  serverless signup endpoint. It never stores plain IP addresses.

Both have RLS enabled and no grants to `anon` or `authenticated`. The SQL
touches no existing table. Confirm the target project and take a backup before
applying the reviewed migration. Apply it only after the owner approves this
specific hosted change. If the migration fails, its transaction rolls back.
The signup endpoint inserts with `ON CONFLICT DO NOTHING`, so repeat emails get
the same response as new emails.

## Vercel deployment — approval required

Create a Vercel project from this repository only after deployment approval.
Set these environment variables in the Vercel project, using the **existing**
Supabase project:

- `DATABASE_URL`: the existing project's PostgreSQL pooled connection string.
  It is used only in the Node.js route handler and must never have a
  `NEXT_PUBLIC_` prefix.
- `WAITLIST_RATE_LIMIT_SECRET`: a random secret of at least 32 characters.
  Keep it stable across deployments so rate buckets behave consistently.
- `SUPABASE_DB_CA_CERT`: the database CA certificate PEM from Supabase's
  SSL Configuration panel. The Node client verifies TLS against this CA.
- `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`: the real Seila privacy contact address.

Vercel detects Next.js and runs `npm run build`. Configure a WAF rate rule for
`POST /api/waitlist` as an extra outer layer of abuse protection. The endpoint
already has a database-backed limit of eight attempts per client per 15 minutes,
a hidden honeypot, request size cap, origin check, and generic duplicate response.
The service reads Vercel's forwarded client IP only to derive a keyed rate token.

Before launch, add the supplied airplane-and-hanger logo to the brand slot in
`src/app/page.tsx` and `src/app/privacy/page.tsx`, set the real privacy contact,
review the privacy notice with the site's owner, apply the migration with approval,
and test a real signup plus a case-insensitive duplicate in the target environment.
No code in this repository deploys itself or pushes to a remote.

## Visual assets

`public/images/seila-city-hero.png` and `public/images/seila-journey.png` were
generated for this project with the built-in image tool. Prompt direction: an
editorial traveler and blush-scarf suitcase overlooking a coastal city; and a
thoughtfully packed blush-and-charcoal travel wardrobe. Both images have no
embedded brand text or logos. The page layout takes inspiration from the user's
supplied `Archivo/index.html` reference while remaining a focused waitlist page.

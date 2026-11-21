# VESTRA — Awin Product Catalogue & Supabase Integration
**Status:** Proposed implementation specification — review and plan before coding  
**Input dataset:** `datafeed_3143018.csv` (Awin Create-a-Feed export, 21 November 2026)  
**Audience:** Codex / engineering team

## 1. Product objective
Build a maintainable affiliate-product discovery foundation for Vestra AI Travel Capsule. Import an authorised Awin fashion feed into Supabase Postgres, display searchable product cards with accurate images/prices/retailer attribution, and direct users to retailer sites via Awin affiliate deep links. In a later phase, match products against clothing attributes extracted from uploaded inspiration images.

**Success scenario:** A visitor browses a curated Vestra product gallery, selects a garment, and clicks **Shop at retailer**; the link opens the validated `aw_deep_link`. Later, a visitor uploads an inspiration photo, receives a structured garment breakdown, and sees relevant catalogue matches. Vestra does not process the retailer purchase.

## 2. Confirmed source data (inspect the actual CSV; do not rely on this summary alone)
The provided CSV contains **422 rows** and these 21 headers:
`aw_deep_link`, `product_name`, `aw_product_id`, `merchant_product_id`, `merchant_image_url`, `description`, `merchant_category`, `search_price`, `merchant_name`, `merchant_id`, `category_name`, `category_id`, `aw_image_url`, `currency`, `store_price`, `delivery_cost`, `merchant_deep_link`, `language`, `last_updated`, `display_price`, `data_feed_id`.

Observed sample: advertiser **Needs No Label**, `merchant_id=78586`, `data_feed_id=101189`, `currency=GBP`. The CSV includes size variants in product names (e.g. `... | Size: 18`); `last_updated` may be empty. **Do not assume every row is a distinct style, every image resolves, or the catalogue is authorised for public commercial reuse.** Calculate full-file quality statistics during discovery.

## 3. Non-negotiable guardrails
1. **Plan first.** Do not modify application code, database schema, or remote resources during the initial discovery/planning phase. Present findings, risks, design decisions and a proposed task breakdown for approval.
2. **Preserve existing stack.** Inspect `package.json`, Prisma schema/migrations, Supabase integration, existing UI, authentication, environment conventions and tests. Use Prisma only if it fits the existing architecture; do not introduce a second ORM or replace a working data layer without justification.
3. **No destructive operations.** No `prisma db push --accept-data-loss`, `migrate reset`, database recreation, broad table truncation, or production import without explicit approval. Prefer versioned migrations and idempotent upserts.
4. **No remote Git push.** Commit completed logical phases **locally** with clear messages; never push to GitHub or any remote unless explicitly authorised. Database migration/import to hosted Supabase is a separate action requiring explicit approval after staging validation and a dry run.
5. **Protect secrets.** Never print, commit or expose Supabase service-role keys, database passwords, Awin feed keys, or signed/private feed URLs. Server-side only; redacted logs. Do not include sensitive values in screenshots or test fixtures.
6. **Licence gate.** Downloadability does not establish redistribution rights. Before publicly displaying product images/links or importing a commercial catalogue to production, confirm publisher/advertiser approval, relevant programme terms, rights to cache/transform/display images and data, feed refresh/deletion obligations, affiliate disclosures and the registered Vestra property. Record evidence and unresolved issues. Development fixtures may use a minimal synthetic dataset until rights are cleared.
7. **No scraping.** Use supplied CSV and later authorised feed/API retrieval only. Do not crawl Awin dashboards or merchant sites.
8. **No fake products.** Display only sourced items, distinguish verified products from inferred matches, and do not claim live stock/prices without verification.

## 4. Architecture to evaluate
- **Feed ingestion:** CLI/job reads a local CSV or a securely configured authorised Awin feed URL, validates headers and types, normalises records, and produces an import report. Prefer a streaming parser for future large feeds.
- **Database:** Supabase Postgres; Prisma schema and migration if already used. Separate affiliate feed source, canonical product/style, and purchasable variant/offer concepts where practical. Preserve the source record ID, advertiser/feed ID, currency, original name, image URL, deep link, category, last-seen time and import batch provenance.
- **Public query API:** Server-side product browsing, filters, pagination, product details, and retailer redirect. Enforce appropriate access controls; never expose privileged credentials.
- **UI:** Responsive gallery with image, title, merchant, GBP price, optional size, category and clear affiliate disclosure. Image loading/fallbacks and empty/error states.
- **Future AI:** Vision model returns structured garment attributes. Search indexed product descriptions/categories first; optional embeddings/vector ranking after baseline retrieval is measured. Do not introduce a complex multi-agent architecture for MVP.

## 5. Suggested logical data model (adapt to repository)
- `AffiliateSource`: `id`, `network` (`AWIN`), `advertiserId`, `advertiserName`, `feedId`, `feedFormat`, `permissionStatus`, `termsReviewedAt`, `enabled`, `lastSuccessfulSyncAt`.
- `AffiliateProduct`: internal ID, `sourceId`, `sourceProductId` (`aw_product_id`), `merchantProductId`, `title`, `description`, `merchantCategory`, `categoryName`, `currency`, `priceDecimal`, `deliveryCostDecimal?`, `merchantImageUrl?`, `awinImageUrl?`, `affiliateUrl`, `merchantUrl?`, `lastSeenAt`, `active`, `rawAttributes` (restricted JSON if needed).
- `ImportBatch`: source, filename/hash, start/end timestamps, totals, created/updated/unchanged/rejected/deactivated counts, error summary, dry-run flag.
- Optional `ProductGroup`/variant relation after inspecting size patterns. **Do not collapse variants solely by stripping `| Size:`**; inspect IDs, URL paths, colour, price and other distinguishing fields to avoid incorrect merges.

Recommended uniqueness: `(sourceId, sourceProductId)`; confirm whether IDs remain stable across feed refreshes. Monetary values must use Decimal, not floating point. Store `GBP` as currency and never label as EUR without a sourced FX conversion. Treat `last_updated` empty as unknown, not current.

## 6. Import design
1. Inspect and report CSV encoding, delimiter, headers, row counts, blank/invalid values, URL schemes/domains, duplicate IDs, price/currency distributions, category coverage and image URL patterns. Avoid fetching every external image during initial analysis.
2. Define schema mapping and validation. Reject invalid or unsafe redirect URLs; allowlist expected Awin tracking hosts for outbound affiliate links; guard against CSV formula injection in any re-export.
3. Support `--dry-run` (default), `--file`, `--source`, and an explicit `--apply` mode. Dry run must not write to the DB.
4. Use chunked transactional upserts; retain per-row provenance and import metrics; do not delete unrelated products. For later full-feed syncs, mark missing records inactive **only when the feed is known complete and the sync succeeds**, never after a partial/failed feed.
5. Make rerunning the same CSV idempotent. Preserve stable identifiers and avoid duplicate product cards.
6. Provide an optional refresh mechanism with rate limits, timeouts, retries and backoff. Treat feed URL/credentials as secrets. Document feed freshness and advertiser revocation handling.
7. For the first hosted Supabase import, require explicit user approval after a successful local/staging dry run, migration review and rollback plan.

## 7. MVP user stories and acceptance criteria
**US1 — Import:** Given the supplied CSV, an engineer can run a documented dry run and see row totals and validation errors. On approved staging apply, rows are imported without duplicates; repeating the import yields no additional records.

**US2 — Browse:** Users can browse paginated products, search titles/descriptions and filter by category, merchant and price. All displayed prices show GBP; loading/empty/error states work.

**US3 — Variants:** The gallery does not misleadingly show dozens of near-identical size records as distinct styles. Variant grouping must be conservative and testable; user can access the corresponding valid variant link.

**US4 — Redirect:** Clicking a product opens its verified Awin affiliate deep link, not an untrusted arbitrary URL. The link is labelled as an external retailer purchase. Any analytics avoid logging personal data or secret keys.

**US5 — Trust/compliance:** Products from sources not cleared for public display are hidden in production. Include affiliate disclosure and retailer attribution. Stale or withdrawn items are removed from public results according to source terms.

**US6 — AI-ready interface:** Define an internal product-search contract accepting structured garment attributes, but do not build image-upload AI matching in the first implementation phase unless separately approved.

## 8. Testing and quality gates
- **Unit:** CSV parsing, required fields, price Decimal conversion, null handling, category mapping, safe URL validation, duplicate IDs, variant grouping, permissions filtering.
- **Integration:** Prisma migration on isolated test DB, upsert/idempotency, partial feed failure, source isolation, disabled source exclusion, pagination/filtering and redirect safety.
- **UI/E2E:** Gallery rendering, broken image fallback, GBP formatting, filters, empty/error states, outbound link target/rel, mobile layout and accessibility.
- **Security:** No service role key in client bundle, row-level policies or server-only data access as appropriate, no open redirects, no leaked feed URLs, protected import endpoint/CLI.
- **Operations:** Dry-run report, repeat import, batch audit trail, failure recovery, non-destructive rollback instructions and staging smoke test.
- **Validation:** Run existing project lint/typecheck/tests/build plus new tests. Report exact commands and outcomes; do not claim passing tests without running them.

## 9. Phased Codex task loading
### Phase 0 — Discovery and architecture proposal (NO CODE CHANGES)
Read repository instructions/`AGENTS.md`, current code, Prisma/Supabase setup and attached CSV. Produce `docs/awin-integration-plan.md` (or report in chat if writing a file is not yet authorised) with: existing architecture, schema proposal, source-data audit, permission gaps, risks, migration strategy, test plan, effort estimate, decisions needing approval. **STOP and request approval.**

### Phase 1 — Schema + importer (LOCAL/STAGING ONLY)
After approval: implement versioned migration, importer with dry-run default, validation, upsert, import reporting and tests. Commit locally. Do not apply to hosted production.

### Phase 2 — Catalogue API + gallery
Build paginated server-side API, filters, safe redirects, affiliate disclosure, responsive gallery and tests. Use permitted test fixtures until compliance approval. Commit locally.

### Phase 3 — Approved Supabase deployment and data load
Only after explicit user approval: review migration and backup/rollback; apply migration to the specified Supabase environment; perform dry run then authorised import; smoke-test queries, access controls and links; document row counts and errors. Commit any code/docs locally. **No Git remote push.**

### Phase 4 — AI image-to-product matching (separate approval)
Build image upload/privacy controls, vision extraction, structured garment query, similarity ranking, evaluation set and result labelling. Measure precision, latency and cost. Commit locally.

## 10. Codex's immediate task (copy/paste)
> Read `Vestra_Awin_Supabase_Codex_Spec.md` and inspect this repository and the supplied `datafeed_3143018.csv`. Execute **Phase 0 only**. Do not write application code, run migrations, import to Supabase, access production data, or push Git commits/remotes. Audit the actual CSV, inspect the existing Prisma/Supabase setup, propose a minimal compatible schema and importer, assess permissions and security gates, outline tests, and return a phased implementation plan with precise files to change and commands to run. Identify open decisions and STOP for my approval before coding. For subsequent approved phases, commit each logical feature locally, never push to a remote without explicit authorisation, and never modify hosted Supabase without a separate explicit go-ahead.

## 11. Decisions to request from owner
1. Which repository and environment (local, staging, production) are in scope?
2. Is Prisma already installed and in active use?
3. Has Needs No Label approved the publisher/Vestra property and does its programme allow caching, product image display, and comparison-style product discovery?
4. Should the first UI be an internal preview or a public catalogue?
5. When ready, which Supabase project is the authorised import target? (Never paste credentials into chat.)

**Definition of done for this specification:** Codex produces a reviewable plan first; no code or database mutation happens until the corresponding phase is explicitly approved.

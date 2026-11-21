-- Review and apply only after explicit approval for this hosted Supabase project.
-- The existing affiliate_products table and all other existing relations are untouched.
BEGIN;

CREATE TABLE public.waitlist_signups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL CHECK (length(btrim(email)) BETWEEN 3 AND 254),
    created_at timestamptz NOT NULL DEFAULT now(),
    launch_notification_consent_at timestamptz NOT NULL,
    marketing_consent_at timestamptz
);

CREATE UNIQUE INDEX waitlist_signups_email_ci_key
    ON public.waitlist_signups (lower(btrim(email)));

CREATE TABLE public.waitlist_rate_limits (
    bucket_key char(64) PRIMARY KEY,
    attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
    expires_at timestamptz NOT NULL
);

CREATE INDEX waitlist_rate_limits_expires_at_idx
    ON public.waitlist_rate_limits (expires_at);

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waitlist_signups FROM anon, authenticated;
REVOKE ALL ON public.waitlist_rate_limits FROM anon, authenticated;

COMMIT;

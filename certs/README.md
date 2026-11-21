# Supabase public trust anchor

`supabase-ca.crt` is a public CA certificate, not a credential or private key.
Retrieved over verified HTTPS on 21 November 2026 from the URL configured by
[Supabase's official dashboard source](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json):

https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

SHA-256 certificate fingerprint:
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`

Subject and issuer: Supabase Root 2021 CA. Expires 26 April 2031.
The pooler sends a wildcard leaf and intermediate issued by this root; Node's
bundled roots and this machine's Windows system roots do not trust it by default.

The app verifies both the chain and pooler hostname with `rejectUnauthorized: true`.
Next.js explicitly includes this file in the signup function's deployment bundle.
No trust-store changes, runtime download, or separate Vercel CA variable are needed.
When Supabase rotates the CA, obtain its replacement from the official dashboard
source over verified HTTPS, review the fingerprint and expiry, test read-only,
and commit the public replacement. Do not trust a root solely because a server
sent it. Environment overrides are available for managed certificate rotation.

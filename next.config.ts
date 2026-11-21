import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/waitlist": ["./certs/supabase-ca.crt"],
  },
};

export default nextConfig;

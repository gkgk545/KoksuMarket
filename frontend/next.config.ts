import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  // Django proxy rewrites removed - now using Supabase directly
};

export default nextConfig;

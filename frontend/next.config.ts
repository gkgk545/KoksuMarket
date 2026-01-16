import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
    // We need the root backend URL, so we strip '/api' if it exists to handle root endpoints like /admin
    const backendUrl = apiUrl.replace(/\/api$/, "");

    return [
      {
        source: "/admin/:path*/",
        destination: `${backendUrl}/admin/:path*/`,
      },
      {
        source: "/teacher/:path*/",
        destination: `${backendUrl}/teacher/:path*/`,
      },
      {
        source: "/ticket/:path*/",
        destination: `${backendUrl}/ticket/:path*/`,
      },
      {
        source: "/static/:path*",
        destination: `${backendUrl}/static/:path*`,
      },
      {
        source: "/media/:path*",
        destination: `${backendUrl}/media/:path*`,
      },
      {
        source: "/api/:path*/",
        destination: `${backendUrl}/api/:path*/`,
      },
    ];
  },
};


export default nextConfig;

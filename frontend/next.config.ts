import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  async rewrites() {
    return [
      {
        source: "/admin/:path*/",
        destination: "http://127.0.0.1:8000/admin/:path*/",
      },
      {
        source: "/teacher/:path*/",
        destination: "http://127.0.0.1:8000/teacher/:path*/",
      },
      {
        source: "/ticket/:path*/",
        destination: "http://127.0.0.1:8000/ticket/:path*/",
      },
      {
        source: "/static/:path*",
        destination: "http://127.0.0.1:8000/static/:path*",
      },
      {
        source: "/media/:path*",
        destination: "http://127.0.0.1:8000/media/:path*",
      },
      {
        source: "/api/:path*/",
        destination: "http://127.0.0.1:8000/api/:path*/",
      },
    ];
  },
};


export default nextConfig;

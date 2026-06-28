import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // Static export for production (Docker). Dev runs as normal Next.js server.
  ...(isDev ? {} : { output: "export" as const }),
  // Required for static export — default image optimizer needs a server
  images: { unoptimized: true },
  // Dev proxy: forward /api/* to FastAPI backend running on port 8000
  // Only applies during `next dev` (rewrites are unsupported in static export)
  ...(isDev
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: "http://localhost:8000/api/:path*",
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;

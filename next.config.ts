import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Route handlers read these at runtime with fs, so Vercel must ship them.
  outputFileTracingIncludes: {
    "/api/search": ["./src/data/vectors/**", "./src/data/guide.md"],
    "/api/ask": ["./src/data/vectors/**", "./src/data/guide.md"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

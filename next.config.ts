import type { NextConfig } from "next";

// transformers.js loads onnxruntime-node with a dynamic require, so file tracing misses it.
// Only the Linux x64 runtime: Vercel functions run there, and the other builds add ~220 MB.
const ONNX = [
  "./node_modules/onnxruntime-node/package.json",
  "./node_modules/onnxruntime-node/dist/**",
  "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**",
  "./node_modules/onnxruntime-common/**",
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  // onnxruntime-node is a native module; load it from node_modules at runtime.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
  partialPrefetching: true,
  // Route handlers read these at runtime with fs, so Vercel must ship them.
  outputFileTracingIncludes: {
    "/api/search": ["./src/data/vectors/**", "./src/data/guide.md", "./models/**", ...ONNX],
    "/api/ask": ["./src/data/vectors/**", "./src/data/guide.md", "./models/**", ...ONNX],
  },
  // transformers.js pulls in sharp for image models. This app only embeds text.
  outputFileTracingExcludes: {
    "/api/search": ["./node_modules/sharp/**", "./node_modules/@img/**"],
    "/api/ask": ["./node_modules/sharp/**", "./node_modules/@img/**"],
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

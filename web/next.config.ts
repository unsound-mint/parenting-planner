import type { NextConfig } from "next";

const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8091";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  // Caddy compresses in production. Next's own gzip also buffers the /api/.../live
  // event stream when it is proxied in dev, so events would arrive minutes late.
  compress: false,
  // The week card image reads its fonts from disk (see its route handler).
  outputFileTracingIncludes: { "/family/[memberId]/week-card": ["./assets/share-card/**"] },
  cacheComponents: true,
  partialPrefetching: true,
  // In production Caddy sends /api to the Go service before it reaches Next;
  // this rewrite makes the same paths work in local dev.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
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

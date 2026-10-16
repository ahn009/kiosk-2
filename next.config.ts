import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Fail the build on TypeScript errors — type safety is a release gate.
  typescript: {
    ignoreBuildErrors: false,
  },
  // NOTE: src/instrumentation.ts validates typed configuration at server
  // boot (fail fast on missing secrets). Next 16 runs it automatically when
  // the file exists.
};

export default nextConfig;

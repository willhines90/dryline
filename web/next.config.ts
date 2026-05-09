import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow MapLibre's web workers + WebGL.
  experimental: {
    // Add experimental flags as needed.
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Compile TS source from the workspace MCP package directly so the route
  // handler can import @dryline/mcp/tools without a build step.
  transpilePackages: ["@dryline/mcp"],
  experimental: {
    // Add experimental flags as needed.
  },
  // The MCP package source uses TypeScript-ESM-style imports ending in `.js`
  // (e.g. `import "./tools/index.js"`). tsc with Bundler resolution maps
  // these to .ts; webpack does not by default. extensionAlias adds the same
  // mapping so the workspace import compiles in dev and in next build.
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
  // Baseline security headers. No CSP — the MapLibre popups use innerHTML
  // with inline styles and a strict CSP would break them. The headers
  // below catch the easy hits: clickjacking, MIME sniffing, referrer
  // leakage, opportunistic-TLS downgrade, and out-of-scope permissions.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

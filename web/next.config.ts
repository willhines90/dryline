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
};

export default nextConfig;

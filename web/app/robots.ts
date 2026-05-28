import type { MetadataRoute } from "next";

const SITE_URL = "https://dryline.org";

/**
 * Per Next.js App Router convention, this exports a robots.txt. Allow
 * everyone; surface the sitemap so search crawlers find both the
 * landing page and the methodology long-read without guessing.
 *
 * API routes are blocked because they return streaming SSE or JSON that
 * a crawler would waste budget on (and /api/investigate is rate-limited
 * besides — we don't want a bot tripping that bucket).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

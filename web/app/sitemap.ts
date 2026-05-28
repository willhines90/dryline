import type { MetadataRoute } from "next";

const SITE_URL = "https://dryline.org";

/**
 * Sitemap. Just the two indexable surfaces today — the landing app
 * and the methodology long-read. Crawl priority biases toward the
 * methodology page because it's the citation-heavy long-form content
 * Google actually likes to rank, while the landing page is mostly
 * an interactive map (less text for SEO).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/methodology`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
  ];
}

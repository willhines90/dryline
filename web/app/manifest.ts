import type { MetadataRoute } from "next";

// PWA manifest, served by Next at /manifest.webmanifest and auto-linked
// from <head>. Icons live in public/brand/favicon (the brand asset pack).
// theme_color is the brand slate; the in-app map/cards keep their own
// topographic palette.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dryline",
    short_name: "Dryline",
    description: "Follow the water at any Texas address — every claim cited.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#1E293B",
    icons: [
      {
        src: "/brand/favicon/android-chrome-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/favicon/android-chrome-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}

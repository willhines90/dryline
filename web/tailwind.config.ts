import type { Config } from "tailwindcss";

/**
 * Dryline aesthetic palette. Topographic, not civic-tech blue.
 * - Reservoir blues (deep, muted)
 * - Arid earth tones (sand, ochre, dust)
 * - High-contrast charcoal text on warm-paper background
 *
 * Tailwind extension only — keep core palette intact for shadcn compatibility.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Aesthetic anchors. shadcn semantic tokens (background, foreground,
        // primary, etc.) get layered on top via globals.css CSS variables.
        reservoir: {
          50: "#eef4f7",
          100: "#cfdde6",
          300: "#7ba0b4",
          500: "#2f5d75",
          700: "#1c3e51",
          900: "#0f2632",
        },
        arid: {
          50: "#faf6ee",
          100: "#efe5d0",
          300: "#d6b98a",
          500: "#a98248",
          700: "#75582d",
          900: "#3f2f17",
        },
      },
      fontFamily: {
        // Lean toward "quietly intelligent" — geometric sans as the default,
        // a serif accent for editorial moments.
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["ui-serif", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

/**
 * Dryline aesthetic — water-forward identity (per the Claude Design bundle).
 * - Aquifer / tide / river / spring / foam / kelp : the primary water family
 * - Ochre / terracotta / rust : accent only, the "dry side" of the dryline
 * - Glacier paper + abyssal ink for the page surfaces
 *
 * The legacy `reservoir-*` and `arid-*` tokens are kept as aliases (mapped
 * onto the new families) so existing components don't break during the
 * design pass; new code should reach for the named tokens below.
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
        // shadcn semantic — re-keyed to the design palette in globals.css
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // ---- Dryline named tokens (use these in new code) ----
        paper: {
          DEFAULT: "#eef2f3", // glacier
          deep: "#dde6e9",
          warm: "#e6eef0",    // artifact paper, slightly cooler than card
        },
        ink: {
          DEFAULT: "#07171f", // abyssal
          soft: "#15303b",
        },
        tideline: "#4a6c78",  // muted slate, our "muted"
        rule: {
          DEFAULT: "#c8d6da",
          soft: "#dde6e9",
        },

        // Water family — primary
        aquifer: {
          DEFAULT: "#0d3b6f", // deep ocean blue, marker live
          deep: "#061f3d",
        },
        tide: "#2566a8",
        river: "#4a8aa8",
        spring: "#9ec5cf",
        foam: "#d6e4e6",
        kelp: {
          DEFAULT: "#1f4d4a",
          soft: "#cad9d4",
        },

        // Arid family — accent only, the dry side of the dryline
        ochre: {
          DEFAULT: "#b58a52",
          deep: "#7a5a2c",
        },
        terracotta: "#a85a35",
        rust: "#b13a1f",

        // Drought scale — desaturated, cool→warm
        drought: {
          none: "#e6eef0",
          d0: "#cdd9b4",
          d1: "#cfb27a",
          d2: "#a85a35",
          d34: "#6f1d10",
        },

        // ---- Legacy aliases for unrefactored components ----
        // The old code used reservoir-{50,100,300,500,700,900} and
        // arid-{50,100,300,500,700,900}. Map them onto the new families so
        // pages keep rendering without a wholesale rename.
        reservoir: {
          50: "#d6e4e6",       // foam
          100: "#9ec5cf",      // spring
          300: "#4a8aa8",      // river
          500: "#2566a8",      // tide
          700: "#0d3b6f",      // aquifer
          900: "#061f3d",
        },
        arid: {
          50: "#eef2f3",       // glacier paper
          100: "#dde6e9",      // paper-deep
          300: "#9ec5cf",      // spring
          500: "#b58a52",      // ochre
          700: "#7a5a2c",      // ochre-deep
          900: "#15303b",
        },
      },
      fontFamily: {
        // Editorial serif for headlines + lede; Geist sans for UI; Geist Mono
        // for data/trace. Variables are wired in app/layout.tsx via next/font.
        sans: ["var(--font-geist)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-newsreader)", "Newsreader", "Georgia", "serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        // Design uses square corners by default; keep the shadcn radius vars
        // available for components that opt back into rounding.
        DEFAULT: "0",
        md: "0",
        sm: "0",
      },
      boxShadow: {
        paper: "4px 4px 0 #c8d6da",
      },
      keyframes: {
        "dryline-pulse": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.85)" },
        },
        "dryline-slide": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "dryline-pulse": "dryline-pulse 1s ease-in-out infinite",
        "dryline-slide": "dryline-slide 240ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;

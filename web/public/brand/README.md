# Dryline brand assets

Asset pack for the Dryline mark and wordmark. The mark is a solid slate D with three horizontal wavy bands cut as true negative space — the bands are transparent, so the mark drops onto any surface without a hardcoded background.

## File layout

```
brand/
├── README.md              ← this file
├── colors.json            ← brand color + type tokens
├── svg/
│   ├── dryline-mark.svg            ← primary mark, slate on transparent
│   ├── dryline-mark-white.svg      ← mark in white for dark surfaces
│   ├── dryline-wordmark.svg        ← mark + "Dryline" lockup, slate
│   ├── dryline-wordmark-white.svg  ← lockup in white for dark surfaces
│   └── dryline-favicon.svg         ← simplified two-band variant for small sizes
├── png/
│   ├── mark/               ← slate mark, square, 32 → 1024 px
│   ├── mark-white/         ← white mark, square, 32 → 1024 px
│   ├── wordmark/           ← slate wordmark, 256w → 2048w
│   └── wordmark-white/     ← white wordmark, 256w → 2048w
└── favicon/
    ├── favicon.ico                 ← multi-res .ico (16, 32, 48)
    ├── favicon-16.png
    ├── favicon-32.png
    ├── favicon-48.png
    ├── favicon-96.png
    ├── apple-touch-icon.png        ← 180×180
    ├── android-chrome-192.png      ← 192×192
    └── android-chrome-512.png      ← 512×512
```

## Brand color

Primary slate: `#1E293B` (Tailwind slate-800).

The wave bands inside the mark are negative space — the mark itself has only one color. To recolor, change the fill in the SVG; the cuts will continue to drop through to whatever's behind.

Full color and type tokens are in `colors.json` for direct import into a design system or Tailwind config.

## Mark rules

1. **Don't recolor the cuts.** The wave bands are transparent. They show whatever's behind the mark — that's by design. Don't fill them with a background color.
2. **Don't distort.** Keep the aspect ratio of the SVG viewBox (mark is square; wordmark is 480:130).
3. **Clear space.** Minimum clear space around the mark is equal to the height of one wave band (~10% of the mark height).
4. **Minimum size.** Use the primary mark at 32 px and above. Below 32 px, use `dryline-favicon.svg` (two-band simplification) — it survives 16 px.
5. **On dark surfaces.** Use the `-white` variant. Don't apply the slate mark over dark fills.

## Web integration

### Favicons in HTML `<head>`

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="/brand/svg/dryline-favicon.svg">
<link rel="apple-touch-icon" href="/brand/favicon/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1E293B">
```

### `site.webmanifest`

```json
{
  "name": "Dryline",
  "short_name": "Dryline",
  "icons": [
    { "src": "/brand/favicon/android-chrome-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/brand/favicon/android-chrome-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#1E293B",
  "background_color": "#FFFFFF",
  "display": "standalone"
}
```

### Webfont loading (wordmark uses Lato Medium)

```html
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@500&family=Lora:ital@1&display=swap" rel="stylesheet">
```

## React / Next.js usage

### Inline SVG component (recommended — recolors via `currentColor`)

For a single-color inline mark that takes its color from the surrounding text color, use this React component. It's the same path data as `dryline-mark.svg` but with `fill="currentColor"`:

```jsx
// components/DrylineMark.jsx
export function DrylineMark({ size = 32, className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 130 130"
      width={size}
      height={size}
      role="img"
      aria-label="Dryline"
      className={className}
      {...props}
    >
      <defs>
        <clipPath id="dryline-d-clip">
          <path d="M 0 0 L 0 130 L 40 130 Q 130 130 130 65 Q 130 0 40 0 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#dryline-d-clip)">
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M 0 0 L 0 130 L 40 130 Q 130 130 130 65 Q 130 0 40 0 Z M -4 27 Q 18 21 40 27 Q 62 33 84 27 Q 106 21 128 27 Q 150 33 140 27 L 140 37 Q 150 43 128 37 Q 106 31 84 37 Q 62 43 40 37 Q 18 31 -4 37 Z M -4 60 Q 18 54 40 60 Q 62 66 84 60 Q 106 54 128 60 Q 150 66 140 60 L 140 70 Q 150 76 128 70 Q 106 64 84 70 Q 62 76 40 70 Q 18 64 -4 70 Z M -4 93 Q 18 87 40 93 Q 62 99 84 93 Q 106 87 128 93 Q 150 99 140 93 L 140 103 Q 150 109 128 103 Q 106 97 84 103 Q 62 109 40 103 Q 18 97 -4 103 Z"
        />
      </g>
    </svg>
  );
}
```

Usage:

```jsx
<DrylineMark size={48} style={{ color: '#1E293B' }} />
<DrylineMark size={32} className="text-slate-800" />
```

### Wordmark via `<img>` (simpler — no recolor needed)

```jsx
<img src="/brand/svg/dryline-wordmark.svg" alt="Dryline" height={32} />
```

For dark surfaces:

```jsx
<img src="/brand/svg/dryline-wordmark-white.svg" alt="Dryline" height={32} />
```

## Tagline pairing

The tagline "Follow the water at any Texas address — every claim cited." is set in Lora Italic at `#64748B`. Suggested HTML:

```html
<div style="display: flex; align-items: center; gap: 16px;">
  <img src="/brand/svg/dryline-wordmark.svg" alt="Dryline" height="32">
  <span style="font-family: Lora, Georgia, serif; font-style: italic; color: #64748B; font-size: 14px; line-height: 1.4;">
    Follow the water at any Texas address — every claim cited.
  </span>
</div>
```

## Tailwind config snippet

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        dryline: {
          DEFAULT: '#1E293B',
          surface: '#FFFFFF',
          'surface-soft': '#F8FAFC',
          'text-secondary': '#64748B',
          'text-muted': '#94A3B8',
        },
      },
      fontFamily: {
        wordmark: ['Lato', 'Helvetica Neue', 'system-ui', 'sans-serif'],
        tagline: ['Lora', 'Georgia', 'serif'],
      },
    },
  },
};
```

## Notes for Claude Code

- Drop the contents of `brand/` into your project's `public/brand/` (Next.js) or `src/assets/brand/` (Vite). Adjust the paths in HTML snippets accordingly.
- Prefer the inline React component (`DrylineMark`) for in-app usage — recolors with `currentColor`, no extra request.
- Reserve the PNG raster files for places where SVG isn't possible (e.g. social-share OG images, email signatures).
- The favicon SVG (`dryline-favicon.svg`) is a different simplified mark (two bands instead of three) tuned for legibility at 16–32 px. Use it for browser tabs, app icons, and PWA installs.

import * as React from "react";

interface DrylineMarkProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * The official Dryline brand mark: a solid slate D with three horizontal
 * wave bands cut as true negative space. The bands are transparent — they
 * drop through to whatever is behind the mark, so it sits on any surface
 * without a hardcoded background.
 *
 * Single color, driven by `currentColor`, so it recolors from the
 * surrounding text color (e.g. `className="text-dryline"` on light
 * surfaces, `text-white` on dark ones). Same path data as
 * `public/brand/svg/dryline-mark.svg`.
 *
 * Below ~32px, prefer the simplified two-band favicon variant
 * (`public/brand/svg/dryline-favicon.svg`) — it's what the browser tab
 * and PWA icon use.
 */
export function DrylineMark({ size = 32, className, ...props }: DrylineMarkProps) {
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

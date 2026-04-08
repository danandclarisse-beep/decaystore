interface LogoMarkProps {
  size?: number
  className?: string
}

/**
 * The DecayStore logo mark — an hourglass with a partial decay fill.
 * Uses CSS var(--accent) for the amber colour so it adapts to themes.
 */
export function LogoMark({ size = 28, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Rounded background */}
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      {/* Top triangle (full — files that exist) */}
      <path
        d="M9.5 6h13L17 14.5h-2L9.5 6Z"
        fill="#000"
        fillOpacity="0.85"
      />
      {/* Waist bars */}
      <rect x="13" y="14" width="6" height="1.5" rx="0.75" fill="#000" fillOpacity="0.85" />
      <rect x="13" y="16.5" width="6" height="1.5" rx="0.75" fill="#000" fillOpacity="0.5" />
      {/* Bottom triangle ghost (empty = decayed away) */}
      <path
        d="M15 18h2l5 8H10l5-8Z"
        fill="#000"
        fillOpacity="0.15"
      />
      {/* Partial fill — the fraction that remains */}
      <path
        d="M14 22.5h4l3.5 3.5H10.5l3.5-3.5Z"
        fill="#000"
        fillOpacity="0.7"
      />
    </svg>
  )
}

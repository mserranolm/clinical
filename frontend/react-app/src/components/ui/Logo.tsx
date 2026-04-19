interface LogoProps {
  className?: string;
  style?: React.CSSProperties;
  variant?: "dark" | "light" | "color";
  isoOnly?: boolean;
}

export function Logo({ className, style, variant = "color", isoOnly = false }: LogoProps) {
  // Color palette per variant
  const strokeColor  = variant === "light" ? "#FFFFFF" : "#0F172A";
  const textColor    = variant === "light" ? "#FFFFFF" : "#0F172A";
  const tealColor    = variant === "light" ? "#22C9A6" : "#0D9488";

  if (isoOnly) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 56 56"
        fill="none"
        className={className}
        style={style}
        aria-label="DOCCO"
        role="img"
      >
        {/* Teal arc behind the cross */}
        <path
          d="M 44.2,45.8 A 20.2,20.2 0 1,1 50.8,33"
          stroke={tealColor}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Medical cross + caduceus */}
        <g stroke={strokeColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8"  y="21" width="40" height="14" rx="4" ry="4" fill="none" />
          <rect x="21" y="8"  width="14" height="40" rx="4" ry="4" fill="none" />
          <path d="M 28,15 v 26 M 22,22 q 2,-1 3,-3 1,2 3,3 2,-1 3,-3 1,2 3,3 M 28,24 a 4,4 0 0,0 -4,4 c 0,4 8,4 8,8 a 4,4 0 0,1 -4,4" />
        </g>
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 220 56"
      fill="none"
      className={className}
      style={style}
      aria-label="DOCCO"
      role="img"
    >
      {/* ── Isotipo ──────────────────────────── */}
      <g>
        {/* Teal arc */}
        <path
          d="M 44.2,45.8 A 20.2,20.2 0 1,1 50.8,33"
          stroke={tealColor}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Medical cross + caduceus */}
        <g stroke={strokeColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8"  y="21" width="40" height="14" rx="4" ry="4" fill="none" />
          <rect x="21" y="8"  width="14" height="40" rx="4" ry="4" fill="none" />
          <path d="M 28,15 v 26 M 22,22 q 2,-1 3,-3 1,2 3,3 2,-1 3,-3 1,2 3,3 M 28,24 a 4,4 0 0,0 -4,4 c 0,4 8,4 8,8 a 4,4 0 0,1 -4,4" />
        </g>
      </g>

      {/* ── Logotipo: DOCCO ─────────────────── */}
      <text
        x="68"
        y="38"
        fill={textColor}
        fontFamily="Montserrat, system-ui, -apple-system, sans-serif"
        fontWeight="900"
        fontSize="28"
        letterSpacing="-0.02em"
      >
        DOCCO
      </text>
    </svg>
  );
}

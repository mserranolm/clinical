interface LogoProps {
  className?: string;
  variant?: "dark" | "light" | "color";
}

export function Logo({ className = "h-10 w-auto", variant = "color" }: LogoProps) {
  const textColor   = variant === "light" ? "#ffffff" : "#0f172a";
  const accentColor = variant === "light" ? "#5eead4" : "#0d9488";
  const pulseColor  = variant === "light" ? "#ffffff" : "#0d9488";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 280 56"
      fill="none"
      className={className}
      aria-label="CliniSense"
      role="img"
    >
      {/* ── Isotipo: escudo médico ──────────────────────────── */}
      <g>
        {/* Escudo base */}
        <path
          d="M28 4 L48 12 L48 30 C48 41 38 50 28 52 C18 50 8 41 8 30 L8 12 Z"
          fill={accentColor}
          opacity="0.15"
        />
        {/* Escudo borde */}
        <path
          d="M28 4 L48 12 L48 30 C48 41 38 50 28 52 C18 50 8 41 8 30 L8 12 Z"
          stroke={accentColor}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Cruz médica */}
        <rect x="24" y="18" width="8" height="20" rx="2" fill={accentColor} />
        <rect x="18" y="24" width="20" height="8" rx="2" fill={accentColor} />
        {/* Pulso ECG sobre la cruz */}
        <path
          d="M14 28 L19 28 L21 22 L24 34 L27 24 L29 32 L31 28 L42 28"
          stroke={pulseColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={variant === "light" ? "0.9" : "0.7"}
        />
      </g>

      {/* ── Logotipo: texto ─────────────────────────────────── */}
      <text
        x="60"
        y="38"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif"
        fontWeight="800"
        fontSize="30"
        letterSpacing="-0.03em"
      >
        <tspan fill={textColor}>Clini</tspan>
        <tspan fill={accentColor}>Sense</tspan>
      </text>
    </svg>
  );
}

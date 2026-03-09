import { useEffect, useState } from "react";

/** Returns true when the current active theme is dark. Reactively updates when the theme changes. */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.getAttribute("data-theme") === "dark"
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.getAttribute("data-theme") === "dark")
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

/** Returns a set of theme-aware inline-style tokens.
 *  Use these for components that cannot avoid inline styles. */
export function useThemeTokens() {
  const isDark = useIsDark();
  return {
    isDark,
    surface:      isDark ? "var(--surface)"    : "#ffffff",
    surface2:     isDark ? "var(--surface-2)"  : "#f9fafb",
    surfaceHover: isDark ? "rgba(241,245,249,0.04)" : "#f9fafb",
    border:       isDark ? "var(--border)"     : "#e5e7eb",
    borderFaint:  isDark ? "var(--border)"     : "#f3f4f6",
    text:         isDark ? "var(--text-primary)"   : "#111827",
    textSub:      isDark ? "var(--text-secondary)" : "#6b7280",
    textMuted:    isDark ? "var(--text-muted)"     : "#9ca3af",
    accent:       "var(--accent)",
    danger:       isDark ? "#f87171" : "#dc2626",
    dangerBg:     isDark ? "rgba(239,68,68,0.15)" : "#fef2f2",
    dangerBorder: isDark ? "rgba(239,68,68,0.30)" : "#fca5a5",
    successBg:    isDark ? "rgba(16,185,129,0.15)" : "#f0fdf4",
    successBorder:isDark ? "rgba(16,185,129,0.30)" : "#86efac",
    successText:  isDark ? "#6ee7b7" : "#166534",
    iconGreen:    isDark ? "rgba(16,185,129,0.18)" : "#d1fae5",
    iconPurple:   isDark ? "rgba(139,92,246,0.18)" : "#ede9fe",
    iconGreenText:  isDark ? "#6ee7b7" : "#065f46",
    iconPurpleText: isDark ? "#c4b5fd" : "#6d28d9",
    pillPagoCompleto: {
      bg:    isDark ? "rgba(16,185,129,0.18)" : "#d1fae5",
      color: isDark ? "#6ee7b7" : "#065f46",
    },
    pillAbono: {
      bg:    isDark ? "rgba(245,158,11,0.18)" : "#fef3c7",
      color: isDark ? "#fcd34d" : "#92400e",
    },
  };
}

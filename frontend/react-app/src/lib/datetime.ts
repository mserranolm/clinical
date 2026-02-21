/**
 * Convierte una fecha y hora local (del navegador) a ISO 8601 con el offset real del navegador.
 * Ejemplo: localDateTimeToISO("2026-02-21", "17:00") en España (UTC+1) → "2026-02-21T17:00:00+01:00"
 * Así el backend recibe la hora exacta que el usuario eligió, sin conversiones incorrectas.
 */
export function localDateTimeToISO(dateStr: string, timeStr: string): string {
  const offsetMin = new Date().getTimezoneOffset(); // minutos detrás de UTC (negativo si adelantado)
  const sign = offsetMin <= 0 ? "+" : "-";
  const absMin = Math.abs(offsetMin);
  const hh = String(Math.floor(absMin / 60)).padStart(2, "0");
  const mm = String(absMin % 60).padStart(2, "0");
  return `${dateStr}T${timeStr}:00${sign}${hh}:${mm}`;
}

/**
 * Dado un ISO string (con cualquier timezone), devuelve fecha y hora en la zona local del navegador.
 * Útil para pre-rellenar formularios de edición.
 */
export function isoToLocalDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return {
    date: `${year}-${month}-${day}`,
    time: `${hh}:${mm}`,
  };
}

export const TIME_SLOTS = [
  "07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30",
  "11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30","17:00","17:30","18:00",
] as const;

export const DURATION_BLOCKS = [
  { label: "30 minutos", value: 30 },
  { label: "1 hora", value: 60 },
  { label: "1 hora 30 min", value: 90 },
  { label: "2 horas", value: 120 },
  { label: "2 horas 30 min", value: 150 },
  { label: "3 horas", value: 180 },
] as const;

export const AUTO_REFRESH_OPTS = [
  { value: 0, label: "Desactivada" },
  { value: 10, label: "Cada 10 s" },
  { value: 15, label: "Cada 15 s" },
  { value: 30, label: "Cada 30 s" },
  { value: 60, label: "Cada 60 s" },
] as const;

/** Formats a "HH:MM" time slot string to 12-hour AM/PM format. */
export function fmtTimeSlot(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

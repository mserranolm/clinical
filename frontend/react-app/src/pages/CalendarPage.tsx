import { useEffect, useMemo, useState } from "react";
import { clinicalApi, type AppointmentDTO } from "../api/clinical";
import { notify } from "../lib/notify";
import type { AuthSession } from "../types";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Modal } from "../components/Modal";
import { DatePicker } from "../components/ui/DatePicker";
import { PatientSearch } from "../modules/appointments/components/PatientSearch";
import { DoctorSearch } from "../modules/appointments/components/DoctorSearch";
import { DURATION_BLOCKS, TIME_SLOTS } from "../lib/constants";
import { localDateTimeToISO } from "../lib/datetime";
import { canWriteAppointments } from "../lib/rbac";
import { useIsDark } from "../lib/use-is-dark";

// ─── Config ─────────────────────────────────────────────────
const HOUR_START  = 7;
const HOUR_END    = 20;
const TOTAL_HOURS = HOUR_END - HOUR_START;
const SLOT_HEIGHT = 60;
const MAX_PILLS   = 3; // max visible pills per day cell before "+N más"

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAY_NAMES   = ["L","M","X","J","V","S","D"];

type ViewType = "month" | "week" | "day";

// ─── Helpers ────────────────────────────────────────────────
function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function getWeekDays(anchor: Date): Date[] {
  const dow = anchor.getDay();
  const monday = addDays(anchor, dow === 0 ? -6 : 1 - dow);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
function getMonthGrid(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay();
  const offset   = startDow === 0 ? 6 : startDow - 1;
  const gridStart = new Date(year, month, 1 - offset);
  const weeks: Date[][] = [];
  let cur = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) { week.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    weeks.push(week);
  }
  return weeks;
}
function timeToMinutes(iso: string): number {
  const d = new Date(iso); return d.getHours() * 60 + d.getMinutes();
}
function isMobile(): boolean { return window.innerWidth < 768; }

// ─── Status config ───────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  scheduled: "Pendiente", confirmed: "Confirmada",
  in_progress: "En consulta", completed: "Finalizada", cancelled: "Cancelada",
};

// CSS class suffix per status (used for pill coloring)
const STATUS_CLASS: Record<string, string> = {
  scheduled: "scheduled", confirmed: "confirmed",
  in_progress: "in-progress", completed: "completed", cancelled: "cancelled",
};

// Dark-mode-aware colors for the timeline view (inline styles unavoidable there)
const TIMELINE_COLORS_LIGHT: Record<string, { bg: string; border: string; text: string }> = {
  scheduled:   { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  confirmed:   { bg: "#d1fae5", border: "#10b981", text: "#065f46" },
  in_progress: { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
  completed:   { bg: "#f1f5f9", border: "#94a3b8", text: "#475569" },
  cancelled:   { bg: "#fee2e2", border: "#ef4444", text: "#991b1b" },
};
const TIMELINE_COLORS_DARK: Record<string, { bg: string; border: string; text: string }> = {
  scheduled:   { bg: "rgba(59,130,246,0.18)",  border: "#60a5fa", text: "#93c5fd" },
  confirmed:   { bg: "rgba(16,185,129,0.18)",  border: "#34d399", text: "#6ee7b7" },
  in_progress: { bg: "rgba(245,158,11,0.18)",  border: "#fbbf24", text: "#fcd34d" },
  completed:   { bg: "rgba(148,163,184,0.14)", border: "#94a3b8", text: "#cbd5e1" },
  cancelled:   { bg: "rgba(239,68,68,0.18)",   border: "#f87171", text: "#fca5a5" },
};

// ─── Component ──────────────────────────────────────────────
export function CalendarPage({ token, doctorId, session }: { token: string; doctorId: string; session: AuthSession }) {
  const [today]       = useState(() => new Date());
  const [anchor, setAnchor] = useState(() => new Date());
  const [viewType, setViewType] = useState<ViewType>(() => isMobile() ? "day" : "month");
  const [appointments, setAppointments]   = useState<AppointmentDTO[]>([]);
  const [patients,     setPatients]       = useState<Map<string, string>>(new Map());
  const [loading,      setLoading]        = useState(false);
  const [selectedAppt, setSelectedAppt]   = useState<AppointmentDTO | null>(null);
  const [showCreate,   setShowCreate]     = useState(false);
  const [createDate,   setCreateDate]     = useState(toLocalDateString(new Date()));
  const [createTime,   setCreateTime]     = useState("09:00");
  const [duration,     setDuration]       = useState(30);
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; firstName: string; lastName: string } | null>(null);
  const [reason,  setReason]  = useState("");
  const [creating, setCreating] = useState(false);

  const isDark = useIsDark();
  const TIMELINE_COLORS = isDark ? TIMELINE_COLORS_DARK : TIMELINE_COLORS_LIGHT;

  const isDoctor  = session.role === "doctor";
  const isAdmin   = session.role === "admin";
  const canSelect = isAdmin || session.role === "assistant";
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctorId || "");
  const effectiveDoctorId = isDoctor ? doctorId : selectedDoctorId;

  useEffect(() => {
    if (canSelect && session.orgId) {
      clinicalApi.listOrgUsers(session.orgId, token).then((res) => {
        const docs = (res.items ?? []).filter((u: any) => u.role === "doctor" && u.status === "active");
        const list = docs.map((u: any) => ({ id: u.id, name: u.name }));
        if (isAdmin) list.unshift({ id: "", name: "Todos los doctores" });
        setDoctors(list);
        if (list.length > 0) setSelectedDoctorId(list[0].id);
      }).catch(() => {});
    }
  }, [canSelect, session.orgId]);

  // Derived layout data
  const monthGrid = useMemo(() => getMonthGrid(anchor.getFullYear(), anchor.getMonth()), [anchor]);
  const weekDays  = useMemo(() => viewType === "week" ? getWeekDays(anchor) : [anchor], [anchor, viewType]);

  // Appointments indexed by date
  const apptsByDate = useMemo(() => {
    const map = new Map<string, AppointmentDTO[]>();
    for (const appt of appointments) {
      const key = toLocalDateString(new Date(appt.startAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(appt);
    }
    return map;
  }, [appointments]);

  // Load appointments for the visible date range
  useEffect(() => { loadCalendar(); }, [anchor, viewType, effectiveDoctorId]);

  async function loadCalendar() {
    setLoading(true);
    try {
      let datesToFetch: string[];
      if (viewType === "month") {
        datesToFetch = monthGrid.flat().map(d => toLocalDateString(d));
      } else {
        datesToFetch = weekDays.map(d => toLocalDateString(d));
      }
      const uniqueDates = [...new Set(datesToFetch)];
      const [apptResults, patientsRes] = await Promise.all([
        Promise.all(uniqueDates.map(date => clinicalApi.listAppointments(effectiveDoctorId, date, token))),
        clinicalApi.listPatients("", token),
      ]);
      setAppointments(apptResults.flatMap(r => r.items || []));
      const map = new Map<string, string>();
      (patientsRes.items || []).forEach((p: any) => map.set(p.id, `${p.firstName} ${p.lastName}`));
      setPatients(map);
    } catch {
      notify.error("Error al cargar el calendario");
    } finally {
      setLoading(false);
    }
  }

  // Navigation
  function prevPeriod() {
    if (viewType === "month") setAnchor(a => new Date(a.getFullYear(), a.getMonth() - 1, 1));
    else setAnchor(a => addDays(a, viewType === "week" ? -7 : -1));
  }
  function nextPeriod() {
    if (viewType === "month") setAnchor(a => new Date(a.getFullYear(), a.getMonth() + 1, 1));
    else setAnchor(a => addDays(a, viewType === "week" ? 7 : 1));
  }
  function goToday() { setAnchor(new Date()); }

  function handleDayCellClick(day: Date) {
    if (!canWriteAppointments(session)) return;
    setCreateDate(toLocalDateString(day));
    setCreateTime("09:00");
    setShowCreate(true);
  }
  function handleSlotClick(day: Date, hour: number) {
    if (!canWriteAppointments(session)) return;
    setCreateDate(toLocalDateString(day));
    setCreateTime(hour < 10 ? `0${hour}:00` : `${hour}:00`);
    setShowCreate(true);
  }

  async function onCreate() {
    if (!selectedPatient?.id) { notify.error("Selecciona un paciente"); return; }
    setCreating(true);
    try {
      await clinicalApi.createAppointment({
        doctorId: effectiveDoctorId || session.userId,
        patientId: selectedPatient.id,
        startAt: localDateTimeToISO(createDate, createTime),
        durationMinutes: duration,
        reason,
      }, token);
      notify.success("Cita agendada");
      setShowCreate(false);
      setSelectedPatient(null);
      setReason("");
      loadCalendar();
    } catch (err) {
      notify.error("Error al agendar", err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  // Period label
  const periodLabel = viewType === "month"
    ? `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`
    : viewType === "week"
    ? `${weekDays[0].toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} – ${weekDays[6].toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}`
    : anchor.toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  // ─── Month view ───────────────────────────────────────────
  function MonthView() {
    return (
      <div className="gcal-month-wrap">
        {/* Weekday headers */}
        <div className="gcal-weekday-row">
          {DAY_NAMES.map(d => (
            <div key={d} className="gcal-weekday-header">{d}</div>
          ))}
        </div>
        {/* Day grid */}
        <div className="gcal-month-grid">
          {monthGrid.flat().map((day, idx) => {
            const dateStr   = toLocalDateString(day);
            const isToday   = dateStr === toLocalDateString(today);
            const isOutside = day.getMonth() !== anchor.getMonth();
            const dayAppts  = apptsByDate.get(dateStr) || [];
            const visible   = dayAppts.slice(0, MAX_PILLS);
            const overflow  = dayAppts.length - visible.length;

            return (
              <div
                key={idx}
                className={`gcal-day-cell${isToday ? " gcal-day-today" : ""}${isOutside ? " gcal-day-outside" : ""}`}
                onClick={() => handleDayCellClick(day)}
              >
                <span className="gcal-day-number">{day.getDate()}</span>
                <div className="gcal-pills">
                  {visible.map(appt => {
                    const name   = patients.get(appt.patientId) || "—";
                    const start  = new Date(appt.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                    const status = STATUS_CLASS[appt.status] || "scheduled";
                    return (
                      <button
                        key={appt.id}
                        type="button"
                        className={`gcal-pill gcal-pill--${status}`}
                        onClick={e => { e.stopPropagation(); setSelectedAppt(appt); }}
                        title={`${start} · ${name}`}
                      >
                        <span className="gcal-pill-time">{start}</span>
                        <span className="gcal-pill-name">{name}</span>
                      </button>
                    );
                  })}
                  {overflow > 0 && (
                    <span className="gcal-pill-overflow">+{overflow} más</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Timeline view (week / day) ───────────────────────────
  function TimelineView() {
    const surface    = "var(--surface)";
    const surface2   = "var(--surface-2)";
    const border     = "var(--border)";
    const textPrimary   = "var(--text-primary)";
    const textMuted     = "var(--text-muted)";
    const hoverBg = isDark ? "rgba(241,245,249,0.04)" : "#f8fafc";

    return (
      <div style={{ background: surface, borderRadius: 12, border: `1px solid var(--border-strong)`, overflow: "auto", maxHeight: "calc(100vh - 220px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: `56px repeat(${weekDays.length}, 1fr)`, minWidth: viewType === "week" ? 600 : 300 }}>
          {/* Header */}
          <div style={{ borderRight: `1px solid ${border}`, borderBottom: `1px solid ${border}`, height: 48, background: surface2 }} />
          {weekDays.map((day, i) => {
            const isToday = toLocalDateString(day) === toLocalDateString(today);
            return (
              <div key={i} style={{ borderBottom: `1px solid ${border}`, borderRight: `1px solid ${border}`, padding: "8px 4px", textAlign: "center", background: surface2 }}>
                <div style={{ fontSize: "0.7rem", color: textMuted, fontWeight: 600, textTransform: "uppercase" }}>
                  {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"][i]}
                </div>
                <div style={{ width: 28, height: 28, borderRadius: "50%", margin: "2px auto 0", display: "flex", alignItems: "center", justifyContent: "center", background: isToday ? "#3b82f6" : "transparent", color: isToday ? "white" : textPrimary, fontWeight: isToday ? 700 : 600, fontSize: "0.875rem" }}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
          {/* Time slots */}
          {Array.from({ length: TOTAL_HOURS }, (_, h) => {
            const hour  = HOUR_START + h;
            const label = hour < 12 ? `${hour}am` : hour === 12 ? "12pm" : `${hour-12}pm`;
            return (
              <>
                <div key={`t${h}`} style={{ borderRight: `1px solid ${border}`, borderBottom: `1px solid ${border}`, height: SLOT_HEIGHT, display: "flex", alignItems: "flex-start", padding: "4px 6px", fontSize: "0.65rem", color: textMuted, fontWeight: 600 }}>
                  {label}
                </div>
                {weekDays.map((day, di) => {
                  const dayStr  = toLocalDateString(day);
                  const dayAppts = appointments.filter(a => {
                    const d = new Date(a.startAt);
                    return toLocalDateString(d) === dayStr && d.getHours() === hour;
                  });
                  return (
                    <div key={`${h}-${di}`}
                      onClick={() => handleSlotClick(day, hour)}
                      style={{ borderRight: `1px solid ${border}`, borderBottom: `1px solid ${border}`, height: SLOT_HEIGHT, position: "relative", cursor: "pointer" }}
                      onMouseEnter={e => { if (!dayAppts.length) (e.currentTarget.style.background = hoverBg); }}
                      onMouseLeave={e => { (e.currentTarget.style.background = "transparent"); }}
                    >
                      {dayAppts.map(appt => {
                        const startMin = timeToMinutes(appt.startAt);
                        const endMin   = timeToMinutes(appt.endAt || appt.startAt);
                        const top    = ((startMin - HOUR_START * 60) / 60) * SLOT_HEIGHT - h * SLOT_HEIGHT;
                        const height = (Math.max(endMin - startMin, 30) / 60) * SLOT_HEIGHT;
                        const colors = TIMELINE_COLORS[appt.status] || TIMELINE_COLORS.scheduled;
                        const name   = patients.get(appt.patientId) || appt.patientId;
                        const startFmt = new Date(appt.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                        return (
                          <div key={appt.id}
                            onClick={e => { e.stopPropagation(); setSelectedAppt(appt); }}
                            style={{ position: "absolute", top: Math.max(0, top), left: 2, right: 2, height: Math.min(height, SLOT_HEIGHT - 2), background: colors.bg, borderLeft: `3px solid ${colors.border}`, borderRadius: 6, padding: "3px 6px", cursor: "pointer", overflow: "hidden", zIndex: 1, fontSize: "0.75rem" }}
                          >
                            <div style={{ fontWeight: 700, color: colors.text, lineHeight: 1.3 }}>{startFmt}</div>
                            <div style={{ color: colors.text, opacity: 0.85, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────
  return (
    <section className="page-section gcal-page">
      {/* Header */}
      <div className="gcal-header">
        <div className="gcal-header-left">
          <button type="button" className="gcal-btn-today" onClick={goToday}>Hoy</button>
          <div className="gcal-nav">
            <button type="button" className="gcal-btn-nav" onClick={prevPeriod}><ChevronLeft size={16} /></button>
            <button type="button" className="gcal-btn-nav" onClick={nextPeriod}><ChevronRight size={16} /></button>
          </div>
          <h2 className="gcal-period-title">{periodLabel}</h2>
          {loading && <span className="gcal-loading">Actualizando…</span>}
        </div>
        <div className="gcal-header-right">
          {canWriteAppointments(session) && (
            <button type="button" className="gcal-btn-create" onClick={() => { setCreateDate(toLocalDateString(new Date())); setCreateTime("09:00"); setShowCreate(true); }}>
              <Plus size={15} /> Crear cita
            </button>
          )}
          <div className="gcal-view-switch">
            {(["month","week","day"] as ViewType[]).map(v => (
              <button key={v} type="button" className={`gcal-view-btn${viewType === v ? " gcal-view-btn--active" : ""}`} onClick={() => setViewType(v)}>
                {{ month: "Mes", week: "Semana", day: "Día" }[v]}
              </button>
            ))}
          </div>
          {canSelect && doctors.length > 0 && (
            <select className="gcal-doctor-select" value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)}>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Calendar body */}
      {viewType === "month" ? <MonthView /> : <TimelineView />}

      {/* Event detail modal */}
      {selectedAppt && (
        <Modal onClose={() => setSelectedAppt(null)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Detalle de Cita</h3>
            <button type="button" onClick={() => setSelectedAppt(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
              <X size={18} />
            </button>
          </div>
          {(() => {
            const appt   = selectedAppt;
            const colors = TIMELINE_COLORS[appt.status] || TIMELINE_COLORS.scheduled;
            const name   = patients.get(appt.patientId) || appt.patientId;
            const start  = new Date(appt.startAt);
            const end    = appt.endAt ? new Date(appt.endAt) : null;
            const fmt    = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const fmtDt  = (d: Date) => d.toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long" });
            return (
              <div>
                <div style={{ display: "inline-block", padding: "3px 12px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600, background: colors.bg, color: colors.text, marginBottom: 16 }}>
                  {STATUS_LABELS[appt.status] || appt.status}
                </div>
                <div style={{ marginBottom: 8 }}><strong>Paciente:</strong> {name}</div>
                <div style={{ marginBottom: 8 }}><strong>Fecha:</strong> {fmtDt(start)}</div>
                <div style={{ marginBottom: 8 }}><strong>Hora:</strong> {fmt(start)}{end ? ` – ${fmt(end)}` : ""}</div>
                {appt.reason && <div style={{ marginBottom: 8 }}><strong>Motivo:</strong> {appt.reason}</div>}
                {appt.paymentAmount != null && appt.paymentAmount > 0 && (
                  <div style={{ marginBottom: 8 }}><strong>Monto:</strong> ${appt.paymentAmount.toFixed(2)} · {appt.paymentMethod || "—"}</div>
                )}
              </div>
            );
          })()}
        </Modal>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)}>
          <h3 style={{ marginBottom: 16 }}>Nueva Cita</h3>
          {canSelect && (
            <div className="input-group">
              <label>Doctor</label>
              <DoctorSearch doctors={doctors} onDoctorSelect={d => setSelectedDoctorId(d.id)} />
            </div>
          )}
          <div className="input-group">
            <label>Paciente</label>
            <PatientSearch doctorId="" token={token} onPatientSelect={setSelectedPatient} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="input-group">
              <label>Fecha</label>
              <DatePicker value={createDate} onChange={setCreateDate} minDate={new Date()} />
            </div>
            <div className="input-group">
              <label>Hora</label>
              <select value={createTime} onChange={e => setCreateTime(e.target.value)}>
                {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="input-group">
            <label>Duración</label>
            <select value={duration} onChange={e => setDuration(Number(e.target.value))}>
              {DURATION_BLOCKS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label>Motivo</label>
            <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Motivo de la cita…" style={{ width: "100%", resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button type="button" className="action-btn action-btn-confirm" onClick={onCreate} disabled={creating}>
              {creating ? "Agendando…" : "Confirmar Cita"}
            </button>
            <button type="button" className="action-btn" onClick={() => setShowCreate(false)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </section>
  );
}

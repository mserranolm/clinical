import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AuthSession } from "../types";
import { clinicalApi } from "../api/clinical";
import { notify } from "../lib/notify";
import { canManageTreatments, canWriteAppointments, isPlatformAdmin, isOrgAdmin } from "../lib/rbac";
import { localDateTimeToISO, isoToLocalDateTime } from "../lib/datetime";
import { Modal } from "../components/Modal";
import { DatePicker } from "../components/ui/DatePicker";
import {
  CheckCircle, TrendingUp, Clock,
  CalendarCheck, DollarSign, ClipboardList, ClipboardCheck,
  Pencil, Stethoscope, Send, RefreshCw,
} from "lucide-react";

const TIME_SLOTS = [
  "07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30",
  "11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30","17:00","17:30","18:00",
];
const DURATION_BLOCKS = [
  { label: "30 minutos", value: 30 },
  { label: "1 hora", value: 60 },
  { label: "1 hora 30 min", value: 90 },
  { label: "2 horas", value: 120 },
  { label: "2 horas 30 min", value: 150 },
  { label: "3 horas", value: 180 },
];
function fmtTime(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

type AppointmentRow = {
  id: string;
  patientId: string;
  patientName?: string;
  startAt: string;
  status: string;
  paymentAmount?: number;
  consentSummary?: { total: number; accepted: number };
};

const AUTO_REFRESH_OPTS = [
  { value: 0, label: "Desactivada" },
  { value: 10, label: "Cada 10 s" },
  { value: 15, label: "Cada 15 s" },
  { value: 30, label: "Cada 30 s" },
  { value: 60, label: "Cada 60 s" },
] as const;

export function DashboardHome({ user, rows, loading, error, date, onDateChange, onRefresh, autoRefreshSeconds = 0, onAutoRefreshChange }: { 
  user: AuthSession; 
  rows: AppointmentRow[]; 
  loading: boolean;
  error: string;
  date: string;
  onDateChange: (date: string) => void;
  onRefresh?: () => void;
  autoRefreshSeconds?: number;
  onAutoRefreshChange?: (seconds: number) => void;
}) {
  const navigate = useNavigate();
  const [showPatientsBreakdown, setShowPatientsBreakdown] = useState(false);
  const [editRow, setEditRow] = useState<AppointmentRow | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editDuration, setEditDuration] = useState(30);
  const [saving, setSaving] = useState(false);
  const [platformStats, setPlatformStats] = useState<{ totalRevenue: number; totalConsultations: number } | null>(null);
  const [orgStats, setOrgStats] = useState<{ totalRevenue: number; pendingRevenue: number; totalConsultations: number } | null>(null);

  useEffect(() => {
    if (isPlatformAdmin(user)) {
      clinicalApi.getPlatformStats(user.token)
        .then(s => setPlatformStats({ totalRevenue: s.totalRevenue, totalConsultations: s.totalConsultations }))
        .catch(() => {});
    } else if (isOrgAdmin(user)) {
      clinicalApi.getOrgStats(user.token)
        .then(s => setOrgStats({ totalRevenue: s.totalRevenue, pendingRevenue: s.pendingRevenue, totalConsultations: s.totalConsultations }))
        .catch(() => {});
    }
  }, [user.token, user.role]);

  function openEdit(row: AppointmentRow) {
    const { date, time } = isoToLocalDateTime(row.startAt);
    setEditRow(row);
    setEditDate(date);
    setEditTime(time);
    setEditDuration(30);
  }

  async function saveEdit() {
    if (!editRow || !editDate || !editTime) return;
    setSaving(true);
    try {
      const startAt = localDateTimeToISO(editDate, editTime);
      const endAt = new Date(new Date(startAt).getTime() + editDuration * 60000).toISOString();
      await clinicalApi.updateAppointment(editRow.id, { startAt, endAt }, user.token);
      notify.success("Cita actualizada");
      setEditRow(null);
      onRefresh?.();
    } catch (err) {
      notify.error("Error al actualizar", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const isConfirmed = (status: string) => status === "confirmed";
  const isCompleted = (status: string) => status === "completed";
  const confirmedRows = useMemo(() => rows.filter((r) => isConfirmed(r.status)), [rows]);
  const unconfirmedRows = useMemo(() => rows.filter((r) => !isConfirmed(r.status) && !isCompleted(r.status) && r.status !== "cancelled"), [rows]);
  const completedRows = useMemo(() => rows.filter((r) => isCompleted(r.status)), [rows]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const confirmed = confirmedRows.length;
    const unconfirmed = unconfirmedRows.length;
    const completed = completedRows.length;
    return [
      { label: "Citas del día", value: String(total), trend: loading ? "Actualizando..." : "En vivo" },
      { label: "Confirmados", value: String(confirmed), trend: "Ver listado", clickable: true },
      { label: "No confirmados", value: String(unconfirmed), trend: "Ver listado", clickable: true },
      { label: "Finalizados", value: String(completed), trend: "Ver listado", clickable: true }
    ];
  }, [confirmedRows.length, completedRows.length, loading, rows.length, unconfirmedRows.length]);

  const statusClass = (status: string) => {
    if (status === "confirmed") return "status-confirmed";
    if (status === "in_progress") return "status-in-progress";
    if (status === "completed") return "status-completed";
    if (status === "cancelled") return "status-cancelled";
    return "status-unconfirmed";
  };
  const statusLabel = (status: string) => {
    if (status === "confirmed") return "Confirmada";
    if (status === "in_progress") return "En consulta";
    if (status === "completed") return "Finalizada";
    if (status === "cancelled") return "Cancelada";
    return "No confirmada";
  };

  const patientLabel = (row: AppointmentRow) => row.patientName || row.patientId;

  const goToTreatment = async (row: AppointmentRow) => {
    if (row.status !== "in_progress") {
      try {
        await clinicalApi.updateAppointment(row.id, { status: "in_progress" }, user.token);
      } catch (_) { /* no bloquear si falla */ }
    }
    navigate(`/dashboard/consulta?appointmentId=${encodeURIComponent(row.id)}&patientId=${encodeURIComponent(row.patientId)}`);
  };

  // Removed duplicate create appointment button from header

  const onConfirm = (id: string) => {
    const promise = clinicalApi.confirmAppointment(id, user.token);
    notify.promise(promise, {
      loading: "Confirmando cita...",
      success: () => { onRefresh?.(); return "Cita confirmada"; },
      error: "Error al confirmar",
    });
  };

  const onResend = (id: string) => {
    const promise = clinicalApi.resendAppointmentConfirmation(id, user.token);
    notify.promise(promise, {
      loading: "Reenviando confirmación...",
      success: () => "Confirmación reenviada",
      error: "Error al reenviar",
    });
  };

  return (
    <section className="page-section">
      {editRow && (
        <Modal onClose={() => setEditRow(null)}>
          <h3 style={{ marginBottom: 16 }}>Editar Cita</h3>
          <div className="input-group">
            <label>Fecha</label>
            <DatePicker value={editDate} onChange={setEditDate} />
          </div>
          <div className="input-group">
            <label>Hora de inicio</label>
            <select value={editTime} onChange={(e) => setEditTime(e.target.value)}>
              <option value="">Seleccione una hora</option>
              {TIME_SLOTS.map((s) => <option key={s} value={s}>{fmtTime(s)}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label>Bloque de tiempo</label>
            <select value={editDuration} onChange={(e) => setEditDuration(Number(e.target.value))}>
              {DURATION_BLOCKS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="action-btn action-btn-confirm" onClick={saveEdit} disabled={saving}>Guardar</button>
            <button className="action-btn" onClick={() => setEditRow(null)}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* KPI cards — citas del día */}
      <div className="stats-grid">
        <article className="stat-card elite-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#e0f2fe", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CalendarCheck size={16} strokeWidth={1.5} color="#0369a1" />
            </div>
            <small style={{ margin: 0 }}>Citas del día</small>
          </div>
          <h3>{kpis[0].value}</h3>
          <span style={{ color: "#10b981", fontWeight: 600, fontSize: "0.75rem" }}>En vivo</span>
        </article>

        <article className="stat-card elite-card" style={{ cursor: "pointer" }} onClick={() => setShowPatientsBreakdown(p => !p)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle size={16} strokeWidth={1.5} color="#166534" />
            </div>
            <small style={{ margin: 0 }}>Confirmados</small>
          </div>
          <h3>{kpis[1].value}</h3>
          <span style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.75rem" }}>Ver listado →</span>
        </article>

        <article className="stat-card elite-card" style={{ cursor: "pointer" }} onClick={() => setShowPatientsBreakdown(p => !p)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={16} strokeWidth={1.5} color="#92400e" />
            </div>
            <small style={{ margin: 0 }}>No confirmados</small>
          </div>
          <h3>{kpis[2].value}</h3>
          <span style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.75rem" }}>Ver listado →</span>
        </article>

        <article className="stat-card elite-card" style={{ cursor: "pointer" }} onClick={() => setShowPatientsBreakdown(p => !p)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ClipboardCheck size={16} strokeWidth={1.5} color="#15803d" />
            </div>
            <small style={{ margin: 0 }}>Finalizados</small>
          </div>
          <h3>{kpis[3].value}</h3>
          <span style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.75rem" }}>Ver listado →</span>
        </article>
      </div>

      {/* KPIs de pagos — superadmin */}
      {isPlatformAdmin(user) && platformStats && (
        <div className="stats-grid">
          <article className="stat-card elite-card" style={{ borderLeft: "3px solid #10b981" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <DollarSign size={16} strokeWidth={1.5} color="#065f46" />
              </div>
              <small style={{ margin: 0 }}>Ingresos totales</small>
            </div>
            <h3 style={{ color: "#10b981", fontSize: "1.6rem" }}>
              ${platformStats.totalRevenue.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span>Todas las organizaciones</span>
          </article>
          <article className="stat-card elite-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ClipboardList size={16} strokeWidth={1.5} color="#166534" />
              </div>
              <small style={{ margin: 0 }}>Consultas finalizadas</small>
            </div>
            <h3>{platformStats.totalConsultations}</h3>
            <span>En toda la plataforma</span>
          </article>
        </div>
      )}

      {/* KPIs de pagos — admin de org */}
      {isOrgAdmin(user) && orgStats && (
        <div className="stats-grid">
          <article className="stat-card elite-card" style={{ borderLeft: "3px solid #10b981" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <DollarSign size={16} strokeWidth={1.5} color="#065f46" />
              </div>
              <small style={{ margin: 0 }}>Ingresos cobrados</small>
            </div>
            <h3 style={{ color: "#10b981", fontSize: "1.6rem" }}>
              ${orgStats.totalRevenue.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span>Consultas finalizadas</span>
          </article>
          <article className="stat-card elite-card" style={{ borderLeft: "3px solid #f59e0b" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp size={16} strokeWidth={1.5} color="#92400e" />
              </div>
              <small style={{ margin: 0 }}>Monto pendiente</small>
            </div>
            <h3 style={{ color: "#f59e0b", fontSize: "1.6rem" }}>
              ${orgStats.pendingRevenue.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span>Citas no finalizadas</span>
          </article>
          <article className="stat-card elite-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ClipboardList size={16} strokeWidth={1.5} color="#166534" />
              </div>
              <small style={{ margin: 0 }}>Total consultas</small>
            </div>
            <h3>{orgStats.totalConsultations}</h3>
            <span>Registradas en la org</span>
          </article>
        </div>
      )}

      {showPatientsBreakdown ? (
        <article className="card elite-card" style={{ marginBottom: 24 }}>
          <header className="card-header" style={{ marginBottom: 16 }}>
            <h3>Listado de pacientes por estado</h3>
          </header>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24 }}>
            <div>
              <h4 style={{ marginBottom: 8 }}>Confirmados ({confirmedRows.length})</h4>
              <ul className="patient-status-list">
                {confirmedRows.map((row) => (
                  <li key={`confirmed-${row.id}`}>{patientLabel(row)}</li>
                ))}
                {confirmedRows.length === 0 ? <li>Sin pacientes confirmados.</li> : null}
              </ul>
            </div>
            <div>
              <h4 style={{ marginBottom: 8 }}>No confirmados ({unconfirmedRows.length})</h4>
              <ul className="patient-status-list">
                {unconfirmedRows.map((row) => (
                  <li key={`unconfirmed-${row.id}`}>{patientLabel(row)}</li>
                ))}
                {unconfirmedRows.length === 0 ? <li>Sin pacientes pendientes.</li> : null}
              </ul>
            </div>
            <div>
              <h4 style={{ marginBottom: 8 }}>Finalizados ({completedRows.length})</h4>
              <ul className="patient-status-list">
                {completedRows.map((row) => (
                  <li key={`completed-${row.id}`}>{patientLabel(row)}</li>
                ))}
                {completedRows.length === 0 ? <li>Ninguna consulta finalizada hoy.</li> : null}
              </ul>
            </div>
          </div>
        </article>
      ) : null}

      <article className="agenda-card">
        {/* ── Header ── */}
        <div className="agenda-header">
          <div className="agenda-header-left">
            <div className="agenda-header-icon">
              <CalendarCheck size={18} strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="agenda-title">Citas de la Jornada</h3>
              <p className="agenda-subtitle">
                {rows.length > 0
                  ? `${rows.length} cita${rows.length !== 1 ? "s" : ""} programada${rows.length !== 1 ? "s" : ""}`
                  : "Sin citas para esta fecha"}
              </p>
            </div>
          </div>
          <div className="agenda-header-right" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="agenda-btn"
              onClick={onRefresh}
              title="Actualizar citas"
              disabled={loading}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw size={13} strokeWidth={1.5} />
              <span>Actualizar</span>
            </button>
            {onAutoRefreshChange && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.875rem", color: "var(--text-secondary, #64748b)" }}>
                <span>Auto:</span>
                <select
                  value={autoRefreshSeconds}
                  onChange={(e) => onAutoRefreshChange(Number(e.target.value))}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: "0.8rem", minWidth: 100 }}
                >
                  {AUTO_REFRESH_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
            )}
            <DatePicker value={date} onChange={onDateChange} />
          </div>
        </div>

        {error ? <div className="auth-error" style={{ margin: "0 0 16px" }}>{error}</div> : null}

        {/* ── Tabla ── */}
        <div className="agenda-table-wrap">
          {rows.length === 0 && !loading ? (
            <div className="agenda-empty">
              <div className="agenda-empty-icon">
                <CalendarCheck size={32} strokeWidth={1} />
              </div>
              <strong>Sin citas para esta fecha</strong>
              <p>Selecciona otro día o crea una nueva cita.</p>
            </div>
          ) : (
            <table className="agenda-table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Horario</th>
                  <th>Estado</th>
                  <th>Consentimientos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="agenda-row">
                    <td>
                      <div className="agenda-patient">
                        <div className="agenda-patient-avatar">
                          {(patientLabel(row)[0] || "?").toUpperCase()}
                        </div>
                        <div>
                          <strong className="agenda-patient-name">{patientLabel(row)}</strong>
                          <span className="agenda-patient-ref">{row.id.split("-")[0]}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="agenda-time">
                        <Clock size={13} strokeWidth={1.5} />
                        {new Date(row.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${statusClass(row.status)}`}>{statusLabel(row.status)}</span>
                    </td>
                    <td>
                      {row.consentSummary && row.consentSummary.total > 0 ? (
                        row.consentSummary.accepted >= row.consentSummary.total ? (
                          <span className="badge status-confirmed" title="Confirmación enviada">Completo</span>
                        ) : (
                          <span className="badge badge-neutral" title={`${row.consentSummary.accepted}/${row.consentSummary.total} enlaces abiertos.`}>Pendiente</span>
                        )
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <div className="agenda-actions">
                        {canWriteAppointments(user) && !isCompleted(row.status) && row.status !== "cancelled" && (
                          <button type="button" className="agenda-btn" onClick={() => openEdit(row)} title="Editar">
                            <Pencil size={13} strokeWidth={1.5} />
                          </button>
                        )}
                        {canWriteAppointments(user) && !isConfirmed(row.status) && !isCompleted(row.status) && row.status !== "cancelled" && row.status !== "in_progress" && (
                          <button type="button" className="agenda-btn agenda-btn-confirm" onClick={() => onConfirm(row.id)} title="Confirmar cita">
                            <CheckCircle size={13} strokeWidth={1.5} />
                            <span>Confirmar</span>
                          </button>
                        )}
                        {canManageTreatments(user) && !isCompleted(row.status) && row.status !== "cancelled" && (
                          <button
                            type="button"
                            className="agenda-btn agenda-btn-treat"
                            onClick={() => (isConfirmed(row.status) || row.status === "in_progress") ? goToTreatment(row) : notify.error("Cita no confirmada", "Confirma la cita antes de atender al paciente.")}
                            title={(isConfirmed(row.status) || row.status === "in_progress") ? "Atender paciente" : "Confirma primero"}
                            style={!(isConfirmed(row.status) || row.status === "in_progress") ? { opacity: 0.45, cursor: "not-allowed" } : {}}
                          >
                            <Stethoscope size={13} strokeWidth={1.5} />
                            <span>Atender</span>
                          </button>
                        )}
                        {isCompleted(row.status) && (
                          <span className="agenda-done-badge">
                            <CheckCircle size={12} strokeWidth={1.5} /> Finalizada
                          </span>
                        )}
                        {!isCompleted(row.status) && row.status !== "cancelled" && !(row.consentSummary && row.consentSummary.total > 0 && row.consentSummary.accepted >= row.consentSummary.total) && (
                          <button type="button" className="agenda-btn" onClick={() => onResend(row.id)} title="Reenviar confirmación">
                            <Send size={13} strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </article>
    </section>
  );
}

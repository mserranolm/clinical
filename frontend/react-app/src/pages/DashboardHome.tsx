import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AuthSession } from "../types";
import { clinicalApi } from "../api/clinical";
import { notify } from "../lib/notify";
import { canManageTreatments, canWriteAppointments } from "../lib/rbac";
import { Modal } from "../components/Modal";

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
};

export function DashboardHome({ user, rows, loading, error, date, onDateChange, onRefresh }: { 
  user: AuthSession; 
  rows: AppointmentRow[]; 
  loading: boolean;
  error: string;
  date: string;
  onDateChange: (date: string) => void;
  onRefresh?: () => void;
}) {
  const navigate = useNavigate();
  const [showPatientsBreakdown, setShowPatientsBreakdown] = useState(false);
  const [editRow, setEditRow] = useState<AppointmentRow | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editDuration, setEditDuration] = useState(30);
  const [saving, setSaving] = useState(false);

  function openEdit(row: AppointmentRow) {
    const d = new Date(row.startAt);
    const dateStr = d.toISOString().slice(0, 10);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const timeStr = `${hh}:${mm}`;
    setEditRow(row);
    setEditDate(dateStr);
    setEditTime(timeStr);
    setEditDuration(30);
  }

  async function saveEdit() {
    if (!editRow || !editDate || !editTime) return;
    setSaving(true);
    try {
      const startAt = new Date(`${editDate}T${editTime}`).toISOString();
      const endAt = new Date(new Date(`${editDate}T${editTime}`).getTime() + editDuration * 60000).toISOString();
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

  const kpis = useMemo(() => {
    const total = rows.length;
    const confirmed = confirmedRows.length;
    const unconfirmed = unconfirmedRows.length;
    return [
      { label: "Citas del día", value: String(total), trend: loading ? "Actualizando..." : "En vivo" },
      { label: "Confirmados", value: String(confirmed), trend: "Ver listado", clickable: true },
      { label: "No confirmados", value: String(unconfirmed), trend: "Ver listado", clickable: true }
    ];
  }, [confirmedRows.length, loading, rows.length, unconfirmedRows.length]);

  const statusClass = (status: string) => {
    if (status === "confirmed") return "status-confirmed";
    if (status === "completed") return "status-completed";
    if (status === "cancelled") return "status-cancelled";
    return "status-unconfirmed";
  };
  const statusLabel = (status: string) => {
    if (status === "confirmed") return "Confirmada";
    if (status === "completed") return "Finalizada";
    if (status === "cancelled") return "Cancelada";
    return "No confirmada";
  };

  const patientLabel = (row: AppointmentRow) => row.patientName || row.patientId;

  const goToTreatment = (row: AppointmentRow) => {
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
            <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
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
      <div className="stats-grid">
        {kpis.map((card) => (
          <article key={card.label} className="stat-card elite-card">
            <small>{card.label}</small>
            <h3>{card.value}</h3>
            {card.clickable ? (
              <button type="button" className="link-btn" onClick={() => setShowPatientsBreakdown((prev) => !prev)}>
                {card.trend}
              </button>
            ) : (
              <span>{card.trend}</span>
            )}
          </article>
        ))}
      </div>

      {showPatientsBreakdown ? (
        <article className="card elite-card" style={{ marginBottom: 24 }}>
          <header className="card-header" style={{ marginBottom: 16 }}>
            <h3>Listado de pacientes por estado</h3>
          </header>
          <div className="grid-2-cols">
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
          </div>
        </article>
      ) : null}

      <article className="chart-card elite-card">
        <header className="card-header">
          <div className="header-copy">
            <h3>Citas de la Jornada</h3>
            <p>Vista detallada de la agenda seleccionada.</p>
          </div>
          <div className="header-actions">
            <input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
          </div>
        </header>
        
        {error ? <div className="auth-error">{error}</div> : null}
        
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Paciente</th>
                <th>Horario</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.id.split("-")[0]}...</td>
                  <td><strong>{patientLabel(row)}</strong></td>
                  <td>{new Date(row.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>
                    <span className={`badge ${statusClass(row.status)}`}>{statusLabel(row.status)}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {canWriteAppointments(user) && !isCompleted(row.status) && row.status !== "cancelled" && (
                        <button type="button" className="action-btn" onClick={() => openEdit(row)}>
                          <span className="icon">✏️</span>
                          <span>Editar</span>
                        </button>
                      )}
                      {canWriteAppointments(user) && !isConfirmed(row.status) && !isCompleted(row.status) && row.status !== "cancelled" && (
                        <button type="button" className="action-btn action-btn-confirm" onClick={() => onConfirm(row.id)}>
                          <span className="icon">✓</span>
                          <span>Confirmar</span>
                        </button>
                      )}
                      {canManageTreatments(user) && !isCompleted(row.status) && (
                        <button
                          type="button"
                          className="action-btn action-btn-treat"
                          onClick={() => isConfirmed(row.status) ? goToTreatment(row) : notify.error("Cita no confirmada", "Confirma la cita antes de atender al paciente.")}
                          title={isConfirmed(row.status) ? "Atender paciente" : "La cita debe estar confirmada"}
                          style={!isConfirmed(row.status) ? { opacity: 0.55 } : {}}
                        >
                          <span>Atender</span>
                          <span className="icon">→</span>
                        </button>
                      )}
                      {isCompleted(row.status) && (
                        <button type="button" className="action-btn" disabled style={{ opacity: 0.5 }}>
                          <span>✓ Finalizada</span>
                        </button>
                      )}
                      {!isCompleted(row.status) && row.status !== "cancelled" && (
                        <button type="button" className="action-btn" onClick={() => onResend(row.id)}>
                          <span className="icon">✉️</span>
                          <span>Reenviar</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} className="empty-state">No se encontraron citas para esta fecha.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

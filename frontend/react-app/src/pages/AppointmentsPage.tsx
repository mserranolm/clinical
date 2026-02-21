import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { clinicalApi } from "../api/clinical";
import { notify } from "../lib/notify";
import { PatientSearch } from "../modules/appointments/components/PatientSearch";
import { DoctorSearch } from "../modules/appointments/components/DoctorSearch";
import { Modal } from "../components/Modal";
import { DatePicker } from "../components/ui/DatePicker";
import { canDeleteAppointments, canWriteAppointments, canManageTreatments } from "../lib/rbac";
import { RefreshCw, Stethoscope } from "lucide-react";
import type { AuthSession } from "../types";
import { localDateTimeToISO, isoToLocalDateTime } from "../lib/datetime";

type AppointmentRow = {
  id: string;
  patientId: string;
  patientName?: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: string;
  paymentAmount?: number;
  paymentPaid?: boolean;
  paymentMethod?: string;
  consentSummary?: { total: number; accepted: number };
};

const DURATION_BLOCKS = [
  { label: "30 minutos", value: 30 },
  { label: "1 hora", value: 60 },
  { label: "1 hora 30 min", value: 90 },
  { label: "2 horas", value: 120 },
  { label: "2 horas 30 min", value: 150 },
  { label: "3 horas", value: 180 },
];

function formatTimeRange(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function AppointmentsPage({ token, doctorId, session }: { token: string; doctorId: string; session: AuthSession }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [createDate, setCreateDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; firstName: string; lastName: string; } | null>(null);
  const [duration, setDuration] = useState<number>(30);
  const [editRow, setEditRow] = useState<AppointmentRow | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editDuration, setEditDuration] = useState(30);
  const [saving, setSaving] = useState(false);
  const [payRow, setPayRow] = useState<AppointmentRow | null>(null);
  const [payPaid, setPayPaid] = useState(true);
  const [payMethod, setPayMethod] = useState("efectivo");
  const [payAmount, setPayAmount] = useState(0);
  const [payingSaving, setPayingSaving] = useState(false);

  function openEdit(row: AppointmentRow) {
    const { date, time } = isoToLocalDateTime(row.startAt);
    setEditRow(row);
    setEditDate(date);
    setEditTime(time);
    setEditDuration(row.durationMinutes || 30);
  }

  async function saveEdit() {
    if (!editRow || !editDate || !editTime) return;
    setSaving(true);
    try {
      const startAt = localDateTimeToISO(editDate, editTime);
      const endAt = new Date(new Date(startAt).getTime() + editDuration * 60000).toISOString();
      await clinicalApi.updateAppointment(editRow.id, { startAt, endAt }, token);
      notify.success("Cita actualizada");
      setEditRow(null);
      loadAppointments(date, effectiveDoctorId);
    } catch (err) {
      notify.error("Error al actualizar", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const isDoctor = session.role === "doctor";
  const isAdmin = session.role === "admin";
  const canSelectDoctor = isAdmin || session.role === "assistant";
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");

  useEffect(() => {
    if (canSelectDoctor && session.orgId) {
      clinicalApi.listOrgUsers(session.orgId, token).then((res) => {
        const docs = (res.items ?? []).filter((u) => u.role === "doctor" && u.status === "active");
        const list: { id: string; name: string }[] = docs.map((u) => ({ id: u.id, name: u.name }));
        if (isAdmin && session.userId && !list.find((d) => d.id === session.userId)) {
          list.unshift({ id: session.userId, name: `${session.name || "Administrador"} (yo)` });
        }
        // Admin puede ver toda la agenda de la organización
        if (isAdmin) list.unshift({ id: "", name: "Toda la agenda" });
        setDoctors(list);
        if (list.length > 0) setSelectedDoctorId(list[0].id);
      }).catch(() => {});
    }
  }, [canSelectDoctor, session.orgId, isAdmin, session.userId, session.name, token]);

  const effectiveDoctorId = isDoctor ? doctorId : selectedDoctorId;

  useEffect(() => {
    loadAppointments(date, effectiveDoctorId);
  }, [location.key, effectiveDoctorId, date]);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;

    if (canSelectDoctor && !selectedDoctorId) {
      notify.error("Selecciona un doctor", "Debes asignar un doctor a la cita.");
      return;
    }
    const startAt = localDateTimeToISO(String(fd.get('date')), String(fd.get('time')));
    const promise = clinicalApi.createAppointment(
      {
        doctorId: effectiveDoctorId,
        patientId: selectedPatient?.id || '',
        startAt,
        durationMinutes: duration,
        treatmentPlan: String(fd.get("treatmentPlan") || ""),
        paymentAmount: Number(fd.get("paymentAmount") || 0),
        paymentMethod: String(fd.get("paymentMethod") || "")
      },
      token
    );

    notify.promise(promise, {
      loading: "Agendando cita...",
      success: () => { form.reset(); loadAppointments(date, effectiveDoctorId); return "Cita agendada"; },
      successDesc: "La consulta fue registrada en la agenda.",
      error: "Error al agendar",
      errorDesc: (err) => err instanceof Error ? err.message : "Verifica los datos e intenta de nuevo.",
    });
  }

  const isConfirmed = (status: string) => status === "confirmed";
  const isCompleted = (status: string) => status === "completed";

  const statusLabel: Record<string, string> = {
    scheduled: "pendiente",
    confirmed: "confirmada",
    in_progress: "En consulta",
    completed: "finalizada",
    cancelled: "cancelada",
  };
  const statusClass: Record<string, string> = {
    scheduled: "status-unconfirmed",
    confirmed: "status-confirmed",
    in_progress: "status-in-progress",
    completed: "status-completed",
    cancelled: "status-cancelled",
  };

  const goToTreatment = async (row: AppointmentRow) => {
    if (row.status !== "in_progress") {
      try {
        await clinicalApi.updateAppointment(row.id, { status: "in_progress" }, token);
      } catch (_) { /* no bloquear si falla */ }
    }
    navigate(`/dashboard/consulta?appointmentId=${encodeURIComponent(row.id)}&patientId=${encodeURIComponent(row.patientId)}`);
  };

  function loadAppointments(forDate?: string, forDoctorId?: string) {
    const d = forDate ?? date;
    const did = forDoctorId ?? effectiveDoctorId;
    const promise = Promise.all([
      clinicalApi.listAppointments(did, d, token),
      clinicalApi.listPatients("", token)
    ]).then(([appointments, patients]) => {
      const patientById = new Map(
        (patients.items || []).map((patient) => [patient.id, `${patient.firstName} ${patient.lastName}`.trim()])
      );

      setRows((appointments.items || []).map((item) => ({
        id: item.id,
        patientId: item.patientId,
        patientName: patientById.get(item.patientId),
        startAt: item.startAt,
        endAt: item.endAt,
        durationMinutes: item.durationMinutes ?? 30,
        status: item.status,
        paymentAmount: item.paymentAmount,
        paymentPaid: item.paymentPaid,
        paymentMethod: item.paymentMethod,
        consentSummary: item.consentSummary,
      })));
      return appointments;
    });

    notify.promise(promise, {
      loading: "Sincronizando agenda...",
      success: (_r) => "Agenda actualizada",
      successDesc: (r) => `${r.items.length} citas encontradas.`,
      error: () => { setRows([]); return "Error de sincronización"; },
      errorDesc: (err) => err instanceof Error ? err.message : "Intenta de nuevo.",
    });
  }

  async function onConfirm(id: string) {
    const promise = clinicalApi.confirmAppointment(id, token);
    notify.promise(promise, {
      loading: "Confirmando cita...",
      success: () => { loadAppointments(date, effectiveDoctorId); return "Cita confirmada"; },
      error: "Error al confirmar",
    });
  }

  async function onResend(id: string) {
    const promise = clinicalApi.resendAppointmentConfirmation(id, token).then((r) => {
      loadAppointments(date, effectiveDoctorId);
      return r;
    });
    notify.promise(promise, {
      loading: "Reenviando confirmación...",
      success: () => "Confirmación reenviada",
      error: "Error al reenviar",
    });
  }

  async function onCancel(id: string) {
    if (!window.confirm("¿Cancelar esta cita?")) return;
    const promise = clinicalApi.updateAppointment(id, { status: "cancelled" }, token);
    notify.promise(promise, {
      loading: "Cancelando cita...",
      success: () => { loadAppointments(date, effectiveDoctorId); return "Cita cancelada"; },
      error: "Error al cancelar",
    });
  }

  function openPayModal(row: AppointmentRow) {
    setPayRow(row);
    setPayPaid(row.paymentPaid ?? false);
    setPayMethod(row.paymentMethod || "efectivo");
    setPayAmount(row.paymentAmount ?? 0);
  }

  async function savePayment() {
    if (!payRow) return;
    setPayingSaving(true);
    try {
      await clinicalApi.registerPayment(payRow.id, { paid: payPaid, paymentMethod: payMethod, paymentAmount: payAmount }, token);
      notify.success(payPaid ? "Pago registrado — cita finalizada" : "Marcado como pendiente de pago");
      setPayRow(null);
      loadAppointments(date, effectiveDoctorId);
    } catch (err) {
      notify.error("Error al registrar pago", err instanceof Error ? err.message : String(err));
    } finally {
      setPayingSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("¿Eliminar esta cita permanentemente?")) return;
    const promise = clinicalApi.deleteAppointment(id, token);
    notify.promise(promise, {
      loading: "Eliminando cita...",
      success: () => { loadAppointments(date, effectiveDoctorId); return "Cita eliminada"; },
      error: "Error al eliminar",
    });
  }

  return (
    <section className="page-section">
      {payRow && (
        <Modal onClose={() => setPayRow(null)}>
          <h3 style={{ marginBottom: 4 }}>Registrar Pago</h3>
          <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: 20 }}>
            Paciente: <strong>{payRow.patientName || payRow.patientId}</strong>
          </p>
          <div className="input-group">
            <label>Estado del pago</label>
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: payPaid ? 700 : 400 }}>
                <input type="radio" name="paid" checked={payPaid} onChange={() => setPayPaid(true)} />
                ✅ Pagó
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: !payPaid ? 700 : 400 }}>
                <input type="radio" name="paid" checked={!payPaid} onChange={() => setPayPaid(false)} />
                ⏳ Pendiente
              </label>
            </div>
          </div>
          {payPaid && (
            <>
              <div className="input-group">
                <label>Monto cobrado</label>
                <input
                  type="number" min={0} step={0.01}
                  className="elite-input"
                  value={payAmount}
                  onChange={e => setPayAmount(Number(e.target.value))}
                  placeholder="0.00"
                />
              </div>
              <div className="input-group">
                <label>Método de pago</label>
                <select className="elite-input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="zelle">Zelle</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button type="button" className="action-btn action-btn-confirm" onClick={savePayment} disabled={payingSaving}>
              {payingSaving ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" className="action-btn" onClick={() => setPayRow(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
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
              {["07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30",
                "11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30",
                "15:00","15:30","16:00","16:30","17:00","17:30","18:00"].map((s) => {
                const [h, m] = s.split(":").map(Number);
                const ampm = h >= 12 ? "PM" : "AM";
                const h12 = h % 12 || 12;
                const label = `${String(h12).padStart(2,"0")}:${String(m).padStart(2,"0")} ${ampm}`;
                return <option key={s} value={s}>{label}</option>;
              })}
            </select>
          </div>
          <div className="input-group">
            <label>Bloque de tiempo</label>
            <select value={editDuration} onChange={(e) => setEditDuration(Number(e.target.value))}>
              {DURATION_BLOCKS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button type="button" className="action-btn action-btn-confirm" onClick={saveEdit} disabled={saving}>Guardar</button>
            <button type="button" className="action-btn" onClick={() => setEditRow(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
      <div className="grid-2-cols">
        <article className="card elite-card">
          <header className="card-header">
            <h3>Nueva Cita Médica</h3>
          </header>
          <form className="card-form" onSubmit={onCreate}>
            {canSelectDoctor && (
              <div className="input-group">
                <label>Doctor</label>
                <DoctorSearch
                  doctors={doctors}
                  onDoctorSelect={(d) => setSelectedDoctorId(d.id)}
                />
              </div>
            )}
            <div className="input-group">
              <label>Paciente</label>
              <PatientSearch doctorId="" token={token} onPatientSelect={setSelectedPatient} />
              <input type="hidden" name="patientId" value={selectedPatient?.id || ''} />
            </div>
            <div className="row-inputs">
              <div className="input-group">
                <label>Fecha</label>
                <DatePicker value={createDate} onChange={setCreateDate} name="date" required />
              </div>
              <div className="input-group">
                <label>Hora de inicio</label>
                <select name="time" required>
                  <option value="">Seleccione una hora</option>
                  <option value="07:00">07:00 AM</option>
                  <option value="07:30">07:30 AM</option>
                  <option value="08:00">08:00 AM</option>
                  <option value="08:30">08:30 AM</option>
                  <option value="09:00">09:00 AM</option>
                  <option value="09:30">09:30 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="10:30">10:30 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="11:30">11:30 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="12:30">12:30 PM</option>
                  <option value="13:00">01:00 PM</option>
                  <option value="13:30">01:30 PM</option>
                  <option value="14:00">02:00 PM</option>
                  <option value="14:30">02:30 PM</option>
                  <option value="15:00">03:00 PM</option>
                  <option value="15:30">03:30 PM</option>
                  <option value="16:00">04:00 PM</option>
                  <option value="16:30">04:30 PM</option>
                  <option value="17:00">05:00 PM</option>
                  <option value="17:30">05:30 PM</option>
                  <option value="18:00">06:00 PM</option>
                </select>
              </div>
            </div>
            <div className="input-group">
              <label>Bloque de tiempo</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                required
              >
                {DURATION_BLOCKS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>
            <button type="submit">Confirmar Espacio</button>
          </form>
        </article>

        <article className="card elite-card">
          <header className="card-header">
            <h3>Control de Agenda</h3>
          </header>
          <div className="card-form">
            <div className="input-group">
              <label>Fecha de Consulta</label>
              <div className="inline-actions">
                <DatePicker value={date} onChange={(v) => { setDate(v); }} />
                <button type="button" onClick={() => loadAppointments(date, effectiveDoctorId)}>Actualizar</button>
              </div>
            </div>
          </div>
        </article>
      </div>

      <article className="card elite-card" style={{ marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Calendario Diario de Atención</h3>
          <button type="button" className="agenda-btn" onClick={() => loadAppointments(date, effectiveDoctorId)} title="Actualizar agenda">
            <RefreshCw size={13} strokeWidth={1.5} />
            <span>Actualizar</span>
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Paciente</th>
                <th>Horario</th>
                <th>Estado</th>
                <th>Consentimientos</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.id.split("-")[0]}...</td>
                  <td>
                    <strong>{row.patientName || row.patientId}</strong>
                  </td>
                  <td>{formatTimeRange(row.startAt, row.endAt)}</td>
                  <td>
                    <span className={`badge ${statusClass[row.status] ?? "status-unconfirmed"}`}>
                      {statusLabel[row.status] ?? row.status}
                    </span>
                  </td>
                  <td>
                    {row.consentSummary && row.consentSummary.total > 0 ? (
                      row.consentSummary.accepted >= row.consentSummary.total ? (
                        <span className="badge badge-success" title="Todos firmados">Completo</span>
                      ) : (
                        <span className="badge badge-neutral" title="Pendientes">Pendiente</span>
                      )
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {canWriteAppointments(session) && !isCompleted(row.status) && row.status !== "cancelled" && (
                        <button type="button" className="action-btn" onClick={() => openEdit(row)}>
                          <span className="icon">✏️</span>
                          <span>Editar</span>
                        </button>
                      )}
                      {canWriteAppointments(session) && !isConfirmed(row.status) && !isCompleted(row.status) && row.status !== "cancelled" && (
                        <button type="button" className="action-btn action-btn-confirm" onClick={() => onConfirm(row.id)}>
                          <span className="icon">✓</span>
                          <span>Confirmar</span>
                        </button>
                      )}
                      {canWriteAppointments(session) && !isCompleted(row.status) && row.status !== "cancelled" && (
                        <button type="button" className="action-btn" onClick={() => onCancel(row.id)}>
                          <span className="icon">✕</span>
                          <span>Cancelar</span>
                        </button>
                      )}
                      {canWriteAppointments(session) && !isCompleted(row.status) && row.status !== "in_progress" && row.status !== "cancelled" && !(row.consentSummary && row.consentSummary.total > 0 && row.consentSummary.accepted >= row.consentSummary.total) && (
                        <button type="button" className="action-btn" onClick={() => onResend(row.id)}>
                          <span className="icon">✉️</span>
                          <span>Reenviar</span>
                        </button>
                      )}
                      {canWriteAppointments(session) && isCompleted(row.status) && (
                        <button
                          type="button"
                          className="agenda-btn"
                          style={{ background: row.paymentPaid ? "#d1fae5" : "#fef3c7", color: row.paymentPaid ? "#065f46" : "#92400e", borderColor: row.paymentPaid ? "#6ee7b7" : "#fcd34d", opacity: row.paymentPaid ? 0.7 : 1, cursor: row.paymentPaid ? "default" : "pointer" }}
                          onClick={() => !row.paymentPaid && openPayModal(row)}
                          disabled={row.paymentPaid}
                          title={row.paymentPaid ? "Pago ya registrado" : "Registrar pago"}
                        >
                          <span>{row.paymentPaid ? "💰 Pagado" : "💳 Registrar Pago"}</span>
                        </button>
                      )}
                      {canManageTreatments(session) && !isCompleted(row.status) && row.status !== "cancelled" && (
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
                      {canDeleteAppointments(session) && (
                        <button type="button" className="action-btn action-btn-delete" onClick={() => onDelete(row.id)}>
                          <span className="icon">🗑️</span>
                          <span>Eliminar</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">Sin citas programadas para esta fecha.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

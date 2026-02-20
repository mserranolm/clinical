import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clinicalApi } from "../api/clinical";
import { notify } from "../lib/notify";
import { PatientSearch } from "../modules/appointments/components/PatientSearch";
import { DoctorSearch } from "../modules/appointments/components/DoctorSearch";
import { canDeleteAppointments, canWriteAppointments, canManageTreatments } from "../lib/rbac";
import type { AuthSession } from "../types";

type AppointmentRow = {
  id: string;
  patientId: string;
  patientName?: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: string;
  paymentAmount?: number;
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
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; firstName: string; lastName: string; } | null>(null);
  const [duration, setDuration] = useState<number>(30);

  const isDoctor = session.role === "doctor";
  const canSelectDoctor = session.role === "admin" || session.role === "assistant";
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");

  useEffect(() => {
    if (canSelectDoctor && session.orgId) {
      clinicalApi.listOrgUsers(session.orgId, token).then((res) => {
        const docs = (res.items ?? []).filter((u) => u.role === "doctor" && u.status === "active");
        setDoctors(docs.map((u) => ({ id: u.id, name: u.name })));
        if (docs.length > 0) setSelectedDoctorId(docs[0].id);
      }).catch(() => {});
    }
  }, [canSelectDoctor, session.orgId]);

  const effectiveDoctorId = isDoctor ? doctorId : selectedDoctorId;

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;

    if (canSelectDoctor && !selectedDoctorId) {
      notify.error("Selecciona un doctor", "Debes asignar un doctor a la cita.");
      return;
    }
    const startAt = new Date(`${fd.get('date')}T${fd.get('time')}`).toISOString();
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
      success: () => { form.reset(); loadAppointments(); return "Cita agendada"; },
      successDesc: "La consulta fue registrada en la agenda.",
      error: "Error al agendar",
      errorDesc: (err) => err instanceof Error ? err.message : "Verifica los datos e intenta de nuevo.",
    });
  }

  const isConfirmed = (status: string) => status === "confirmed";

  const goToTreatment = (row: AppointmentRow) => {
    navigate(`/dashboard/nuevo-tratamiento?patientId=${encodeURIComponent(row.patientId)}`);
  };

  function loadAppointments() {
    const promise = Promise.all([
      clinicalApi.listAppointments(effectiveDoctorId, date, token),
      clinicalApi.listPatients(effectiveDoctorId, token)
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
        paymentAmount: item.paymentAmount
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
      success: () => { loadAppointments(); return "Cita confirmada"; },
      error: "Error al confirmar",
    });
  }

  async function onResend(id: string) {
    const promise = clinicalApi.resendAppointmentConfirmation(id, token);
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
      success: () => { loadAppointments(); return "Cita cancelada"; },
      error: "Error al cancelar",
    });
  }

  async function onDelete(id: string) {
    if (!window.confirm("¿Eliminar esta cita permanentemente?")) return;
    const promise = clinicalApi.deleteAppointment(id, token);
    notify.promise(promise, {
      loading: "Eliminando cita...",
      success: () => { loadAppointments(); return "Cita eliminada"; },
      error: "Error al eliminar",
    });
  }

  return (
    <section className="page-section">
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
              <PatientSearch doctorId={effectiveDoctorId} token={token} onPatientSelect={setSelectedPatient} />
              <input type="hidden" name="patientId" value={selectedPatient?.id || ''} />
            </div>
            <div className="row-inputs">
              <div className="input-group">
                <label>Fecha</label>
                <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
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
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <button type="button" onClick={loadAppointments}>Actualizar</button>
              </div>
            </div>
          </div>
        </article>
      </div>

      <article className="card elite-card" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Calendario Diario de Atención</h3>
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
                  <td>
                    <strong>{row.patientName || row.patientId}</strong>
                  </td>
                  <td>{formatTimeRange(row.startAt, row.endAt)}</td>
                  <td>
                    <span className={`badge ${isConfirmed(row.status) ? "status-confirmed" : "status-unconfirmed"}`}>
                      {isConfirmed(row.status) ? "confirmada" : "no confirmada"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {canWriteAppointments(session) && !isConfirmed(row.status) && row.status !== "cancelled" && (
                        <button type="button" className="action-btn action-btn-confirm" onClick={() => onConfirm(row.id)}>
                          <span className="icon">✓</span>
                          <span>Confirmar</span>
                        </button>
                      )}
                      {canWriteAppointments(session) && row.status !== "cancelled" && (
                        <button type="button" className="action-btn" onClick={() => onCancel(row.id)}>
                          <span className="icon">✕</span>
                          <span>Cancelar</span>
                        </button>
                      )}
                      {canWriteAppointments(session) && (
                        <button type="button" className="action-btn" onClick={() => onResend(row.id)}>
                          <span className="icon">✉️</span>
                          <span>Reenviar</span>
                        </button>
                      )}
                      {canManageTreatments(session) && (
                        <button type="button" className="action-btn action-btn-treat" onClick={() => goToTreatment(row)}>
                          <span>Atender</span>
                          <span className="icon">→</span>
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
                  <td colSpan={5} className="empty-state">Sin citas programadas para esta fecha.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

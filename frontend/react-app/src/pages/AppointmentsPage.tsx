import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clinicalApi } from "../api/clinical";
import { notify } from "../lib/notify";
import { PatientSearch } from "../modules/appointments/components/PatientSearch";

type AppointmentRow = {
  id: string;
  patientId: string;
  patientName?: string;
  startAt: string;
  status: string;
  paymentAmount?: number;
};

export function AppointmentsPage({ token, doctorId }: { token: string; doctorId: string }) {
  const navigate = useNavigate();
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; firstName: string; lastName: string; } | null>(null);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;

    const promise = clinicalApi.createAppointment(
      {
        doctorId,
        patientId: selectedPatient?.id || '',
        startAt: new Date(`${fd.get('date')}T${fd.get('time')}`).toISOString(),
        endAt: new Date(new Date(`${fd.get('date')}T${fd.get('time')}`).getTime() + 30 * 60000).toISOString(),
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
      clinicalApi.listAppointments(doctorId, date, token),
      clinicalApi.listPatients(doctorId, token)
    ]).then(([appointments, patients]) => {
      const patientById = new Map(
        (patients.items || []).map((patient) => [patient.id, `${patient.firstName} ${patient.lastName}`.trim()])
      );

      setRows((appointments.items || []).map((item) => ({
        id: item.id,
        patientId: item.patientId,
        patientName: patientById.get(item.patientId),
        startAt: item.startAt,
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

  return (
    <section className="page-section">
      <div className="grid-2-cols">
        <article className="card elite-card">
          <header className="card-header">
            <h3>Nueva Cita Médica</h3>
          </header>
          <form className="card-form" onSubmit={onCreate}>
            <div className="input-group">
              <label>Paciente</label>
              <PatientSearch doctorId={doctorId} token={token} onPatientSelect={setSelectedPatient} />
              <input type="hidden" name="patientId" value={selectedPatient?.id || ''} />
            </div>
            <div className="row-inputs">
              <div className="input-group">
                <label>Fecha</label>
                <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="input-group">
                <label>Hora</label>
                <select name="time" required>
                  <option value="">Seleccione una hora</option>
                  <option value="09:00">09:00 AM</option>
                  <option value="09:30">09:30 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="10:30">10:30 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="11:30">11:30 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="12:30">12:30 PM</option>
                  <option value="14:00">02:00 PM</option>
                  <option value="14:30">02:30 PM</option>
                  <option value="15:00">03:00 PM</option>
                  <option value="15:30">03:30 PM</option>
                  <option value="16:00">04:00 PM</option>
                  <option value="16:30">04:30 PM</option>
                </select>
              </div>
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
                  <td>{new Date(row.startAt).toLocaleTimeString()}</td>
                  <td>
                    <span className={`badge ${isConfirmed(row.status) ? "status-confirmed" : "status-unconfirmed"}`}>
                      {isConfirmed(row.status) ? "confirmada" : "no confirmada"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      {!isConfirmed(row.status) ? (
                        <button type="button" className="action-btn action-btn-confirm" onClick={() => onConfirm(row.id)}>
                          <span className="icon">✓</span>
                          <span>Confirmar</span>
                        </button>
                      ) : null}
                      <button type="button" className="action-btn action-btn-treat" onClick={() => goToTreatment(row)}>
                        <span>Atender</span>
                        <span className="icon">→</span>
                      </button>
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

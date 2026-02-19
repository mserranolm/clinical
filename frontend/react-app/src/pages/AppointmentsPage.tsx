import { FormEvent, useState } from "react";
import { clinicalApi } from "../api/clinical";
import { notify } from "../lib/notify";

type AppointmentRow = {
  id: string;
  patientId: string;
  startAt: string;
  status: string;
  paymentAmount?: number;
};

export function AppointmentsPage({ token, doctorId }: { token: string; doctorId: string }) {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<AppointmentRow[]>([]);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;

    const promise = clinicalApi.createAppointment(
      {
        doctorId,
        patientId: String(fd.get("patientId") || ""),
        startAt: new Date(String(fd.get("startAt") || "")).toISOString(),
        endAt: new Date(String(fd.get("endAt") || "")).toISOString(),
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

  function loadAppointments() {
    const promise = clinicalApi.listAppointments(doctorId, date, token).then((result) => {
      setRows(result.items.map((item) => ({
        id: item.id,
        patientId: item.patientId,
        startAt: item.startAt,
        status: item.status,
        paymentAmount: item.paymentAmount
      })));
      return result;
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
              <label>Paciente (ID)</label>
              <input name="patientId" placeholder="pat_..." required />
            </div>
            <div className="row-inputs">
              <div className="input-group">
                <label>Inicio</label>
                <input name="startAt" type="datetime-local" required />
              </div>
              <div className="input-group">
                <label>Fin</label>
                <input name="endAt" type="datetime-local" required />
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
                  <td><strong>{row.patientId}</strong></td>
                  <td>{new Date(row.startAt).toLocaleTimeString()}</td>
                  <td><span className={`badge status-${row.status}`}>{row.status}</span></td>
                  <td>
                    {row.status === "scheduled" && (
                      <button type="button" className="ghost mini-btn" onClick={() => onConfirm(row.id)}>
                        Confirmar
                      </button>
                    )}
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

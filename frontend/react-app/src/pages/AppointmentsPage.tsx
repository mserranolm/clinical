import { FormEvent, useState } from "react";
import { clinicalApi } from "../api/clinical";
import { SectionResult, type ActionState } from "../components/ui/SectionResult";

type AppointmentRow = {
  id: string;
  patientId: string;
  startAt: string;
  status: string;
  paymentAmount?: number;
};

export function AppointmentsPage({ token, doctorId }: { token: string; doctorId: string }) {
  const [state, setState] = useState<ActionState>({ status: "idle", title: "" });
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<AppointmentRow[]>([]);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ status: "loading", title: "Agendando cita..." });
    try {
      const result = await clinicalApi.createAppointment(
        {
          doctorId: String(fd.get("doctorId") || doctorId),
          patientId: String(fd.get("patientId") || ""),
          startAt: new Date(String(fd.get("startAt") || "")).toISOString(),
          endAt: new Date(String(fd.get("endAt") || "")).toISOString(),
          treatmentPlan: String(fd.get("treatmentPlan") || ""),
          paymentAmount: Number(fd.get("paymentAmount") || 0),
          paymentMethod: String(fd.get("paymentMethod") || "")
        },
        token
      );
      setState({ status: "success", title: "Cita agendada correctamente", payload: result });
      e.currentTarget.reset();
      await loadAppointments();
    } catch (error) {
      setState({ status: "error", title: "Fallo al agendar", payload: { error: String(error) } });
    }
  }

  async function loadAppointments() {
    setState({ status: "loading", title: "Sincronizando agenda..." });
    try {
      const result = await clinicalApi.listAppointments(doctorId, date, token);
      setRows(
        result.items.map((item) => ({
          id: item.id,
          patientId: item.patientId,
          startAt: item.startAt,
          status: item.status,
          paymentAmount: item.paymentAmount
        }))
      );
      setState({ status: "success", title: "Agenda actualizada", payload: { total: result.items.length } });
    } catch (error) {
      setState({ status: "error", title: "Error de sincronización", payload: { error: String(error) } });
      setRows([]);
    }
  }

  async function onConfirm(id: string) {
    await clinicalApi.confirmAppointment(id, token);
    await loadAppointments();
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
          <SectionResult state={state} />
        </article>
      </div>

      <article className="chart-card elite-card">
        <h3>Calendario Diario de Atención</h3>
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
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state">Sin citas programadas para esta fecha.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

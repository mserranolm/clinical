import { FormEvent, useState } from "react";
import { clinicalApi } from "../api/clinical";
import { SectionResult, type ActionState } from "../components/ui/SectionResult";

export function OdontogramPage({ token, doctorId }: { token: string; doctorId: string }) {
  const [state, setState] = useState<ActionState>({ status: "idle", title: "" });
  const [patientId, setPatientId] = useState<string>("");
  const [rows, setRows] = useState<Array<{ id: string; patientId: string; teeth: number }>>([]);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ status: "loading", title: "Inicializando mapeo dental..." });
    try {
      const result = await clinicalApi.createOdontogram(
        {
          doctorId: String(fd.get("doctorId") || doctorId),
          patientId: String(fd.get("patientId") || "")
        },
        token
      );
      setState({ status: "success", title: "Odontograma inicializado", payload: result });
      setRows((prev) => [{ id: result.id, patientId: result.patientId, teeth: 32 }, ...prev]);
      e.currentTarget.reset();
    } catch (error) {
      setState({ status: "error", title: "Fallo en inicialización", payload: { error: String(error) } });
    }
  }

  async function onFind() {
    if (!patientId.trim()) return;
    setState({ status: "loading", title: "Consultando registros..." });
    try {
      const result = await clinicalApi.getOdontogramByPatient(patientId.trim(), token);
      const teethCount = Array.isArray(result.teeth) ? result.teeth.length : 0;
      setRows((prev) => [
        { id: result.id, patientId: result.patientId, teeth: teethCount },
        ...prev.filter((r) => r.id !== result.id)
      ]);
      setState({ status: "success", title: "Odontograma localizado", payload: result });
    } catch (error) {
      setState({ status: "error", title: "No se encontró registro dental", payload: { error: String(error) } });
    }
  }

  return (
    <section className="page-section">
      <div className="grid-2-cols">
        <article className="card elite-card">
          <header className="card-header">
            <h3>Nuevo Odontograma</h3>
          </header>
          <form className="card-form" onSubmit={onCreate}>
            <div className="input-group">
              <label>ID Paciente</label>
              <input name="patientId" placeholder="pat_..." required />
            </div>
            <button type="submit">Generar Mapeo 32 Piezas</button>
          </form>
        </article>

        <article className="card elite-card">
          <header className="card-header">
            <h3>Consulta Clínica</h3>
          </header>
          <div className="card-form">
            <div className="input-group">
              <label>Referencia del Paciente</label>
              <div className="inline-actions">
                <input value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="pat_..." />
                <button type="button" onClick={onFind}>Cargar Mapeo</button>
              </div>
            </div>
          </div>
          <SectionResult state={state} />
        </article>
      </div>

      <article className="chart-card elite-card">
        <h3>Historial de Mapeos Dentales</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Paciente</th>
                <th>Piezas Mapeadas</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.id}</td>
                  <td><strong>{row.patientId}</strong></td>
                  <td>{row.teeth} / 32</td>
                  <td><button className="ghost mini-btn">Ver Detalle</button></td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-state">Sin registros dentales previos.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

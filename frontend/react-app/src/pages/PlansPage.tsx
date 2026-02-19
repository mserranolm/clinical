import { FormEvent, useState } from "react";
import { clinicalApi } from "../api/clinical";
import { notify } from "../lib/notify";

export function PlansPage({ token, doctorId }: { token: string; doctorId: string }) {
  const [planId, setPlanId] = useState<string>("");
  const [patientId, setPatientId] = useState<string>("");
  const [rows, setRows] = useState<Array<{ id: string; title: string; status?: string; patientId: string }>>([]);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;
    const promise = clinicalApi.createTreatmentPlan(
        {
          doctorId: String(fd.get("doctorId") || doctorId),
          patientId: String(fd.get("patientId") || ""),
          odontogramId: String(fd.get("odontogramId") || ""),
          title: String(fd.get("title") || ""),
          description: String(fd.get("description") || "")
        },
      token
    );
    notify.promise(promise, {
      loading: "Generando propuesta...",
      success: (result) => { setRows((prev) => [{ id: result.id, title: fd.get("title") as string, status: result.status, patientId: result.patientId }, ...prev]); form.reset(); return "Plan de tratamiento creado"; },
      successDesc: String(fd.get("title") || ""),
      error: "Fallo en generación",
      errorDesc: (err) => err instanceof Error ? err.message : "Intenta de nuevo.",
    });
  }

  async function onGetById() {
    if (!planId.trim()) return;
    const promise = clinicalApi.getTreatmentPlan(planId.trim(), token);
    notify.promise(promise, {
      loading: "Recuperando plan...",
      success: (result) => { setRows((prev) => [{ id: result.id, title: result.title, status: result.status, patientId: result.patientId }, ...prev.filter((p) => p.id !== result.id)]); return "Plan recuperado"; },
      successDesc: (result) => result.title,
      error: "Plan no encontrado",
      errorDesc: (err) => err instanceof Error ? err.message : "Verifica el ID.",
    });
  }

  async function onGetByPatient() {
    if (!patientId.trim()) return;
    const promise = clinicalApi.getTreatmentPlansByPatient(patientId.trim(), token);
    notify.promise(promise, {
      loading: "Consultando historial...",
      success: (result) => { setRows(result.treatmentPlans.map((p) => ({ id: p.id, title: p.title, status: p.status, patientId: p.patientId }))); return "Historial cargado"; },
      successDesc: (result) => `${result.treatmentPlans.length} planes encontrados.`,
      error: "Sin planes para este paciente",
      errorDesc: (err) => err instanceof Error ? err.message : "Intenta de nuevo.",
    });
  }

  return (
    <section className="page-section">
      <div className="grid-2-cols">
        <article className="card elite-card">
          <header className="card-header">
            <h3>Nueva Propuesta de Tratamiento</h3>
          </header>
          <form className="card-form" onSubmit={onCreate}>
            <div className="row-inputs">
              <div className="input-group">
                <label>Paciente</label>
                <input name="patientId" placeholder="pat_..." required />
              </div>
              <div className="input-group">
                <label>Odontograma (Ref)</label>
                <input name="odontogramId" placeholder="odn_..." />
              </div>
            </div>
            <div className="input-group">
              <label>Título del Plan</label>
              <input name="title" placeholder="Ej. Rehabilitación Oral Completa" required />
            </div>
            <div className="input-group">
              <label>Observaciones Clínicas</label>
              <textarea name="description" rows={3} placeholder="Detalles de la propuesta..." />
            </div>
            <button type="submit">Generar Propuesta</button>
          </form>
        </article>

        <article className="card elite-card">
          <header className="card-header">
            <h3>Gestión de Propuestas</h3>
          </header>
          <div className="card-form">
            <div className="input-group">
              <label>Búsqueda por ID</label>
              <div className="inline-actions">
                <input value={planId} onChange={(e) => setPlanId(e.target.value)} placeholder="plan_..." />
                <button type="button" onClick={onGetById}>Cargar</button>
              </div>
            </div>
            <div className="input-group">
              <label>Filtrar por Paciente</label>
              <div className="inline-actions">
                <input value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="pat_..." />
                <button type="button" onClick={onGetByPatient}>Listar</button>
              </div>
            </div>
          </div>
        </article>
      </div>

      <article className="chart-card elite-card">
        <h3>Planes de Tratamiento Activos</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Paciente</th>
                <th>Propuesta</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.id}</td>
                  <td><strong>{row.patientId}</strong></td>
                  <td>{row.title}</td>
                  <td><span className={`badge status-${row.status || 'proposed'}`}>{row.status || 'proposed'}</span></td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-state">Sin propuestas de tratamiento activas.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

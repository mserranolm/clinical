import { FormEvent, useState } from "react";
import { clinicalApi } from "../api/clinical";
import { SectionResult, type ActionState } from "../components/ui/SectionResult";

export function PatientsPage({ token, doctorId }: { token: string; doctorId: string }) {
  const [state, setState] = useState<ActionState>({ status: "idle", title: "" });
  const [searchId, setSearchId] = useState<string>("");
  const [rows, setRows] = useState<Array<{ id: string; name: string; email?: string; phone?: string }>>([]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ status: "loading", title: "Procesando registro..." });
    try {
      const result = await clinicalApi.onboardPatient(
        {
          doctorId: String(fd.get("doctorId") || doctorId),
          specialty: String(fd.get("specialty") || "odontology"),
          firstName: String(fd.get("firstName") || ""),
          lastName: String(fd.get("lastName") || ""),
          phone: String(fd.get("phone") || ""),
          email: String(fd.get("email") || ""),
          birthDate: String(fd.get("birthDate") || ""),
          documentId: String(fd.get("documentId") || ""),
          medicalBackgrounds: [],
          imageKeys: []
        },
        token
      );
      setState({ status: "success", title: "Registro completado con éxito", payload: result });
      e.currentTarget.reset();
      setRows((prev) => [{ id: String(result.id), name: `${fd.get("firstName")} ${fd.get("lastName")}` }, ...prev]);
    } catch (error) {
      setState({ status: "error", title: "Error en registro", payload: { error: String(error) } });
    }
  }

  async function onFindPatient() {
    if (!searchId.trim()) return;
    setState({ status: "loading", title: "Localizando expediente..." });
    try {
      const result = await clinicalApi.getPatient(searchId.trim(), token);
      setRows((prev) => [
        {
          id: result.id,
          name: `${result.firstName} ${result.lastName}`,
          email: result.email,
          phone: result.phone
        },
        ...prev.filter((item) => item.id !== result.id)
      ]);
      setState({ status: "success", title: "Expediente localizado", payload: result });
    } catch (error) {
      setState({ status: "error", title: "No se encontró el paciente", payload: { error: String(error) } });
    }
  }

  return (
    <section className="page-section">
      <div className="grid-2-cols">
        <article className="card elite-card">
          <header className="card-header">
            <h3>Registro de Paciente</h3>
          </header>
          <form className="card-form" onSubmit={onSubmit}>
            <div className="input-group">
              <label>Doctor Responsable</label>
              <input name="doctorId" placeholder="ID del Médico" />
            </div>
            <div className="row-inputs">
              <div className="input-group">
                <label>Nombre(s)</label>
                <input name="firstName" required />
              </div>
              <div className="input-group">
                <label>Apellido(s)</label>
                <input name="lastName" required />
              </div>
            </div>
            <div className="input-group">
              <label>Email de contacto</label>
              <input name="email" type="email" />
            </div>
            <button type="submit">Guardar Onboarding</button>
          </form>
        </article>

        <article className="card elite-card">
          <header className="card-header">
            <h3>Búsqueda Avanzada</h3>
          </header>
          <div className="card-form">
            <div className="input-group">
              <label>ID de Paciente (Referencia)</label>
              <div className="inline-actions">
                <input value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="pat_..." />
                <button type="button" onClick={onFindPatient}>Localizar</button>
              </div>
            </div>
          </div>
          <SectionResult state={state} />
        </article>
      </div>

      <article className="chart-card elite-card">
        <h3>Historial de Consultas Recientes</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Nombre Completo</th>
                <th>Contacto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.id}</td>
                  <td><strong>{row.name}</strong></td>
                  <td>{row.email || row.phone || "-"}</td>
                  <td><span className="badge status-scheduled">Activo</span></td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-state">No hay registros en la sesión actual.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

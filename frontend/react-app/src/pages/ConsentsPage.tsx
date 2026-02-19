import { FormEvent, useState } from "react";
import { clinicalApi } from "../api/clinical";
import { SectionResult, type ActionState } from "../components/ui/SectionResult";

export function ConsentsPage({ token, doctorId }: { token: string; doctorId: string }) {
  const [state, setState] = useState<ActionState>({ status: "idle", title: "" });
  const [verifyId, setVerifyId] = useState<string>("");
  const [rows, setRows] = useState<Array<{ id: string; status: string; title?: string }>>([]);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ status: "loading", title: "Generando documento legal..." });
    try {
      const result = await clinicalApi.createConsent(
        {
          doctorId: String(fd.get("doctorId") || doctorId),
          patientId: String(fd.get("patientId") || ""),
          title: String(fd.get("title") || ""),
          content: String(fd.get("content") || ""),
          deliveryMethod: String(fd.get("deliveryMethod") || "email") as "email" | "sms"
        },
        token
      );
      setState({ status: "success", title: "Documento enviado para firma", payload: result });
      setRows((prev) => [{ id: result.id, status: result.status, title: result.title }, ...prev]);
      e.currentTarget.reset();
    } catch (error) {
      setState({ status: "error", title: "Fallo en generación", payload: { error: String(error) } });
    }
  }

  async function onVerify() {
    if (!verifyId.trim()) return;
    setState({ status: "loading", title: "Verificando integridad..." });
    try {
      const result = await clinicalApi.verifyConsent(verifyId.trim());
      setRows((prev) => [{ id: result.id, status: result.status }, ...prev.filter((r) => r.id !== result.id)]);
      setState({ status: "success", title: "Documento validado", payload: result });
    } catch (error) {
      setState({ status: "error", title: "Fallo en verificación", payload: { error: String(error) } });
    }
  }

  return (
    <section className="page-section">
      <div className="grid-2-cols">
        <article className="card elite-card">
          <header className="card-header">
            <h3>Emisión de Consentimiento</h3>
          </header>
          <form className="card-form" onSubmit={onCreate}>
            <div className="row-inputs">
              <div className="input-group">
                <label>ID Paciente</label>
                <input name="patientId" placeholder="pat_..." required />
              </div>
              <div className="input-group">
                <label>Canal de Envío</label>
                <select name="deliveryMethod" defaultValue="email">
                  <option value="email">Email Certificado</option>
                  <option value="sms">SMS Directo</option>
                </select>
              </div>
            </div>
            <div className="input-group">
              <label>Título del Procedimiento</label>
              <input name="title" placeholder="Ej. Extracción de Tercer Molar" required />
            </div>
            <div className="input-group">
              <label>Cláusulas y Declaraciones</label>
              <textarea name="content" rows={4} placeholder="Contenido legal del documento..." required />
            </div>
            <button type="submit">Generar y Enviar</button>
          </form>
        </article>

        <article className="card elite-card">
          <header className="card-header">
            <h3>Verificación de Firma</h3>
          </header>
          <div className="card-form">
            <div className="input-group">
              <label>ID de Consentimiento (Referencia)</label>
              <div className="inline-actions">
                <input value={verifyId} onChange={(e) => setVerifyId(e.target.value)} placeholder="cns_..." />
                <button type="button" onClick={onVerify}>Validar</button>
              </div>
            </div>
          </div>
          <SectionResult state={state} />
        </article>
      </div>

      <article className="chart-card elite-card">
        <h3>Registro de Documentos Emitidos</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Título del Documento</th>
                <th>Estado Legal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.id}</td>
                  <td><strong>{row.title || "Consentimiento Informado"}</strong></td>
                  <td><span className={`badge status-${row.status}`}>{row.status}</span></td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="empty-state">No hay documentos registrados en esta vista.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

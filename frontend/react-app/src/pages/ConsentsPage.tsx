import { FormEvent, useState } from "react";
import { clinicalApi } from "../api/clinical";
import { notify } from "../lib/notify";

export function ConsentsPage({ token, doctorId }: { token: string; doctorId: string }) {
  const [verifyId, setVerifyId] = useState<string>("");
  const [rows, setRows] = useState<Array<{ id: string; status: string; title?: string }>>([]);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;
    const promise = clinicalApi.createConsent(
      {
          doctorId: String(fd.get("doctorId") || doctorId),
          patientId: String(fd.get("patientId") || ""),
          title: String(fd.get("title") || ""),
          content: String(fd.get("content") || ""),
          deliveryMethod: String(fd.get("deliveryMethod") || "email") as "email" | "sms"
      },
      token
    );
    notify.promise(promise, {
      loading: "Generando documento legal...",
      success: (result) => { setRows((prev) => [{ id: result.id, status: result.status, title: result.title }, ...prev]); form.reset(); return "Documento enviado para firma"; },
      successDesc: (result) => result.title,
      error: "Fallo en generación",
      errorDesc: (err) => err instanceof Error ? err.message : "Intenta de nuevo.",
    });
  }

  async function onVerify() {
    if (!verifyId.trim()) return;
    const promise = clinicalApi.verifyConsent(verifyId.trim());
    notify.promise(promise, {
      loading: "Verificando integridad...",
      success: (result) => { setRows((prev) => [{ id: result.id, status: result.status }, ...prev.filter((r) => r.id !== result.id)]); return "Documento validado"; },
      successDesc: (result) => `Estado: ${result.status}`,
      error: "Fallo en verificación",
      errorDesc: (err) => err instanceof Error ? err.message : "Intenta de nuevo.",
    });
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

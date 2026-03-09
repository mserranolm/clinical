import { useEffect, useState } from "react";
import { clinicalApi } from "../api/clinical";
import { notify } from "../lib/notify";
import type { AuthSession } from "../types";
import { FileText, Printer } from "lucide-react";
import { canManageTreatments } from "../lib/rbac";

export function DocumentosPage({ token, session }: { token: string; session: AuthSession }) {
  const [doctorName, setDoctorName] = useState(session.name || "");
  const [specialty, setSpecialty] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [docTitle, setDocTitle] = useState("CONSENTIMIENTO INFORMADO");
  const [procedureName, setProcedureName] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [showPatientList, setShowPatientList] = useState(false);
  const [content, setContent] = useState("");
  const [complications, setComplications] = useState("");
  const [benefits, setBenefits] = useState("");
  const [consentText, setConsentText] = useState(
    "Yo, el/la paciente arriba identificado/a, declaro que he sido informado/a de manera clara y comprensible sobre el procedimiento a realizarme, sus riesgos, beneficios y alternativas. Doy mi consentimiento libre y voluntario para la realización del mismo."
  );

  const canEdit = canManageTreatments(session);

  useEffect(() => {
    clinicalApi.listPatients("", token).then(res => {
      setPatients(res.items || []);
    }).catch(() => {});
  }, [token]);

  const filteredPatients = patientSearch
    ? patients.filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(patientSearch.toLowerCase()))
    : [];

  function printDocument() {
    const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${docTitle}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #1e293b; padding: 30px 40px; }
  .header { border-bottom: 2px solid #0369a1; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header-left h1 { font-size: 14pt; color: #0369a1; margin-bottom: 4px; }
  .header-left p { font-size: 9pt; color: #64748b; margin: 2px 0; }
  .doc-title { text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; color: #0f172a; margin-bottom: 24px; letter-spacing: 1px; }
  .section { margin-bottom: 18px; }
  .section-label { font-size: 9pt; font-weight: bold; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; }
  .field-row { display: flex; gap: 24px; margin-bottom: 10px; }
  .field { flex: 1; border-bottom: 1px solid #94a3b8; padding-bottom: 2px; min-height: 22px; font-size: 11pt; }
  .field-label { font-size: 8pt; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
  .content-box { border: 1px solid #e2e8f0; border-radius: 4px; padding: 12px; min-height: 80px; background: #f8fafc; font-size: 10pt; line-height: 1.6; white-space: pre-wrap; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
  .sig-box { text-align: center; }
  .sig-line { border-top: 1px solid #334155; margin: 40px 10px 6px; }
  .sig-label { font-size: 9pt; color: #475569; }
  .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 8pt; color: #94a3b8; text-align: center; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Dr/Dra. ${doctorName}</h1>
      <p>${specialty}</p>
      ${licenseNumber ? `<p>Colegio/MPPS: ${licenseNumber}</p>` : ""}
    </div>
    <div style="text-align:right; font-size:9pt; color:#64748b;">
      <p>Fecha: ${today}</p>
    </div>
  </div>

  <div class="doc-title">${docTitle}</div>

  <div class="section">
    <div class="field-row">
      <div>
        <div class="field-label">Procedimiento</div>
        <div class="field">${procedureName}</div>
      </div>
    </div>
    <div class="field-row">
      <div>
        <div class="field-label">Paciente</div>
        <div class="field">${patientName}</div>
      </div>
    </div>
  </div>

  ${content ? `
  <div class="section">
    <div class="section-label">Descripción del procedimiento</div>
    <div class="content-box">${content}</div>
  </div>` : ""}

  ${complications ? `
  <div class="section">
    <div class="section-label">Posibles complicaciones y riesgos</div>
    <div class="content-box">${complications}</div>
  </div>` : ""}

  ${benefits ? `
  <div class="section">
    <div class="section-label">Beneficios esperados</div>
    <div class="content-box">${benefits}</div>
  </div>` : ""}

  <div class="section">
    <div class="section-label">Declaración de consentimiento</div>
    <div class="content-box">${consentText}</div>
  </div>

  <div class="signatures">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label"><strong>Firma del Paciente</strong></div>
      <div class="sig-label" style="margin-top:4px;">${patientName}</div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-label"><strong>Firma del Profesional</strong></div>
      <div class="sig-label" style="margin-top:4px;">Dr/Dra. ${doctorName}</div>
    </div>
  </div>

  <div class="footer">DOCCO — Documento generado el ${today}</div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=850,height=950");
    if (!win) { notify.error("No se pudo abrir la ventana de impresión. Permite ventanas emergentes."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }

  if (!canEdit) {
    return (
      <section className="page-section">
        <div style={{ textAlign: "center", padding: 60 }}>
          <FileText size={48} strokeWidth={1} style={{ opacity: 0.2, marginBottom: 16 }} />
          <h3>Acceso restringido</h3>
          <p style={{ color: "#64748b" }}>Solo doctores y administradores pueden acceder a esta sección.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileText size={20} color="white" strokeWidth={1.5} />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Editor de Documentos</h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>Consentimiento informado médico</p>
          </div>
        </div>
        <button
          type="button"
          onClick={printDocument}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg,#3b82f6,#2563eb)", color: "white", border: "none", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}
        >
          <Printer size={16} />
          Vista Previa / Imprimir
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Doctor Info */}
        <article className="card elite-card">
          <h4 style={{ marginBottom: 16, color: "#0369a1", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Información del Profesional</h4>
          <div className="input-group">
            <label>Nombre del doctor</label>
            <input type="text" className="elite-input" value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="Dr. Juan Pérez" />
          </div>
          <div className="input-group">
            <label>Especialidad</label>
            <input type="text" className="elite-input" value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="Odontología General" />
          </div>
          <div className="input-group">
            <label>Número de licencia / MPPS</label>
            <input type="text" className="elite-input" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} placeholder="MP 12345" />
          </div>
        </article>

        {/* Document & Patient Info */}
        <article className="card elite-card">
          <h4 style={{ marginBottom: 16, color: "#0369a1", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Datos del Documento</h4>
          <div className="input-group">
            <label>Título del documento</label>
            <input type="text" className="elite-input" value={docTitle} onChange={e => setDocTitle(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Nombre del procedimiento</label>
            <input type="text" className="elite-input" value={procedureName} onChange={e => setProcedureName(e.target.value)} placeholder="Extracción dental, implante, etc." />
          </div>
          <div className="input-group" style={{ position: "relative" }}>
            <label>Paciente</label>
            <input
              type="text"
              className="elite-input"
              value={patientName || patientSearch}
              onChange={e => { setPatientSearch(e.target.value); setPatientName(""); setShowPatientList(true); }}
              placeholder="Buscar paciente..."
              onFocus={() => setShowPatientList(true)}
            />
            {showPatientList && filteredPatients.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #e2e8f0", borderRadius: 8, zIndex: 10, maxHeight: 180, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                {filteredPatients.slice(0, 8).map(p => (
                  <button key={p.id} type="button"
                    style={{ width: "100%", padding: "8px 12px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                    onClick={() => { setPatientName(`${p.firstName} ${p.lastName}`); setPatientSearch(""); setShowPatientList(false); }}
                  >
                    {p.firstName} {p.lastName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </article>
      </div>

      {/* Content sections */}
      <article className="card elite-card" style={{ marginTop: 20 }}>
        <h4 style={{ marginBottom: 16, color: "#0369a1", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Descripción del Procedimiento</h4>
        <textarea
          rows={5}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Describa detalladamente el procedimiento que se realizará..."
          style={{ width: "100%", resize: "vertical", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0", fontFamily: "inherit", fontSize: "0.875rem", lineHeight: 1.6 }}
        />
      </article>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
        <article className="card elite-card">
          <h4 style={{ marginBottom: 16, color: "#dc2626", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Posibles Complicaciones y Riesgos</h4>
          <textarea
            rows={6}
            value={complications}
            onChange={e => setComplications(e.target.value)}
            placeholder="Detalle los posibles riesgos y complicaciones del procedimiento..."
            style={{ width: "100%", resize: "vertical", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0", fontFamily: "inherit", fontSize: "0.875rem", lineHeight: 1.6 }}
          />
        </article>
        <article className="card elite-card">
          <h4 style={{ marginBottom: 16, color: "#059669", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Beneficios Esperados</h4>
          <textarea
            rows={6}
            value={benefits}
            onChange={e => setBenefits(e.target.value)}
            placeholder="Describa los beneficios que se esperan del procedimiento..."
            style={{ width: "100%", resize: "vertical", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0", fontFamily: "inherit", fontSize: "0.875rem", lineHeight: 1.6 }}
          />
        </article>
      </div>

      <article className="card elite-card" style={{ marginTop: 20 }}>
        <h4 style={{ marginBottom: 16, color: "#0369a1", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Texto de Consentimiento</h4>
        <textarea
          rows={5}
          value={consentText}
          onChange={e => setConsentText(e.target.value)}
          style={{ width: "100%", resize: "vertical", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0", fontFamily: "inherit", fontSize: "0.875rem", lineHeight: 1.6 }}
        />
        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <button
            type="button"
            onClick={printDocument}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg,#3b82f6,#2563eb)", color: "white", border: "none", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}
          >
            <Printer size={16} />
            Vista Previa / Imprimir
          </button>
          <button
            type="button"
            onClick={() => notify.success("Próximamente", "El envío como PDF estará disponible en una actualización futura.")}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "white", color: "#334155", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}
          >
            Enviar como PDF (próximamente)
          </button>
        </div>
      </article>
    </section>
  );
}

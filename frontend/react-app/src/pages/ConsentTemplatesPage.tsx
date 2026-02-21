import { useState, useEffect, FormEvent } from "react";
import { request } from "../lib/http";
import { notify } from "../lib/notify";

type ConsentTemplate = {
  id: string;
  orgId: string;
  title: string;
  content: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type Props = { token: string };

const DEFAULT_CONSENT_CONTENT = `CONSENTIMIENTO INFORMADO PARA TRATAMIENTO ODONTOLÓGICO

Yo, el/la paciente abajo firmante, declaro que:

1. INFORMACIÓN DEL TRATAMIENTO
He sido informado/a por el profesional tratante sobre el diagnóstico de mi condición dental, el tratamiento propuesto, los procedimientos que se realizarán, los riesgos y beneficios esperados, y las alternativas de tratamiento disponibles.

2. PROCEDIMIENTOS AUTORIZADOS
Autorizo al profesional y a su equipo a realizar los procedimientos odontológicos necesarios, incluyendo pero no limitado a: exámenes clínicos y radiográficos, limpiezas dentales, obturaciones (empastes), extracciones, tratamientos de conducto (endodoncia), colocación de coronas o prótesis, y cualquier otro procedimiento que sea necesario para mi salud bucal.

3. RIESGOS Y COMPLICACIONES
Entiendo que todo procedimiento médico conlleva riesgos, que pueden incluir: dolor o molestia post-procedimiento, inflamación o sangrado temporal, infección (poco frecuente), reacciones a anestesia local, y en casos de extracción: alveolitis u otras complicaciones.

4. ANESTESIA LOCAL
Consiento el uso de anestesia local para los procedimientos que lo requieran. He informado al profesional sobre alergias conocidas, medicamentos que tomo y condiciones médicas relevantes.

5. FOTOGRAFÍAS Y REGISTROS
Autorizo al profesional a tomar fotografías clínicas y radiografías necesarias para el diagnóstico y seguimiento de mi tratamiento, las cuales formarán parte de mi expediente médico confidencial.

6. CONFIDENCIALIDAD
Entiendo que toda la información relacionada con mi tratamiento es confidencial y será manejada de acuerdo con las leyes de protección de datos aplicables.

7. DERECHO A RETRACTARSE
Entiendo que tengo el derecho de retirar este consentimiento en cualquier momento antes de que comience el procedimiento, sin que ello afecte la calidad de la atención que recibiré.

8. DECLARACIÓN FINAL
Declaro haber leído y comprendido este documento, haber tenido la oportunidad de hacer preguntas, y que todas mis dudas han sido respondidas satisfactoriamente. Acepto voluntariamente el tratamiento propuesto.`;

export function ConsentTemplatesPage({ token }: Props) {
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ConsentTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", isActive: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const res = await request<{ items: ConsentTemplate[] }>("/consent-templates", { token });
      setTemplates(res.items ?? []);
    } catch (e: any) {
      notify.error("Error al cargar plantillas", e.message);
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditing(null);
    setForm({ title: "Consentimiento Informado General", content: DEFAULT_CONSENT_CONTENT, isActive: true });
    setShowForm(true);
  }

  function openEdit(t: ConsentTemplate) {
    setEditing(t);
    setForm({ title: t.title, content: t.content, isActive: t.isActive });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const updated = await request<ConsentTemplate>(`/consent-templates/${editing.id}`, {
          method: "PUT",
          token,
          body: { title: form.title, content: form.content, isActive: form.isActive },
        });
        setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        notify.success("Plantilla actualizada");
      } else {
        const created = await request<ConsentTemplate>("/consent-templates", {
          method: "POST",
          token,
          body: { title: form.title, content: form.content, isActive: form.isActive },
        });
        setTemplates((prev) => [created, ...prev]);
        notify.success("Plantilla creada");
      }
      closeForm();
    } catch (e: any) {
      notify.error("Error al guardar", e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(t: ConsentTemplate) {
    try {
      const updated = await request<ConsentTemplate>(`/consent-templates/${t.id}`, {
        method: "PUT",
        token,
        body: { title: t.title, content: t.content, isActive: !t.isActive },
      });
      setTemplates((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      notify.success(updated.isActive ? "Plantilla activada" : "Plantilla desactivada");
    } catch (e: any) {
      notify.error("Error", e.message);
    }
  }

  if (showForm) {
    return (
      <section className="page-section">
        <div className="page-header">
          <h2 className="page-title">{editing ? "Editar plantilla" : "Nueva plantilla"}</h2>
          <button className="btn btn-secondary" onClick={closeForm}>← Volver</button>
        </div>
        <form onSubmit={handleSubmit} className="card elite-card consent-template-form">
          <div className="form-group">
            <label className="form-label">Título de la plantilla</label>
            <input
              className="form-input"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              placeholder="Ej: Consentimiento Informado General"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Contenido del consentimiento</label>
            <p className="form-hint">
              Este texto se incluirá en el correo al paciente al crear una cita. Puedes editarlo libremente.
            </p>
            <textarea
              className="form-input consent-template-textarea"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              required
              rows={24}
            />
          </div>
          <div className="form-group form-group-inline">
            <label className="form-label">Estado</label>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              <span className="toggle-text">{form.isActive ? "Activa (se enviará automáticamente)" : "Inactiva"}</span>
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={closeForm}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear plantilla"}
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <h2 className="page-title">Plantillas de Consentimiento</h2>
          <p className="page-subtitle">
            La plantilla <strong>activa</strong> se envía automáticamente al paciente cuando se crea una cita.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          + Nueva plantilla
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Cargando plantillas...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="empty-state">
          <p>No hay plantillas de consentimiento.</p>
          <p>Crea una plantilla activa para que se envíe automáticamente al paciente al agendar una cita.</p>
          <button className="btn btn-primary" onClick={openNew}>
            Crear primera plantilla
          </button>
        </div>
      ) : (
        <div className="templates-list">
          {templates.map((t) => (
            <div key={t.id} className={`template-card ${t.isActive ? "template-active" : "template-inactive"}`}>
              <div className="template-card-header">
                <div className="template-card-title">
                  <h3>{t.title}</h3>
                  <span className={`badge ${t.isActive ? "badge-success" : "badge-neutral"}`}>
                    {t.isActive ? "Activa" : "Inactiva"}
                  </span>
                </div>
                <div className="template-card-actions">
                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(t)}>
                    Editar
                  </button>
                  <button
                    className={`btn btn-sm ${t.isActive ? "btn-warning" : "btn-success"}`}
                    onClick={() => toggleActive(t)}
                  >
                    {t.isActive ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
              <div className="template-card-preview">
                <pre className="template-content-preview">
                  {t.content.slice(0, 300)}{t.content.length > 300 ? "..." : ""}
                </pre>
              </div>
              <div className="template-card-meta">
                <span>Actualizada: {new Date(t.updatedAt).toLocaleDateString("es-VE")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

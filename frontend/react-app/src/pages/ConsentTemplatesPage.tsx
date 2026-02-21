import { useState, useEffect, useRef, FormEvent } from "react";
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

/** Plantilla genérica: confirmación de asistencia a la consulta (primera firma). */
const PLANTILLA_ASISTENCIA = {
  title: "Confirmación de asistencia a la consulta",
  content: `CONFIRMACIÓN DE ASISTENCIA A LA CONSULTA

Al aceptar este documento, confirmo que:

• He recibido la citación para la consulta odontológica en la fecha y hora indicadas.
• Me comprometo a asistir o a avisar con la mayor antelación posible en caso de no poder acudir.
• Entiendo que la confirmación de mi asistencia permite una mejor organización de la agenda clínica.

Acepto y confirmo mi asistencia a la consulta.`,
};

/** Plantilla genérica: consentimiento informado para tratamiento odontológico (segunda firma). Basada en modelos de colegios profesionales. */
const PLANTILLA_TRATAMIENTO_ODONTOLOGICO = {
  title: "Consentimiento informado para tratamiento odontológico",
  content: `CONSENTIMIENTO INFORMADO PARA TRATAMIENTOS E INTERVENCIONES DENTALES

Yo, el/la paciente, declaro que:

1. DESCRIPCIÓN DEL TRATAMIENTO
He sido informado/a por el profesional tratante sobre el diagnóstico de mi condición dental, el tratamiento propuesto y los procedimientos que se realizarán. El tratamiento tiene como objetivo preservar, restaurar o mejorar mi salud bucal e incluye, según lo acordado: diagnóstico clínico, limpieza dental, obturaciones, extracciones, tratamientos de conducto (endodoncia), colocación de coronas o prótesis, y cualquier otro procedimiento necesario para mi atención.

2. RIESGOS Y BENEFICIOS
Se me han explicado los posibles beneficios del tratamiento y los riesgos asociados, que pueden incluir: infecciones, sensibilidad dental, dolor postoperatorio, inflamación o sangrado temporal, reacciones alérgicas a medicamentos o anestesia y, en raras ocasiones, complicaciones mayores (por ejemplo alveolitis en extracciones).

3. ALTERNATIVAS
He sido informado/a de las alternativas al tratamiento propuesto, incluyendo opciones menos invasivas, otros procedimientos y la posibilidad de no realizar tratamiento, así como sus consecuencias.

4. ANESTESIA Y MEDICAMENTOS
En caso de ser necesario, consiento el uso de anestesia local, sedación consciente u otros medicamentos. He informado al profesional sobre alergias conocidas, medicamentos que tomo y condiciones médicas relevantes.

5. FOTOGRAFÍAS Y REGISTROS
Autorizo la toma de fotografías clínicas y radiografías necesarias para el diagnóstico y seguimiento, que formarán parte de mi expediente confidencial.

6. DECLARACIÓN FINAL
Declaro haber recibido información clara y comprensible, haber tenido oportunidad de hacer preguntas y que doy mi consentimiento libre y voluntario para que se realice el tratamiento propuesto.`,
};

/** Contenido por defecto al crear una nueva plantilla manualmente (tratamiento odontológico). */
const DEFAULT_CONSENT_CONTENT = PLANTILLA_TRATAMIENTO_ODONTOLOGICO.content;

export function ConsentTemplatesPage({ token }: Props) {
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingExamples, setCreatingExamples] = useState(false);
  const [editing, setEditing] = useState<ConsentTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", isActive: true });
  const [saving, setSaving] = useState(false);
  const autoLoadedRef = useRef(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  // Si no hay plantillas, cargar automáticamente las de ejemplo (basadas en modelos odontológicos).
  useEffect(() => {
    if (loading || templates.length > 0 || autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    setCreatingExamples(true);
    (async () => {
      try {
        await request<ConsentTemplate>("/consent-templates", {
          method: "POST",
          token,
          body: {
            title: PLANTILLA_ASISTENCIA.title,
            content: PLANTILLA_ASISTENCIA.content,
            isActive: true,
          },
        });
        await request<ConsentTemplate>("/consent-templates", {
          method: "POST",
          token,
          body: {
            title: PLANTILLA_TRATAMIENTO_ODONTOLOGICO.title,
            content: PLANTILLA_TRATAMIENTO_ODONTOLOGICO.content,
            isActive: true,
          },
        });
        await loadTemplates();
        notify.success("Plantillas de consentimiento cargadas (asistencia + tratamiento odontológico).");
      } catch (e: any) {
        autoLoadedRef.current = false;
        notify.error("Error al cargar plantillas de ejemplo", e.message);
      } finally {
        setCreatingExamples(false);
      }
    })();
  }, [loading, templates.length, token]);

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

  /** Crea las dos plantillas de ejemplo (asistencia + tratamiento odontológico) y las deja activas. */
  async function createExampleTemplates() {
    setCreatingExamples(true);
    try {
      await request<ConsentTemplate>("/consent-templates", {
        method: "POST",
        token,
        body: {
          title: PLANTILLA_ASISTENCIA.title,
          content: PLANTILLA_ASISTENCIA.content,
          isActive: true,
        },
      });
      await request<ConsentTemplate>("/consent-templates", {
        method: "POST",
        token,
        body: {
          title: PLANTILLA_TRATAMIENTO_ODONTOLOGICO.title,
          content: PLANTILLA_TRATAMIENTO_ODONTOLOGICO.content,
          isActive: true,
        },
      });
      await loadTemplates();
      notify.success("Plantillas de ejemplo creadas. Ambas están activas y se enviarán al agendar citas.");
    } catch (e: any) {
      notify.error("Error al crear plantillas", e.message);
    } finally {
      setCreatingExamples(false);
    }
  }

  function openNew() {
    setEditing(null);
    setForm({
      title: PLANTILLA_TRATAMIENTO_ODONTOLOGICO.title,
      content: DEFAULT_CONSENT_CONTENT,
      isActive: true,
    });
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

      {loading || creatingExamples ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>{creatingExamples ? "Cargando plantillas de ejemplo..." : "Cargando plantillas..."}</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="empty-state">
          <p>No hay plantillas de consentimiento.</p>
          <p>
            Crea una plantilla activa para que se envíe automáticamente al paciente al agendar una cita.
            Puedes usar las plantillas de ejemplo (confirmación de asistencia + consentimiento de tratamiento odontológico) o crear la tuya.
          </p>
          <div className="empty-state-actions">
            <button
              className="btn btn-primary"
              onClick={createExampleTemplates}
              disabled={creatingExamples}
            >
              {creatingExamples ? "Creando plantillas…" : "Crear plantillas de ejemplo"}
            </button>
            <button className="btn btn-secondary" onClick={openNew}>
              Crear plantilla manual
            </button>
          </div>
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

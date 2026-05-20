import { useEffect, useState } from "react";
import { clinicalApi } from "../../api/clinical";

const MAX_KB_CHARS = 5000;
const MAX_INSTRUCTIONS_CHARS = 3000;

type Props = {
  token: string;
};

export function KnowledgeBaseEditor({ token }: Props) {
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [assistantInstructions, setAssistantInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadKnowledge();
  }, []);

  async function loadKnowledge() {
    setLoading(true);
    try {
      const data = await clinicalApi.whatsAppGetKnowledge(token);
      setKnowledgeBase(data.knowledgeBase || "");
      setWelcomeMessage(data.welcomeMessage || "");
      setAssistantInstructions(data.assistantInstructions || "");
    } catch {
      setError("No se pudo cargar la configuración.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await clinicalApi.whatsAppSaveKnowledge(
        knowledgeBase,
        welcomeMessage,
        assistantInstructions,
        token,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="card-body text-muted">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Configuración del Asistente</h3>
        <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: 4 }}>
          Define qué sabe el asistente y cómo debe responder a tus pacientes.
        </p>
      </div>

      <div
        className="card-body"
        style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
      >
        {error && <div className="alert alert-error">{error}</div>}

        {/* Sección 1: Información de la clínica */}
        <div>
          <label
            className="form-label"
            style={{ fontWeight: 600, marginBottom: 4, display: "block" }}
          >
            Información de la Clínica
          </label>
          <p
            className="text-muted"
            style={{ fontSize: "0.82rem", marginBottom: 6 }}
          >
            Datos que el asistente puede mencionar: servicios, precios,
            horarios, ubicación, teléfono.
          </p>
          <textarea
            className="form-input"
            rows={8}
            placeholder={`Ejemplo:
Somos la Clínica Dental Pérez, especialistas en ortodoncia y estética dental.

Servicios: limpieza ($30), blanqueamiento ($80), ortodoncia (consultar), implantes, extracciones.

Horarios: lunes a viernes 8am-6pm. Sábados 9am-1pm.

Ubicación: Calle 50, Torre Médica, Piso 3. Caracas, Venezuela.

Teléfono: +58 212 555-0100`}
            value={knowledgeBase}
            onChange={(e) => setKnowledgeBase(e.target.value)}
            style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }}
            maxLength={MAX_KB_CHARS}
          />
          <div
            style={{
              textAlign: "right",
              fontSize: "0.78rem",
              color: "var(--text-muted)",
              marginTop: 4,
            }}
          >
            {knowledgeBase.length} / {MAX_KB_CHARS}
          </div>
        </div>

        {/* Sección 2: Instrucciones clínicas */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: "1.25rem",
          }}
        >
          <label
            className="form-label"
            style={{ fontWeight: 600, marginBottom: 4, display: "block" }}
          >
            Instrucciones Clínicas del Asistente
          </label>
          <p
            className="text-muted"
            style={{ fontSize: "0.82rem", marginBottom: 6 }}
          >
            Reglas específicas sobre cómo debe responder el asistente en
            situaciones delicadas. Estas instrucciones se aplican directamente y
            el asistente las sigue al pie de la letra. Por ejemplo: cómo manejar
            preguntas sobre medicamentos, cuándo derivar al doctor, qué temas
            evitar.
          </p>
          <div
            style={{
              background: "var(--bg-subtle, #f8fafc)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "0.75rem",
              fontSize: "0.82rem",
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            <strong
              style={{
                color: "var(--text)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Ejemplo de instrucciones:
            </strong>
            Si alguien pregunta qué medicamento puede tomar, responde: "Eso
            únicamente lo puede indicar el Dr. López en consulta. Te recomiendo
            agendar una cita para que él te evalúe personalmente."
            <br />
            <br />
            Si alguien pregunta sobre diagnósticos o resultados de exámenes,
            responde que eso requiere evaluación presencial y ofrece agendar una
            cita.
            <br />
            <br />
            Para preguntas sobre dolor dental agudo, indica que llamen al +58
            212 555-0100 para cita de urgencia.
          </div>
          <textarea
            className="form-input"
            rows={7}
            placeholder="Escribe aquí las instrucciones específicas para tu clínica..."
            value={assistantInstructions}
            onChange={(e) => setAssistantInstructions(e.target.value)}
            style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }}
            maxLength={MAX_INSTRUCTIONS_CHARS}
          />
          <div
            style={{
              textAlign: "right",
              fontSize: "0.78rem",
              color: "var(--text-muted)",
              marginTop: 4,
            }}
          >
            {assistantInstructions.length} / {MAX_INSTRUCTIONS_CHARS}
          </div>
        </div>

        {/* Sección 3: Mensaje de bienvenida */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: "1.25rem",
          }}
        >
          <label
            className="form-label"
            style={{ fontWeight: 600, marginBottom: 4, display: "block" }}
          >
            Mensaje de Bienvenida
          </label>
          <p
            className="text-muted"
            style={{ fontSize: "0.82rem", marginBottom: 6 }}
          >
            Primer mensaje que recibe cada paciente al escribirle a la clínica.
          </p>
          <textarea
            className="form-input"
            rows={3}
            placeholder="Ejemplo: ¡Hola! Soy el asistente virtual de Clínica Dental Pérez. ¿En qué puedo ayudarte hoy?"
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }}
            maxLength={500}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar Configuración"}
          </button>
          {saved && (
            <span
              style={{ color: "var(--success, #16a34a)", fontSize: "0.9rem" }}
            >
              Guardado correctamente
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

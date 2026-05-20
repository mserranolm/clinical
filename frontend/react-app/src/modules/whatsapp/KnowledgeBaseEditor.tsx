import { useEffect, useState } from "react";
import { clinicalApi } from "../../api/clinical";

const MAX_KB_CHARS = 5000;

type Props = {
  token: string;
};

export function KnowledgeBaseEditor({ token }: Props) {
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
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
        <h3 className="card-title">Base de Conocimiento del Asistente</h3>
        <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: 4 }}>
          Escribe todo lo que el asistente debe saber sobre tu clínica:
          servicios, precios, horarios, especialidades, ubicación. El asistente
          usará esta información para responder a tus pacientes.
        </p>
      </div>

      <div
        className="card-body"
        style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
      >
        {error && <div className="alert alert-error">{error}</div>}

        <div>
          <label
            className="form-label"
            style={{ fontWeight: 600, marginBottom: 6, display: "block" }}
          >
            Información de la Clínica
          </label>
          <textarea
            className="form-input"
            rows={10}
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
            {knowledgeBase.length} / {MAX_KB_CHARS} caracteres
          </div>
        </div>

        <div>
          <label
            className="form-label"
            style={{ fontWeight: 600, marginBottom: 6, display: "block" }}
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
            {saving ? "Guardando..." : "Guardar Base de Conocimiento"}
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

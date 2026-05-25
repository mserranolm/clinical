import { useEffect, useState } from "react";
import { clinicalApi } from "../../api/clinical";
import type { BotMode } from "./types";

type Props = {
  token: string;
};

export function BotModeSelector({ token }: Props) {
  const [mode, setMode] = useState<BotMode>("beta");
  const [phones, setPhones] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [phoneErrors, setPhoneErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const status = await clinicalApi.whatsAppStatus(token);
        if (!mounted) return;
        if (status.botMode) setMode(status.botMode);
        if (status.betaTestPhones && status.betaTestPhones.length > 0) {
          setPhones(status.betaTestPhones);
        }
      } catch {
        // silencioso — usa defaults
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [token]);

  function validatePhones(): boolean {
    const phoneRegex = /^\+?\d{7,15}$/;
    const errors: Record<number, string> = {};
    if (mode === "beta") {
      phones.forEach((p, i) => {
        const cleaned = p.replace(/\s/g, "");
        if (cleaned && !phoneRegex.test(cleaned)) {
          errors[i] = "Formato inválido. Ej: +57 3001234567";
        }
      });
    }
    setPhoneErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validatePhones()) return;
    const validPhones = phones.filter((p) => p.trim().length > 0);
    if (mode === "beta" && validPhones.length === 0) {
      setError("Agrega al menos un número para el modo beta");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await clinicalApi.whatsAppSetBotMode(mode, validPhones, token);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Modo del asistente</h3>
      </div>
      <div
        className="card-body"
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        {/* Toggle beta/producción */}
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            className={`btn ${mode === "beta" ? "btn-warning" : "btn-ghost"}`}
            onClick={() => {
              setMode("beta");
              setError("");
            }}
            style={{ flex: 1 }}
          >
            Beta
          </button>
          <button
            className={`btn ${mode === "production" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => {
              setMode("production");
              setError("");
            }}
            style={{ flex: 1 }}
          >
            Produccion
          </button>
        </div>

        {/* Descripción del modo */}
        <p className="text-muted" style={{ fontSize: "0.875rem" }}>
          {mode === "beta"
            ? "Solo responde a los números de prueba que configures. Ideal para probar antes de activar para todos."
            : "Responde a TODOS los mensajes que lleguen. Activalo cuando estés listo."}
        </p>

        {/* Números beta */}
        {mode === "beta" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>
              Números de prueba ({phones.length}/10)
            </label>
            {phones.map((phone, idx) => (
              <div
                key={idx}
                style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
              >
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <input
                    type="tel"
                    value={phone}
                    placeholder="+57 300 123 4567"
                    onChange={(e) =>
                      setPhones((prev) =>
                        prev.map((p, i) => (i === idx ? e.target.value : p)),
                      )
                    }
                    className="form-input"
                    style={
                      phoneErrors[idx]
                        ? { border: "1px solid var(--error, #dc2626)" }
                        : undefined
                    }
                  />
                  {phoneErrors[idx] && (
                    <span
                      style={{
                        fontSize: "0.78rem",
                        color: "var(--error, #dc2626)",
                      }}
                    >
                      {phoneErrors[idx]}
                    </span>
                  )}
                </div>
                {phones.length > 1 && (
                  <button
                    className="btn btn-ghost"
                    onClick={() =>
                      setPhones((prev) => prev.filter((_, i) => i !== idx))
                    }
                    style={{ padding: "0.25rem 0.5rem", flexShrink: 0 }}
                  >
                    x
                  </button>
                )}
              </div>
            ))}
            {phones.length < 10 && (
              <button
                className="btn btn-ghost"
                onClick={() => setPhones((prev) => [...prev, ""])}
                style={{ alignSelf: "flex-start", fontSize: "0.875rem" }}
              >
                + Agregar número
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="alert alert-error" style={{ margin: 0 }}>
            {error}
          </div>
        )}

        <button
          className={`btn ${saved ? "btn-success" : "btn-primary"}`}
          onClick={handleSave}
          disabled={saving}
          style={{ alignSelf: "flex-start" }}
        >
          {saving ? "Guardando..." : saved ? "Guardado" : "Guardar modo"}
        </button>
      </div>
    </div>
  );
}

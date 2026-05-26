import { useEffect, useState } from "react";
import { clinicalApi } from "../../api/clinical";
import type { BotMode } from "./types";

type Props = {
  token: string;
};

export function BotModeSelector({ token }: Props) {
  const [enabled, setEnabled] = useState(true);
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
        // botEnabled viene del backend; si no está seteado, default true
        setEnabled(status.botEnabled !== false);
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
    if (enabled && mode === "beta") {
      phones.forEach((p, i) => {
        const cleaned = p.replace(/\s/g, "");
        if (cleaned && !phoneRegex.test(cleaned)) {
          errors[i] = "Formato inválido. Ej: +573001234567";
        }
      });
    }
    setPhoneErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validatePhones()) return;
    const validPhones = phones.filter((p) => p.trim().length > 0);
    if (enabled && mode === "beta" && validPhones.length === 0) {
      setError("Agrega al menos un número para el modo beta");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await clinicalApi.whatsAppSetBotMode(enabled, mode, validPhones, token);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  // Estado visual actual
  const statusLabel = !enabled
    ? "APAGADO"
    : mode === "production"
      ? "PRODUCCIÓN"
      : "BETA";
  const statusColor = !enabled
    ? "#94a3b8"
    : mode === "production"
      ? "#0d9488"
      : "#d97706";
  const statusBg = !enabled
    ? "rgba(148,163,184,0.1)"
    : mode === "production"
      ? "rgba(13,148,136,0.08)"
      : "rgba(245,158,11,0.08)";

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-xl)",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Header con estado actual */}
      <div
        style={{
          padding: "1.25rem 1.75rem",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--r-md)",
              background: statusBg,
              border: `1px solid ${statusColor}33`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1rem",
              flexShrink: 0,
            }}
          >
            🎛️
          </div>
          <div>
            <h3
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              Modo del asistente
            </h3>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: statusColor,
              }}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Toggle ON/OFF */}
        <button
          onClick={() => {
            setEnabled((prev) => !prev);
            setError("");
          }}
          title={enabled ? "Apagar asistente" : "Encender asistente"}
          style={{
            position: "relative",
            width: 52,
            height: 28,
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            background: enabled ? "var(--accent)" : "var(--surface-2)",
            boxShadow: enabled
              ? "0 0 0 3px rgba(13,148,136,0.15)"
              : "inset 0 1px 3px rgba(0,0,0,0.1)",
            transition: "background 0.2s ease, box-shadow 0.2s ease",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: enabled ? 26 : 3,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "white",
              boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
              transition: "left 0.2s ease",
              display: "block",
            }}
          />
        </button>
      </div>

      {/* Cuerpo — solo visible si está encendido */}
      {enabled && (
        <div
          style={{
            padding: "1.5rem 1.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {/* Toggle segmentado beta/producción */}
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
            }}
          >
            <button
              onClick={() => {
                setMode("beta");
                setError("");
              }}
              style={{
                flex: "1 1 0",
                padding: "1rem",
                borderRadius: "var(--r-lg)",
                border: `2px solid ${mode === "beta" ? "#f59e0b" : "var(--border-strong)"}`,
                background:
                  mode === "beta"
                    ? "rgba(245,158,11,0.06)"
                    : "var(--surface-2)",
                cursor: "pointer",
                transition: "all 0.18s ease",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: "0.5rem",
                }}
              >
                <span style={{ fontSize: "1.25rem" }}>🧪</span>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    border: `2px solid ${mode === "beta" ? "#f59e0b" : "var(--border-strong)"}`,
                    background: mode === "beta" ? "#f59e0b" : "transparent",
                    flexShrink: 0,
                    marginTop: 2,
                    boxShadow:
                      mode === "beta"
                        ? "inset 0 0 0 3px var(--surface-2)"
                        : "none",
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  color: mode === "beta" ? "#d97706" : "var(--text-primary)",
                  marginBottom: "0.2rem",
                }}
              >
                Beta
              </div>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-muted)",
                  lineHeight: 1.4,
                }}
              >
                Solo números configurados
              </div>
            </button>

            <button
              onClick={() => {
                setMode("production");
                setError("");
              }}
              style={{
                flex: "1 1 0",
                padding: "1rem",
                borderRadius: "var(--r-lg)",
                border: `2px solid ${mode === "production" ? "var(--accent)" : "var(--border-strong)"}`,
                background:
                  mode === "production"
                    ? "var(--accent-soft)"
                    : "var(--surface-2)",
                cursor: "pointer",
                transition: "all 0.18s ease",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: "0.5rem",
                }}
              >
                <span style={{ fontSize: "1.25rem" }}>🌍</span>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    border: `2px solid ${mode === "production" ? "var(--accent)" : "var(--border-strong)"}`,
                    background:
                      mode === "production" ? "var(--accent)" : "transparent",
                    flexShrink: 0,
                    marginTop: 2,
                    boxShadow:
                      mode === "production"
                        ? "inset 0 0 0 3px var(--surface-2)"
                        : "none",
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  color:
                    mode === "production"
                      ? "var(--accent)"
                      : "var(--text-primary)",
                  marginBottom: "0.2rem",
                }}
              >
                Producción
              </div>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-muted)",
                  lineHeight: 1.4,
                }}
              >
                Responde a todos
              </div>
            </button>
          </div>

          {/* Números beta */}
          {mode === "beta" && (
            <div
              style={{
                background: "rgba(245,158,11,0.04)",
                border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: "var(--r-lg)",
                padding: "1rem 1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <label
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  Números de prueba
                </label>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                    padding: "0.15rem 0.6rem",
                  }}
                >
                  {phones.filter((p) => p.trim()).length}/10
                </span>
              </div>

              {phones.map((phone, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <input
                      type="tel"
                      value={phone}
                      placeholder="+58 412 038 3478"
                      onChange={(e) =>
                        setPhones((prev) =>
                          prev.map((p, i) => (i === idx ? e.target.value : p)),
                        )
                      }
                      className="form-input"
                      style={{
                        width: "100%",
                        ...(phoneErrors[idx]
                          ? {
                              borderColor: "#dc2626",
                              background: "rgba(220,38,38,0.03)",
                            }
                          : {}),
                      }}
                    />
                    {phoneErrors[idx] && (
                      <span
                        style={{
                          display: "block",
                          marginTop: "0.25rem",
                          fontSize: "0.75rem",
                          color: "#dc2626",
                        }}
                      >
                        {phoneErrors[idx]}
                      </span>
                    )}
                  </div>
                  {phones.length > 1 && (
                    <button
                      onClick={() =>
                        setPhones((prev) => prev.filter((_, i) => i !== idx))
                      }
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--r-sm)",
                        border: "1px solid var(--border-strong)",
                        background: "var(--surface)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--text-muted)",
                        fontSize: "1rem",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                      title="Eliminar"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              {phones.length < 10 && (
                <button
                  onClick={() => setPhones((prev) => [...prev, ""])}
                  style={{
                    alignSelf: "flex-start",
                    padding: "0.4rem 0.875rem",
                    borderRadius: "var(--r-sm)",
                    border: "1px dashed rgba(245,158,11,0.4)",
                    background: "transparent",
                    color: "#d97706",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  + Agregar número
                </button>
              )}
            </div>
          )}

          {error && (
            <div
              style={{
                background: "rgba(220,38,38,0.07)",
                border: "1px solid rgba(220,38,38,0.2)",
                borderRadius: "var(--r-md)",
                padding: "0.65rem 1rem",
                fontSize: "0.875rem",
                color: "#dc2626",
              }}
            >
              {error}
            </div>
          )}
        </div>
      )}

      {/* Mensaje cuando está apagado */}
      {!enabled && (
        <div
          style={{
            padding: "1.25rem 1.75rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <span style={{ fontSize: "1.25rem" }}>😴</span>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--text-muted)",
              margin: 0,
            }}
          >
            El asistente está apagado. Los mensajes llegarán sin respuesta
            automática.
          </p>
        </div>
      )}

      {/* Footer con botón guardar */}
      <div
        style={{
          padding: "1rem 1.75rem",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "0.875rem",
        }}
      >
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Guardando..." : saved ? "✓ Guardado" : "Guardar"}
        </button>
        {saved && (
          <span style={{ fontSize: "0.875rem", color: "#16a34a" }}>
            Configuración actualizada
          </span>
        )}
      </div>
    </div>
  );
}

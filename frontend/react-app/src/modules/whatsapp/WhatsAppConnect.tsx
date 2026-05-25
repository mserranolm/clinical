import { useCallback, useEffect, useRef, useState } from "react";
import { clinicalApi } from "../../api/clinical";
import type {
  WhatsAppConnectResult,
  WhatsAppStage,
  WhatsAppStatus,
} from "./types";

const POLL_INTERVAL_MS = 3000;
const QR_TIMEOUT_MS = 180_000;

type Props = {
  token: string;
};

export function WhatsAppConnect({ token }: Props) {
  const [stage, setStage] = useState<WhatsAppStage>("idle");
  const [qrCode, setQrCode] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  useEffect(() => {
    loadStatus();
    return clearTimers;
  }, [clearTimers]);

  async function loadStatus() {
    try {
      const status: WhatsAppStatus = await clinicalApi.whatsAppStatus(token);
      setStage(status.connected ? "connected" : "idle");
      if (status.phoneNumber) setPhoneNumber(status.phoneNumber);
    } catch {
      setStage("idle");
    }
  }

  const startPolling = useCallback(() => {
    clearTimers();
    let remaining = QR_TIMEOUT_MS / 1000;
    setCountdown(remaining);

    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) clearTimers();
    }, 1000);

    pollRef.current = setInterval(async () => {
      try {
        const status: WhatsAppStatus = await clinicalApi.whatsAppStatus(token);
        if (status.connected) {
          clearTimers();
          setStage("connected");
          setQrCode("");
          if (status.phoneNumber) setPhoneNumber(status.phoneNumber);
        }
      } catch {
        /* ignorar errores de polling */
      }
    }, POLL_INTERVAL_MS);

    timeoutRef.current = setTimeout(() => {
      clearTimers();
      setStage("idle");
      setQrCode("");
      setError("El QR expiró. Intenta de nuevo.");
    }, QR_TIMEOUT_MS);
  }, [token, clearTimers]);

  async function handleConnect() {
    setError("");
    setStage("connecting");
    try {
      const result: WhatsAppConnectResult =
        await clinicalApi.whatsAppConnect(token);
      if (result.connected) {
        setStage("connected");
        await loadStatus();
        return;
      }
      if (result.qrCode) {
        setQrCode(result.qrCode);
        setStage("qr_ready");
        startPolling();
      }
    } catch (e) {
      setStage("idle");
      setError(e instanceof Error ? e.message : "Error al conectar");
    }
  }

  async function handleDisconnect() {
    clearTimers();
    setStage("disconnecting");
    setError("");
    try {
      await clinicalApi.whatsAppDisconnect(token);
      setStage("idle");
      setQrCode("");
      setPhoneNumber("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al desconectar");
      setStage("connected");
    }
  }

  function handleCancelQR() {
    clearTimers();
    setStage("idle");
    setQrCode("");
    setError("");
  }

  const isConnected = stage === "connected";
  const isQrReady = stage === "qr_ready";
  const isBusy = stage === "connecting" || stage === "disconnecting";

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
      {/* Header con gradiente */}
      <div
        style={{
          background: isConnected
            ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
            : "linear-gradient(135deg, #0d9488 0%, #0891b2 100%)",
          padding: "1.5rem 1.75rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          transition: "background 0.4s ease",
        }}
      >
        {/* WhatsApp icon */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: "1.5rem",
          }}
        >
          💬
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              flexWrap: "wrap",
            }}
          >
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "white",
                margin: 0,
              }}
            >
              Conexión WhatsApp
            </h3>
            {/* Badge de estado */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.2rem 0.7rem",
                borderRadius: 999,
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.04em",
                background: isConnected
                  ? "rgba(255,255,255,0.25)"
                  : isBusy
                    ? "rgba(255,255,255,0.2)"
                    : isQrReady
                      ? "rgba(255,200,0,0.35)"
                      : "rgba(255,255,255,0.15)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.3)",
              }}
            >
              {isConnected && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#4ade80",
                    flexShrink: 0,
                    boxShadow: "0 0 0 2px rgba(74,222,128,0.4)",
                    animation: "pulseLive 2s ease-in-out infinite",
                  }}
                />
              )}
              {isConnected
                ? "CONECTADO"
                : isBusy
                  ? "PROCESANDO..."
                  : isQrReady
                    ? "ESPERANDO ESCANEO"
                    : "DESCONECTADO"}
            </span>
          </div>

          {/* Número conectado */}
          {isConnected && phoneNumber && (
            <p
              style={{
                margin: "0.3rem 0 0",
                fontSize: "0.88rem",
                color: "rgba(255,255,255,0.85)",
                fontWeight: 500,
                letterSpacing: "0.02em",
              }}
            >
              {phoneNumber}
            </p>
          )}
          {isConnected && !phoneNumber && (
            <p
              style={{
                margin: "0.3rem 0 0",
                fontSize: "0.82rem",
                color: "rgba(255,255,255,0.65)",
              }}
            >
              Asistente activo · responde mensajes automáticamente
            </p>
          )}
          {!isConnected && !isBusy && !isQrReady && (
            <p
              style={{
                margin: "0.3rem 0 0",
                fontSize: "0.82rem",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              Vincula el número de tu clínica para activar el asistente
            </p>
          )}
        </div>
      </div>

      {/* Cuerpo */}
      <div style={{ padding: "1.5rem 1.75rem" }}>
        {error && (
          <div
            style={{
              background: "rgba(220,38,38,0.07)",
              border: "1px solid rgba(220,38,38,0.2)",
              borderRadius: "var(--r-md)",
              padding: "0.75rem 1rem",
              fontSize: "0.875rem",
              color: "#dc2626",
              marginBottom: "1.25rem",
            }}
          >
            {error}
          </div>
        )}

        {stage === "idle" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
              }}
            >
              {[
                "Respuesta automática 24/7",
                "Sin costos por mensaje",
                "Configuración en 1 minuto",
              ].map((feat) => (
                <span
                  key={feat}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                  }}
                >
                  <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                    ✓
                  </span>
                  {feat}
                </span>
              ))}
            </div>
            <button
              className="btn btn-primary"
              onClick={handleConnect}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <span>📱</span> Conectar WhatsApp
            </button>
          </div>
        )}

        {stage === "connecting" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              color: "var(--text-secondary)",
              fontSize: "0.9rem",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 18,
                height: 18,
                border: "2px solid var(--accent)",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }}
            />
            Generando código QR...
          </div>
        )}

        {stage === "qr_ready" && qrCode && (
          <div
            style={{
              display: "flex",
              gap: "2rem",
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            {/* QR Code */}
            <div
              style={{
                flexShrink: 0,
                background: "white",
                borderRadius: "var(--r-lg)",
                padding: "0.75rem",
                boxShadow: "var(--shadow-md)",
                border: "1px solid var(--border)",
              }}
            >
              <img
                src={
                  qrCode.startsWith("data:")
                    ? qrCode
                    : `data:image/png;base64,${qrCode}`
                }
                alt="WhatsApp QR Code"
                style={{ width: 200, height: 200, display: "block" }}
              />
            </div>

            {/* Instrucciones */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <p
                style={{
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  color: "var(--text-primary)",
                  marginBottom: "0.75rem",
                }}
              >
                Escanea con tu teléfono
              </p>
              {[
                "Abre WhatsApp en tu teléfono",
                "Ve a Dispositivos vinculados",
                "Toca Vincular dispositivo",
                "Apunta la cámara al QR",
              ].map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.6rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "var(--accent-soft)",
                      border: "1px solid var(--accent-border)",
                      color: "var(--accent)",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                    }}
                  >
                    {step}
                  </span>
                </div>
              ))}

              <div
                style={{
                  marginTop: "1rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.82rem",
                  color: "var(--text-muted)",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: countdown > 30 ? "#16a34a" : "#f59e0b",
                  }}
                />
                Expira en {countdown}s
              </div>

              <button
                className="btn btn-ghost"
                onClick={handleCancelQR}
                style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {stage === "connected" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              {phoneNumber && (
                <p
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {phoneNumber}
                </p>
              )}
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--text-secondary)",
                }}
              >
                El asistente responde mensajes entrantes automáticamente.
              </p>
            </div>
            <button
              className="btn btn-ghost"
              onClick={handleDisconnect}
              style={{
                color: "#dc2626",
                border: "1px solid rgba(220,38,38,0.2)",
                fontSize: "0.875rem",
              }}
            >
              Desconectar
            </button>
          </div>
        )}

        {stage === "disconnecting" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              color: "var(--text-secondary)",
              fontSize: "0.9rem",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 18,
                height: 18,
                border: "2px solid var(--text-muted)",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }}
            />
            Desconectando...
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulseLive {
          0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.5); }
          50% { box-shadow: 0 0 0 4px rgba(74,222,128,0); }
        }
      `}</style>
    </div>
  );
}

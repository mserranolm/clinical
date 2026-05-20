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

  function StatusBadge() {
    if (stage === "connected")
      return <span className="badge badge-success">Conectado</span>;
    if (stage === "qr_ready")
      return <span className="badge badge-warning">Esperando escaneo...</span>;
    if (stage === "connecting" || stage === "disconnecting")
      return <span className="badge badge-info">Procesando...</span>;
    return <span className="badge badge-error">Desconectado</span>;
  }

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <h3 className="card-title">Conexión WhatsApp</h3>
          <StatusBadge />
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ margin: "0 1rem" }}>
          {error}
        </div>
      )}

      <div className="card-body">
        {stage === "idle" && (
          <div>
            <p
              className="text-muted"
              style={{ marginBottom: "1rem", fontSize: "0.9rem" }}
            >
              Conecta el número de WhatsApp de tu clínica para activar el
              asistente virtual de respuesta automática.
            </p>
            <button className="btn btn-primary" onClick={handleConnect}>
              Conectar WhatsApp
            </button>
          </div>
        )}

        {stage === "connecting" && (
          <p className="text-muted">Generando código QR...</p>
        )}

        {stage === "qr_ready" && qrCode && (
          <div style={{ textAlign: "center" }}>
            <p
              className="text-muted"
              style={{ marginBottom: "0.75rem", fontSize: "0.88rem" }}
            >
              Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo →
              Escanea el QR
            </p>
            <img
              src={
                qrCode.startsWith("data:")
                  ? qrCode
                  : `data:image/png;base64,${qrCode}`
              }
              alt="WhatsApp QR Code"
              style={{
                width: 220,
                height: 220,
                border: "2px solid var(--border)",
                borderRadius: 8,
              }}
            />
            <p
              className="text-muted"
              style={{ marginTop: "0.5rem", fontSize: "0.82rem" }}
            >
              El código expira en {countdown}s
            </p>
            <button
              className="btn btn-ghost"
              onClick={handleCancelQR}
              style={{ marginTop: "0.5rem" }}
            >
              Cancelar
            </button>
          </div>
        )}

        {stage === "connected" && (
          <div>
            <p
              style={{
                marginBottom: "1rem",
                color: "var(--success, #16a34a)",
                fontSize: "0.9rem",
              }}
            >
              WhatsApp conectado y activo. El asistente responde mensajes
              entrantes automáticamente.
            </p>
            <button
              className="btn btn-ghost"
              onClick={handleDisconnect}
              style={{ color: "var(--error, #dc2626)" }}
            >
              Desconectar
            </button>
          </div>
        )}

        {stage === "disconnecting" && (
          <p className="text-muted">Desconectando...</p>
        )}
      </div>
    </div>
  );
}

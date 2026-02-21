import { useState, useEffect } from "react";
import { getApiBaseUrl } from "../lib/config";

type State = "loading" | "ready" | "submitting" | "accepted" | "error";

export function ConsentAcceptPage() {
  const [state, setState] = useState<State>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [appointmentId, setAppointmentId] = useState("");

  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  useEffect(() => {
    if (!token) {
      setErrorMsg("Enlace inválido. No se encontró el token de consentimiento.");
      setState("error");
      return;
    }
    setState("ready");
  }, [token]);

  async function handleAccept() {
    setState("submitting");
    try {
      const apiKey = import.meta.env.VITE_API_KEY as string | undefined;
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/public/consents/${token}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any).error || `Error ${res.status}`);
      }
      setAppointmentId((data as any).appointmentId ?? "");
      setState("accepted");
    } catch (e: any) {
      setErrorMsg(e.message ?? "Error al procesar la aceptación.");
      setState("error");
    }
  }

  return (
    <div className="consent-page">
      <div className="consent-card">
        <div className="consent-logo">
          <span className="consent-logo-text">CliniSense</span>
        </div>

        {(state === "loading" || state === "submitting") && (
          <div className="consent-loading">
            <div className="spinner" />
            <p>{state === "submitting" ? "Procesando tu aceptación..." : "Cargando..."}</p>
          </div>
        )}

        {state === "ready" && (
          <>
            <h1 className="consent-title">Consentimiento Informado</h1>
            <p className="consent-subtitle">
              Para confirmar tu cita, debes aceptar el consentimiento informado que recibiste en el correo electrónico.
            </p>
            <div className="consent-notice">
              <p>Al hacer clic en <strong>"Acepto y confirmo mi cita"</strong>, confirmas que:</p>
              <ul>
                <li>Has leído el consentimiento informado adjunto en el correo.</li>
                <li>Entiendes los procedimientos, riesgos y beneficios descritos.</li>
                <li>Autorizas al profesional a realizar el tratamiento indicado.</li>
                <li>Confirmas tu asistencia a la cita programada.</li>
              </ul>
            </div>
            <button className="consent-accept-btn" onClick={handleAccept}>
              ✓ Acepto y confirmo mi cita
            </button>
            <p className="consent-footer-note">
              Si tienes dudas, comunícate con tu clínica antes de aceptar.
            </p>
          </>
        )}

        {state === "accepted" && (
          <div className="consent-success">
            <div className="consent-success-icon">✓</div>
            <h1>¡Consentimiento aceptado!</h1>
            <p>
              Tu consentimiento informado ha sido registrado y tu cita ha sido <strong>confirmada</strong>.
            </p>
            {appointmentId && (
              <p className="consent-appt-id">
                Referencia: <code>{appointmentId}</code>
              </p>
            )}
            <p className="consent-success-note">
              Te esperamos puntualmente en tu cita.
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="consent-error">
            <div className="consent-error-icon">✗</div>
            <h1>Enlace inválido</h1>
            <p>{errorMsg}</p>
            <p className="consent-error-note">
              Contacta a tu clínica para que te reenvíen el enlace.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

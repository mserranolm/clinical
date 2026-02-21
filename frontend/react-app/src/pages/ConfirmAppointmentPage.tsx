import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getApiBaseUrl } from "../lib/config";

type State = "loading" | "confirmed" | "already" | "error";

export default function ConfirmAppointmentPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [startAt, setStartAt] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMsg("Enlace inválido — falta el token de confirmación.");
      return;
    }
    const apiKey = import.meta.env.VITE_API_KEY as string | undefined;
    fetch(`${getApiBaseUrl()}/public/appointments/${encodeURIComponent(token)}/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "confirmed") {
          setState("confirmed");
          if (data.startAt) setStartAt(new Date(data.startAt).toLocaleString());
        } else if (data.error) {
          setState("error");
          setErrorMsg(data.error);
        } else {
          setState("already");
          if (data.startAt) setStartAt(new Date(data.startAt).toLocaleString());
        }
      })
      .catch(() => {
        setState("error");
        setErrorMsg("No se pudo conectar con el servidor. Intenta de nuevo.");
      });
  }, [token]);

  return (
    <div className="consent-page">
      <div className="consent-card">
        <div className="consent-logo">
          <span className="consent-logo-text">CliniSense</span>
        </div>

        {state === "loading" && (
          <div className="consent-loading">
            <div className="consent-spinner" />
            <p>Confirmando tu cita…</p>
          </div>
        )}

        {state === "confirmed" && (
          <div className="consent-success">
            <div className="consent-success-icon">✓</div>
            <h2>¡Cita confirmada!</h2>
            {startAt && <p className="consent-date">Fecha y hora: <strong>{startAt}</strong></p>}
            <p>Tu asistencia ha sido registrada. Te esperamos puntualmente.</p>
            <p className="consent-note">Si necesitas cancelar o cambiar tu cita, por favor contáctanos con anticipación.</p>
          </div>
        )}

        {state === "already" && (
          <div className="consent-success">
            <div className="consent-success-icon">✓</div>
            <h2>Cita ya confirmada</h2>
            {startAt && <p className="consent-date">Fecha y hora: <strong>{startAt}</strong></p>}
            <p>Tu cita ya estaba confirmada anteriormente.</p>
          </div>
        )}

        {state === "error" && (
          <div className="consent-error">
            <div className="consent-error-icon">✗</div>
            <h2>Enlace inválido</h2>
            <p>{errorMsg || "Este enlace de confirmación no es válido o ya expiró."}</p>
            <p className="consent-note">Si crees que esto es un error, contacta a tu clínica.</p>
          </div>
        )}
      </div>
    </div>
  );
}

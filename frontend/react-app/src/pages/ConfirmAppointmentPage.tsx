import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { clinicalApi } from "../api/clinical";
import { getApiBaseUrl } from "../lib/config";

type Action = "confirm" | "cancel" | "reschedule";
type Phase = "loading" | "choice" | "acting" | "done" | "error";

export default function ConfirmAppointmentPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [selectedAction, setSelectedAction] = useState<Action>("confirm");
  const [patientName, setPatientName] = useState("");
  const [startAt, setStartAt] = useState("");
  const [resultMsg, setResultMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setErrorMsg("Enlace inválido — falta el token de confirmación.");
      setPhase("error");
      return;
    }
    clinicalApi
      .getPublicAppointmentInfo(token)
      .then((data) => {
        setPatientName(data.patientName);
        if (data.startAt)
          setStartAt(new Date(data.startAt).toLocaleString("es-ES"));
        if (data.status === "cancelled") {
          setResultMsg("Esta cita ya fue cancelada.");
          setPhase("done");
        } else if (data.status === "completed") {
          setResultMsg("Esta consulta ya fue atendida.");
          setPhase("done");
        } else {
          setPhase("choice");
        }
      })
      .catch(() => {
        setErrorMsg("Enlace inválido o expirado.");
        setPhase("error");
      });
  }, [token]);

  async function handleAction() {
    setPhase("acting");
    try {
      if (selectedAction === "confirm") {
        const apiKey = import.meta.env.VITE_API_KEY as string | undefined;
        const base = getApiBaseUrl();
        const res = await fetch(
          `${base}/public/appointments/${encodeURIComponent(token)}/confirm`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(apiKey ? { "x-api-key": apiKey } : {}),
            },
          },
        );
        if (!res.ok) throw new Error("Error al confirmar la cita.");
        setResultMsg("¡Tu cita ha sido confirmada! Te esperamos puntualmente.");
      } else if (selectedAction === "cancel") {
        await clinicalApi.cancelPublicAppointment(token);
        setResultMsg(
          "Tu cita ha sido cancelada. Si deseas reagendar, contacta a tu clínica.",
        );
      } else {
        await clinicalApi.requestReschedulePublic(token);
        setResultMsg(
          "Tu solicitud de reprogramación fue enviada. Tu clínica se pondrá en contacto contigo.",
        );
      }
      setPhase("done");
    } catch (e: unknown) {
      setErrorMsg(
        e instanceof Error ? e.message : "Ocurrió un error. Intenta de nuevo.",
      );
      setPhase("error");
    }
  }

  const actionLabels: Record<
    Action,
    { label: string; icon: string; desc: string }
  > = {
    confirm: {
      label: "Confirmar asistencia",
      icon: "✓",
      desc: "Confirmaré mi presencia en la fecha indicada.",
    },
    cancel: {
      label: "Cancelar cita",
      icon: "✗",
      desc: "No podré asistir y deseo cancelar la cita.",
    },
    reschedule: {
      label: "Solicitar reprogramar",
      icon: "↺",
      desc: "Necesito un horario diferente.",
    },
  };

  return (
    <div className="consent-page">
      <div className="consent-card">
        <div className="consent-logo">
          <span className="consent-logo-text">DOCCO</span>
        </div>

        {phase === "loading" && (
          <div className="consent-loading">
            <div className="consent-spinner" />
            <p>Cargando información de tu cita…</p>
          </div>
        )}

        {phase === "acting" && (
          <div className="consent-loading">
            <div className="consent-spinner" />
            <p>Procesando tu solicitud…</p>
          </div>
        )}

        {phase === "choice" && (
          <div>
            <h2
              style={{ margin: "0 0 4px", color: "#1e293b", fontSize: "20px" }}
            >
              Tu cita
            </h2>
            {patientName && (
              <p
                style={{
                  margin: "0 0 2px",
                  color: "#64748b",
                  fontSize: "14px",
                }}
              >
                Paciente: <strong>{patientName}</strong>
              </p>
            )}
            {startAt && (
              <p
                style={{
                  margin: "0 0 20px",
                  color: "#64748b",
                  fontSize: "14px",
                }}
              >
                Fecha y hora: <strong>{startAt}</strong>
              </p>
            )}

            <p
              style={{ margin: "0 0 12px", fontSize: "14px", color: "#475569" }}
            >
              ¿Qué deseas hacer con esta cita?
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginBottom: "20px",
              }}
            >
              {(["confirm", "cancel", "reschedule"] as Action[]).map(
                (action) => {
                  const { label, icon, desc } = actionLabels[action];
                  const isSelected = selectedAction === action;
                  return (
                    <button
                      key={action}
                      onClick={() => setSelectedAction(action)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px",
                        padding: "12px 16px",
                        borderRadius: "10px",
                        border: isSelected
                          ? "2px solid #0d9488"
                          : "2px solid #e2e8f0",
                        background: isSelected ? "#f0fdfa" : "#fff",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "border-color 0.15s",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "18px",
                          color: isSelected ? "#0d9488" : "#94a3b8",
                          fontWeight: "bold",
                          minWidth: "20px",
                        }}
                      >
                        {icon}
                      </span>
                      <span>
                        <strong
                          style={{
                            display: "block",
                            fontSize: "14px",
                            color: "#1e293b",
                          }}
                        >
                          {label}
                        </strong>
                        <span style={{ fontSize: "12px", color: "#64748b" }}>
                          {desc}
                        </span>
                      </span>
                    </button>
                  );
                },
              )}
            </div>

            <button
              onClick={handleAction}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "none",
                background: "#0d9488",
                color: "#fff",
                fontSize: "15px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              {actionLabels[selectedAction].label}
            </button>
          </div>
        )}

        {phase === "done" && (
          <div className="consent-success">
            <div className="consent-success-icon">✓</div>
            <h2>Listo</h2>
            <p>{resultMsg}</p>
            {startAt && selectedAction === "confirm" && (
              <p className="consent-date">
                Fecha y hora: <strong>{startAt}</strong>
              </p>
            )}
          </div>
        )}

        {phase === "error" && (
          <div className="consent-error">
            <div className="consent-error-icon">✗</div>
            <h2>Ocurrió un problema</h2>
            <p>{errorMsg || "Este enlace no es válido o ya expiró."}</p>
            <p className="consent-note">
              Si crees que esto es un error, contacta a tu clínica.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, CalendarDays } from "lucide-react";
import type { AuthSession } from "../../types";

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Panel Principal", subtitle: "Resumen de actividad clínica del día" },
  "/dashboard/nuevo-tratamiento": { title: "Nuevo Tratamiento", subtitle: "Asistente de evaluación clínica" },
  "/dashboard/pacientes": { title: "Pacientes", subtitle: "Gestión de expedientes" },
  "/dashboard/citas": { title: "Agenda Médica", subtitle: "Programación de consultas" },
  "/dashboard/odontograma": { title: "Odontograma", subtitle: "Registro dental interactivo" },
  "/dashboard/planes": { title: "Tratamientos", subtitle: "Planes y seguimiento clínico" },
  "/dashboard/consentimientos": { title: "Documentos", subtitle: "Consentimientos y registros legales" },
  "/dashboard/usuarios": { title: "Usuarios", subtitle: "Gestión de equipo y roles" },
  "/dashboard/testing": { title: "Service Tester", subtitle: "Pruebas de integración de API" },
};

export function Topbar({ session, title, hamburger }: { session: AuthSession; onLogout: () => void; title: string; hamburger?: React.ReactNode }) {
  const navigate = useNavigate();
  const now = useMemo(() => {
    return new Date().toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  const meta =
    PAGE_META["/dashboard/" + title.toLowerCase().replace(/ /g, "-")] ||
    Object.values(PAGE_META).find((m) => m.title === title) ||
    { title, subtitle: "Panel clínico profesional" };

  const initials = (session.name || session.email || "U")
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="topbar">
      {hamburger}
      <div className="topbar-left">
        <div className="topbar-page-icon">
          <CalendarDays size={18} strokeWidth={1.5} color="#0ea5e9" />
        </div>
        <div className="topbar-page-info">
          <h1 className="topbar-title">{meta.title}</h1>
          <span className="topbar-subtitle">{meta.subtitle}</span>
        </div>
      </div>

      <div className="topbar-right">
        <button
          type="button"
          className="topbar-create-btn"
          onClick={() => navigate("/dashboard/citas")}
        >
          <Plus size={14} strokeWidth={2} />
          Crear cita
        </button>

        <div className="topbar-date">
          <span className="live-dot" />
          <span>{now}</span>
        </div>

        <div className="user-badge">
          <div className="user-meta">
            <strong>{session.name || "Médico"}</strong>
            <span style={{ display: "flex", gap: 5, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
              {session.orgName && (
                <span style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.68rem" }}>{session.orgName}</span>
              )}
              {session.orgName && <span style={{ color: "#cbd5e1" }}>·</span>}
              <span style={{
                background: "#f1f5f9",
                color: "#475569",
                padding: "1px 6px",
                borderRadius: 4,
                fontSize: "0.62rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                {session.role}
              </span>
            </span>
          </div>
          <div className="user-avatar">{initials}</div>
        </div>
      </div>
    </header>
  );
}

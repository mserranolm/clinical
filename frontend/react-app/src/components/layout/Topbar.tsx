import { useMemo } from "react";
import type { AuthSession } from "../../types";

const PAGE_META: Record<string, { title: string; subtitle: string; icon: string }> = {
  "/dashboard": { title: "Panel Principal", subtitle: "Resumen de actividad clínica del día", icon: "▣" },
  "/dashboard/nuevo-tratamiento": { title: "Nuevo Tratamiento", subtitle: "Asistente de evaluación clínica", icon: "+" },
  "/dashboard/pacientes": { title: "Pacientes", subtitle: "Gestión de expedientes", icon: "⊕" },
  "/dashboard/citas": { title: "Agenda Médica", subtitle: "Programación de consultas", icon: "◫" },
  "/dashboard/odontograma": { title: "Odontograma", subtitle: "Registro dental interactivo", icon: "◎" },
  "/dashboard/planes": { title: "Tratamientos", subtitle: "Planes y seguimiento clínico", icon: "≡" },
  "/dashboard/consentimientos": { title: "Documentos", subtitle: "Consentimientos y registros legales", icon: "◻" },
  "/dashboard/testing": { title: "Service Tester", subtitle: "Pruebas de integración de API", icon: "⚙" },
};

export function Topbar({ session, title }: { session: AuthSession; onLogout: () => void; title: string }) {
  const now = useMemo(() => {
    return new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }, []);

  const meta = PAGE_META["/dashboard/" + title.toLowerCase().replace(/ /g, "-")] ||
    Object.values(PAGE_META).find(m => m.title === title) ||
    { title, subtitle: "Panel clínico profesional", icon: "▣" };

  const initials = (session.name || session.email || "U").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-page-icon">{meta.icon}</div>
        <div className="topbar-page-info">
          <h1 className="topbar-title">{meta.title}</h1>
          <span className="topbar-subtitle">{meta.subtitle}</span>
        </div>
      </div>

      <div className="topbar-right">
        <div className="topbar-date">
          <span className="live-dot" />
          <span>{now}</span>
        </div>
        <div className="user-badge">
          <div className="user-meta">
            <strong>{session.name || "Médico"}</strong>
            <span>{session.email}</span>
          </div>
          <div className="user-avatar">{initials}</div>
        </div>
      </div>
    </header>
  );
}

import { useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";

export function Sidebar({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();

  const menu = useMemo(() => [
    { to: "/dashboard", label: "Panel Principal", icon: "📊" },
    { to: "/dashboard/nuevo-tratamiento", label: "Nuevo Tratamiento", icon: "✨" },
    { to: "/dashboard/pacientes", label: "Pacientes", icon: "👥" },
    { to: "/dashboard/citas", label: "Agenda Médica", icon: "📅" },
    { to: "/dashboard/consentimientos", label: "Documentos", icon: "📄" },
    { to: "/dashboard/odontograma", label: "Odontograma", icon: "🦷" },
    { to: "/dashboard/planes", label: "Tratamientos", icon: "📋" },
    { to: "/dashboard/testing", label: "Service Tester", icon: "🛠️" }
  ], []);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h2>Clini<span>Sense</span></h2>
        <small>Medical Admin Suite</small>
      </div>
      
      <nav>
        {menu.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/dashboard"}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="ghost logout-trigger" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

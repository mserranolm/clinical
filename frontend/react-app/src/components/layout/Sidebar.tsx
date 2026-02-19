import { NavLink } from "react-router-dom";

const NAV_GROUPS = [
  {
    label: "Principal",
    items: [
      { to: "/dashboard", label: "Panel Principal", icon: "▣", end: true },
    ]
  },
  {
    label: "Clínica",
    items: [
      { to: "/dashboard/nuevo-tratamiento", label: "Nuevo Tratamiento", icon: "+", badge: "", end: false },
      { to: "/dashboard/pacientes", label: "Pacientes", icon: "⊕", end: false },
      { to: "/dashboard/citas", label: "Agenda Médica", icon: "◫", end: false },
      { to: "/dashboard/odontograma", label: "Odontograma", icon: "◎", end: false },
      { to: "/dashboard/planes", label: "Tratamientos", icon: "≡", end: false },
    ]
  },
  {
    label: "Administración",
    items: [
      { to: "/dashboard/consentimientos", label: "Documentos", icon: "◻", end: false },
      { to: "/dashboard/testing", label: "Service Tester", icon: "⚙", end: false },
    ]
  }
];

export function Sidebar({ onLogout, userName }: { onLogout: () => void; userName?: string }) {
  const initials = userName ? userName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() : "DR";

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">🦷</span>
        </div>
        <div>
          <h2>Clini<span>Sense</span></h2>
          <small>Medical Admin Suite</small>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="nav-group">
            <span className="nav-group-label">{group.label}</span>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              >
                <span className="nav-item-icon">{item.icon}</span>
                <span className="nav-item-label">{item.label}</span>
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <strong>{userName || "Doctor"}</strong>
            <span>Médico Activo</span>
          </div>
        </div>
        <button className="sidebar-logout" onClick={onLogout}>
          <span>⏻</span> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

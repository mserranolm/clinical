import { NavLink } from "react-router-dom";

const ROLE_LABELS: Record<string, string> = {
  platform_admin: "Super Admin",
  admin: "Administrador",
  doctor: "Doctor",
  assistant: "Asistente",
  patient: "Paciente",
};

export function Sidebar({ onLogout, userName, role }: { onLogout: () => void; userName?: string; role?: string }) {
  const initials = userName ? userName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() : "SA";
  const isPlatformAdmin = role === "platform_admin";
  const isAdmin = role === "admin";

  if (isPlatformAdmin) {
    return (
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo"><span className="sidebar-logo-icon">🦷</span></div>
          <div><h2>Clini<span>Sense</span></h2><small>Plataforma</small></div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-group">
            <span className="nav-group-label">Plataforma</span>
            <NavLink to="/dashboard" end className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              <span className="nav-item-icon">🛡</span>
              <span className="nav-item-label">Consola de Plataforma</span>
            </NavLink>
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <strong>{userName || "Super Admin"}</strong>
              <span>Super Admin</span>
            </div>
          </div>
          <button className="sidebar-logout" onClick={onLogout}><span>⏻</span> Cerrar sesión</button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo"><span className="sidebar-logo-icon">🦷</span></div>
        <div><h2>Clini<span>Sense</span></h2><small>Medical Admin Suite</small></div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-group">
          <span className="nav-group-label">Principal</span>
          <NavLink to="/dashboard" end className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
            <span className="nav-item-icon">▣</span>
            <span className="nav-item-label">Panel Principal</span>
          </NavLink>
        </div>

        <div className="nav-group">
          <span className="nav-group-label">Clínica</span>
          <NavLink to="/dashboard/nuevo-tratamiento" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
            <span className="nav-item-icon">+</span>
            <span className="nav-item-label">Nuevo Tratamiento</span>
          </NavLink>
          <NavLink to="/dashboard/pacientes" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
            <span className="nav-item-icon">⊕</span>
            <span className="nav-item-label">Pacientes</span>
          </NavLink>
          <NavLink to="/dashboard/citas" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
            <span className="nav-item-icon">◫</span>
            <span className="nav-item-label">Agenda Médica</span>
          </NavLink>
          <NavLink to="/dashboard/odontograma" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
            <span className="nav-item-icon">◎</span>
            <span className="nav-item-label">Odontograma</span>
          </NavLink>
          <NavLink to="/dashboard/planes" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
            <span className="nav-item-icon">≡</span>
            <span className="nav-item-label">Tratamientos</span>
          </NavLink>
        </div>

        <div className="nav-group">
          <span className="nav-group-label">Administración</span>
          <NavLink to="/dashboard/consentimientos" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
            <span className="nav-item-icon">◻</span>
            <span className="nav-item-label">Documentos</span>
          </NavLink>
          {isAdmin && (
            <NavLink to="/dashboard/usuarios" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              <span className="nav-item-icon">👥</span>
              <span className="nav-item-label">Usuarios</span>
            </NavLink>
          )}
          <NavLink to="/dashboard/testing" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
            <span className="nav-item-icon">⚙</span>
            <span className="nav-item-label">Service Tester</span>
          </NavLink>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <strong>{userName || "Doctor"}</strong>
            <span>{ROLE_LABELS[role ?? ""] ?? "Médico Activo"}</span>
          </div>
        </div>
        <button className="sidebar-logout" onClick={onLogout}><span>⏻</span> Cerrar sesión</button>
      </div>
    </aside>
  );
}

import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import type { AuthSession } from "../../types";
import { AdminConsoleHome } from "../../pages/admin/AdminConsoleHome";

export function AdminConsoleLayout({ session, onLogout }: { session: AuthSession; onLogout: () => void }) {
  const navigate = useNavigate();
  const initials = session.name ? session.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() : "PA";

  return (
    <main className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <span className="sidebar-logo-icon">🛡</span>
          </div>
          <div>
            <h2>Clini<span>Sense</span></h2>
            <small>Consola de Plataforma</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group">
            <span className="nav-group-label">Plataforma</span>
            <NavLink to="/admin" end className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              <span className="nav-item-icon">🏢</span>
              <span className="nav-item-label">Organizaciones</span>
            </NavLink>
          </div>
          <div className="nav-group">
            <span className="nav-group-label">Navegación</span>
            <button className="nav-item" style={{ background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
              onClick={() => navigate("/dashboard")}>
              <span className="nav-item-icon">◁</span>
              <span className="nav-item-label">Volver al Dashboard</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <strong>{session.name || session.email}</strong>
              <span>Super Admin</span>
            </div>
          </div>
          <button className="sidebar-logout" onClick={onLogout}>
            <span>⏻</span> Cerrar sesión
          </button>
        </div>
      </aside>

      <section className="content-area">
        <div className="page-content">
          <Routes>
            <Route index element={<AdminConsoleHome session={session} />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </section>
    </main>
  );
}

import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  GitGraph,
  ClipboardList,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { Logo } from "../ui/Logo";

const ROLE_LABELS: Record<string, string> = {
  platform_admin: "Super Admin",
  admin: "Administrador",
  doctor: "Doctor",
  assistant: "Asistente",
  patient: "Paciente",
};

type NavItemDef = { to: string; label: string; icon: React.ReactNode; end?: boolean };

export function Sidebar({ onLogout, userName, role }: { onLogout: () => void; userName?: string; role?: string }) {
  const initials = userName
    ? userName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "SA";
  const isPlatformAdmin = role === "platform_admin";
  const isAdmin = role === "admin";

  const iconProps = { size: 15, strokeWidth: 1.5 };

  const clinicItems: NavItemDef[] = [
    { to: "/dashboard", label: "Panel Principal", icon: <LayoutDashboard {...iconProps} />, end: true },
  ];
  const clinicaItems: NavItemDef[] = [
    { to: "/dashboard/pacientes", label: "Pacientes", icon: <Users {...iconProps} /> },
    { to: "/dashboard/citas", label: "Agenda Médica", icon: <Calendar {...iconProps} /> },
  ];
  const adminItems: NavItemDef[] = [
    { to: "/dashboard/usuarios", label: "Usuarios", icon: <Users {...iconProps} /> },
  ];
  // Solo admin organización: gestión de plantillas. Tratamientos, Documentos y Odontograma son parte de la consulta (doctor).
  const adminOnlyTools: NavItemDef[] = [
    { to: "/dashboard/plantillas-consentimiento", label: "Plantillas Consentimiento", icon: <ShieldCheck {...iconProps} /> },
  ];
  // Herramientas de consulta: solo para admin de la organización (ni doctor ni asistente).
  const consultaTools: NavItemDef[] = [
    { to: "/dashboard/consentimientos", label: "Documentos", icon: <FileText {...iconProps} /> },
    { to: "/dashboard/odontograma", label: "Odontograma", icon: <GitGraph {...iconProps} /> },
    { to: "/dashboard/planes", label: "Tratamientos", icon: <ClipboardList {...iconProps} /> },
  ];
  const showConsultaTools = isAdmin;

  if (isPlatformAdmin) {
    return (
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo variant="color" className="sidebar-logo-svg" />
          <small className="sidebar-brand-tag">Plataforma</small>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-group">
            <span className="nav-group-label">Plataforma</span>
            <NavLink to="/dashboard" end className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              <span className="nav-item-icon"><ShieldCheck {...iconProps} /></span>
              <span className="nav-item-label">Consola de Plataforma</span>
            </NavLink>
          </div>
        </nav>
        <SidebarFooter initials={initials} userName={userName} role={role} onLogout={onLogout} />
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Logo variant="color" className="sidebar-logo-svg" />
        <small className="sidebar-brand-tag">Medical Suite</small>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-group">
          <span className="nav-group-label">Principal</span>
          {clinicItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              <span className="nav-item-icon">{item.icon}</span>
              <span className="nav-item-label">{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="nav-group">
          <span className="nav-group-label">Clínica</span>
          {clinicaItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
              <span className="nav-item-icon">{item.icon}</span>
              <span className="nav-item-label">{item.label}</span>
            </NavLink>
          ))}
        </div>

        {showConsultaTools && (
          <div className="nav-group">
            <span className="nav-group-label">Herramientas</span>
            {consultaTools.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
                <span className="nav-item-icon">{item.icon}</span>
                <span className="nav-item-label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}

        {isAdmin && (
          <div className="nav-group">
            <span className="nav-group-label">Herramientas</span>
            {adminOnlyTools.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
                <span className="nav-item-icon">{item.icon}</span>
                <span className="nav-item-label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}

        {isAdmin && (
          <div className="nav-group">
            <span className="nav-group-label">Administración</span>
            {adminItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
                <span className="nav-item-icon">{item.icon}</span>
                <span className="nav-item-label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <SidebarFooter initials={initials} userName={userName} role={role} onLogout={onLogout} />
    </aside>
  );
}

function SidebarFooter({ initials, userName, role, onLogout }: {
  initials: string; userName?: string; role?: string; onLogout: () => void;
}) {
  return (
    <div className="sidebar-footer">
      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{initials}</div>
        <div className="sidebar-user-info">
          <strong>{userName || "Usuario"}</strong>
          <span>{ROLE_LABELS[role ?? ""] ?? "Médico"}</span>
        </div>
      </div>
      <button className="sidebar-logout" onClick={onLogout}>
        <LogOut size={13} strokeWidth={1.5} />
        Cerrar sesión
      </button>
    </div>
  );
}

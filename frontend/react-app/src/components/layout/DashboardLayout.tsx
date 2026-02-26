import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { clinicalApi } from "../../api/clinical";
import { AuthSession } from "../../types";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

// Page components
import { ServiceTester } from "../../modules/testing/ServiceTester";
import { AdminConsoleHome } from "../../pages/admin/AdminConsoleHome";
import { AppointmentsPage } from "../../pages/AppointmentsPage";
import { ConsultaPage } from "../../pages/ConsultaPage";
import { DashboardHome } from "../../pages/DashboardHome";
import { OdontogramPage } from "../../pages/OdontogramPage";
import { PatientDetailPage } from "../../pages/PatientDetailPage";
import { PatientsPage } from "../../pages/PatientsPage";
import { PlansPage } from "../../pages/PlansPage";
import { TreatmentWizard } from "../../pages/TreatmentWizard";
import { UsersAdminPage } from "../../pages/UsersAdminPage";

type DashboardAppointmentRow = {
  id: string;
  patientId: string;
  patientName?: string;
  startAt: string;
  status: string;
  paymentAmount?: number;
  consentSummary?: { total: number; accepted: number };
};

export function DashboardLayout({ session, onLogout }: { session: AuthSession; onLogout: () => void }) {
  const location = useLocation();
  const isPlatformAdmin = session.role === "platform_admin";
  const scopedDoctorId = session.role === "doctor" ? session.userId : "";

  const [appointmentsDate, setAppointmentsDate] = useState(new Date().toISOString().slice(0, 10));
  const [appointmentRows, setAppointmentRows] = useState<DashboardAppointmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cierra el drawer al navegar
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const platformMenu = [
    { to: "/dashboard", label: "Consola de Plataforma" },
  ];

  const clinicMenu = [
    { to: "/dashboard", label: "Panel Principal" },
    { to: "/dashboard/nuevo-tratamiento", label: "Nuevo Tratamiento" },
    { to: "/dashboard/pacientes", label: "Pacientes" },
    { to: "/dashboard/citas", label: "Agenda Médica" },
    { to: "/dashboard/odontograma", label: "Odontograma" },
    { to: "/dashboard/planes", label: "Tratamientos" },
    { to: "/dashboard/testing", label: "Service Tester" },
  ];

  const menu = isPlatformAdmin ? platformMenu : clinicMenu;
  const currentLabel = menu.find(m => m.to === location.pathname)?.label || "Dashboard";

  useEffect(() => {
    if (!isPlatformAdmin && location.pathname === "/dashboard") {
      loadDashboardData();
    }
  }, [location.pathname, appointmentsDate, session]);

  // Al volver a esta pestaña, refrescar citas por si el paciente confirmó/aceptó consentimientos desde el correo
  useEffect(() => {
    if (isPlatformAdmin || location.pathname !== "/dashboard") return;
    const onFocus = () => loadDashboardData();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [location.pathname, appointmentsDate, session]);

  // Auto-refresh Panel Principal (Citas de la Jornada)
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!isPlatformAdmin && location.pathname === "/dashboard" && autoRefreshSeconds > 0) {
      intervalRef.current = setInterval(() => loadDashboardData(), autoRefreshSeconds * 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefreshSeconds, location.pathname, isPlatformAdmin]);

  async function loadDashboardData() {
    setLoading(true);
    setError("");
    try {
      const [appointmentsRes, patientsRes] = await Promise.all([
        clinicalApi.listAppointments(scopedDoctorId, appointmentsDate, session.token),
        clinicalApi.listPatients("", session.token)
      ]);

      const patientById = new Map(
        (patientsRes.items || []).map((patient) => [patient.id, `${patient.firstName} ${patient.lastName}`.trim()])
      );

      const normalizedRows: DashboardAppointmentRow[] = (appointmentsRes.items || []).map((appointment) => ({
        id: appointment.id,
        patientId: appointment.patientId,
        patientName: patientById.get(appointment.patientId),
        startAt: appointment.startAt,
        status: appointment.status,
        paymentAmount: appointment.paymentAmount,
        consentSummary: appointment.consentSummary
      }));

      setAppointmentRows(normalizedRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const sidebarProps = { onLogout, userName: session.name, role: session.role };

  const drawerSidebar = (
    <>
      {/* Overlay */}
      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />
      )}
      {/* Drawer */}
      <div className={`sidebar-drawer${drawerOpen ? " drawer-open" : ""}`}>
        <Sidebar {...sidebarProps} />
      </div>
    </>
  );

  const hamburger = (
    <button
      className="hamburger-btn"
      onClick={() => setDrawerOpen(o => !o)}
      aria-label="Abrir menú"
    >
      {drawerOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
    </button>
  );

  if (isPlatformAdmin) {
    return (
      <main className="admin-layout">
        {drawerSidebar}
        <div className="sidebar-desktop"><Sidebar {...sidebarProps} /></div>
        <section className="content-area">
          <Topbar session={session} onLogout={onLogout} title="Consola de Plataforma" hamburger={hamburger} />
          <div className="page-content">
            <Routes>
              <Route index element={<AdminConsoleHome session={session} />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-layout">
      {drawerSidebar}
      <div className="sidebar-desktop"><Sidebar {...sidebarProps} /></div>
      <section className="content-area">
        <Topbar session={session} onLogout={onLogout} title={currentLabel} hamburger={hamburger} />
        <div className="page-content">
          <Routes>
            <Route index element={<DashboardHome user={session} rows={appointmentRows} loading={loading} error={error} date={appointmentsDate} onDateChange={setAppointmentsDate} onRefresh={loadDashboardData} autoRefreshSeconds={autoRefreshSeconds} onAutoRefreshChange={setAutoRefreshSeconds} />} />
            <Route path="nuevo-tratamiento" element={<TreatmentWizard token={session.token} doctorId={session.userId} />} />
            <Route path="consulta" element={<ConsultaPage token={session.token} doctorId={session.userId} />} />
            <Route path="pacientes" element={<PatientsPage token={session.token} doctorId="" session={session} />} />
            <Route path="pacientes/:patientId" element={<PatientDetailPage token={session.token} />} />
            <Route path="citas" element={<AppointmentsPage token={session.token} doctorId={scopedDoctorId} session={session} />} />
            <Route path="odontograma" element={<OdontogramPage token={session.token} doctorId={scopedDoctorId} />} />
            <Route path="planes" element={<PlansPage token={session.token} doctorId={scopedDoctorId} />} />
            <Route path="usuarios" element={<UsersAdminPage session={session} />} />
            <Route path="testing" element={<ServiceTester session={session} onSessionChange={() => onLogout()} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </section>
    </main>
  );
}

import { useState, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { clinicalApi } from "./api/clinical";
import { clearSession, getSession, saveSession } from "./lib/session";
import { AuthSession } from "./types";

// Layout components
import { Sidebar } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";

// Page components
import { Landing } from "./pages/Landing";
import { LoginView } from "./pages/LoginView";
import { DashboardHome } from "./pages/DashboardHome";
import { PatientsPage } from "./pages/PatientsPage";
import { AppointmentsPage } from "./pages/AppointmentsPage";
import { ConsentsPage } from "./pages/ConsentsPage";
import { OdontogramPage } from "./pages/OdontogramPage";
import { PlansPage } from "./pages/PlansPage";
import { TreatmentWizard } from "./pages/TreatmentWizard";
import { ServiceTester } from "./modules/testing/ServiceTester";

const initialSession = getSession();

function DashboardLayout({ session, onLogout }: { session: AuthSession; onLogout: () => void }) {
  const location = useLocation();
  const [appointmentsDate, setAppointmentsDate] = useState(new Date().toISOString().slice(0, 10));
  const [appointmentRows, setAppointmentRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const menu = [
    { to: "/dashboard", label: "Panel Principal" },
    { to: "/dashboard/nuevo-tratamiento", label: "Nuevo Tratamiento" },
    { to: "/dashboard/pacientes", label: "Pacientes" },
    { to: "/dashboard/citas", label: "Agenda Médica" },
    { to: "/dashboard/consentimientos", label: "Documentos" },
    { to: "/dashboard/odontograma", label: "Odontograma" },
    { to: "/dashboard/planes", label: "Tratamientos" },
    { to: "/dashboard/testing", label: "Service Tester" }
  ];

  const currentLabel = menu.find(m => m.to === location.pathname)?.label || "Dashboard";

  useEffect(() => {
    if (location.pathname === "/dashboard") {
      loadDashboardData();
    }
  }, [location.pathname, appointmentsDate, session]);

  async function loadDashboardData() {
    setLoading(true);
    setError("");
    try {
      const res = await clinicalApi.listAppointments(session.userId, appointmentsDate, session.token);
      setAppointmentRows(res.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-layout">
      <Sidebar onLogout={onLogout} />
      <section className="content-area">
        <Topbar session={session} onLogout={onLogout} title={currentLabel} />
        <div className="page-content">
          <Routes>
            <Route index element={<DashboardHome user={session} rows={appointmentRows} loading={loading} error={error} date={appointmentsDate} onDateChange={setAppointmentsDate} />} />
            <Route path="nuevo-tratamiento" element={<TreatmentWizard token={session.token} doctorId={session.userId} />} />
            <Route path="pacientes" element={<PatientsPage token={session.token} doctorId={session.userId} />} />
            <Route path="citas" element={<AppointmentsPage token={session.token} doctorId={session.userId} />} />
            <Route path="consentimientos" element={<ConsentsPage token={session.token} doctorId={session.userId} />} />
            <Route path="odontograma" element={<OdontogramPage token={session.token} doctorId={session.userId} />} />
            <Route path="planes" element={<PlansPage token={session.token} doctorId={session.userId} />} />
            <Route path="testing" element={<ServiceTester session={session} onSessionChange={() => onLogout()} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </section>
    </main>
  );
}

export function App() {
  const [session, setSession] = useState<AuthSession | null>(initialSession);

  function handleAuthSuccess(nextSession: AuthSession) {
    saveSession(nextSession);
    setSession(nextSession);
  }

  function handleLogout() {
    clearSession();
    setSession(null);
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <LoginView onSuccess={handleAuthSuccess} />} />
      <Route path="/dashboard/*" element={session ? <DashboardLayout session={session} onLogout={handleLogout} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to={session ? "/dashboard" : "/"} replace />} />
    </Routes>
  );
}

import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppointmentDTO, clinicalApi } from "../../api/clinical";
import { AuthSession } from "../../types";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

// Page components
import { ServiceTester } from "../../modules/testing/ServiceTester";
import { AppointmentsPage } from "../../pages/AppointmentsPage";
import { ConsentsPage } from "../../pages/ConsentsPage";
import { DashboardHome } from "../../pages/DashboardHome";
import { OdontogramPage } from "../../pages/OdontogramPage";
import { PatientsPage } from "../../pages/PatientsPage";
import { PlansPage } from "../../pages/PlansPage";
import { TreatmentWizard } from "../../pages/TreatmentWizard";

export function DashboardLayout({ session, onLogout }: { session: AuthSession; onLogout: () => void }) {
  const location = useLocation();
  const [appointmentsDate, setAppointmentsDate] = useState(new Date().toISOString().slice(0, 10));
  const [appointmentRows, setAppointmentRows] = useState<AppointmentDTO[]>([]);
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
      <Sidebar onLogout={onLogout} userName={session.name} />
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

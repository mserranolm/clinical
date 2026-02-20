import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { clinicalApi } from "../../api/clinical";
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
import { ConsultaPage } from "../../pages/ConsultaPage";
import { UsersAdminPage } from "../../pages/UsersAdminPage";
import { AdminConsoleHome } from "../../pages/admin/AdminConsoleHome";

type DashboardAppointmentRow = {
  id: string;
  patientId: string;
  patientName?: string;
  startAt: string;
  status: string;
  paymentAmount?: number;
};

export function DashboardLayout({ session, onLogout }: { session: AuthSession; onLogout: () => void }) {
  const location = useLocation();
  const isPlatformAdmin = session.role === "platform_admin";
  // Doctors scope patients/appointments to themselves; admin and assistant see the full org
  const scopedDoctorId = session.role === "doctor" ? session.userId : "";

  const [appointmentsDate, setAppointmentsDate] = useState(new Date().toISOString().slice(0, 10));
  const [appointmentRows, setAppointmentRows] = useState<DashboardAppointmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const platformMenu = [
    { to: "/dashboard", label: "Consola de Plataforma" },
  ];

  const clinicMenu = [
    { to: "/dashboard", label: "Panel Principal" },
    { to: "/dashboard/nuevo-tratamiento", label: "Nuevo Tratamiento" },
    { to: "/dashboard/pacientes", label: "Pacientes" },
    { to: "/dashboard/citas", label: "Agenda Médica" },
    { to: "/dashboard/consentimientos", label: "Documentos" },
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

  async function loadDashboardData() {
    setLoading(true);
    setError("");
    try {
      const [appointmentsRes, patientsRes] = await Promise.all([
        clinicalApi.listAppointments(scopedDoctorId, appointmentsDate, session.token),
        clinicalApi.listPatients(scopedDoctorId, session.token)
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
        paymentAmount: appointment.paymentAmount
      }));

      setAppointmentRows(normalizedRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  // platform_admin: render only the platform console, no sidebar clinic menu
  if (isPlatformAdmin) {
    return (
      <main className="admin-layout">
        <Sidebar onLogout={onLogout} userName={session.name} role={session.role} />
        <section className="content-area">
          <Topbar session={session} onLogout={onLogout} title="Consola de Plataforma" />
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
      <Sidebar onLogout={onLogout} userName={session.name} role={session.role} />
      <section className="content-area">
        <Topbar session={session} onLogout={onLogout} title={currentLabel} />
        <div className="page-content">
          <Routes>
            <Route index element={<DashboardHome user={session} rows={appointmentRows} loading={loading} error={error} date={appointmentsDate} onDateChange={setAppointmentsDate} onRefresh={loadDashboardData} />} />
            <Route path="nuevo-tratamiento" element={<TreatmentWizard token={session.token} doctorId={session.userId} />} />
            <Route path="consulta" element={<ConsultaPage token={session.token} doctorId={session.userId} />} />
            <Route path="pacientes" element={<PatientsPage token={session.token} doctorId={scopedDoctorId} session={session} />} />
            <Route path="citas" element={<AppointmentsPage token={session.token} doctorId={scopedDoctorId} session={session} />} />
            <Route path="consentimientos" element={<ConsentsPage token={session.token} doctorId={scopedDoctorId} />} />
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

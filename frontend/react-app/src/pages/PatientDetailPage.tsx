import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { clinicalApi } from "../api/clinical";
import { notify } from "../lib/notify";
import { OdontogramChart } from "../modules/treatment/components/OdontogramChart";
import {
    type ToothState,
    deserializeToothState,
} from "../modules/treatment/components/odontogram-types";

type PatientDetailData = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  documentId?: string;
  birthDate?: string;
  medicalBackgrounds?: Array<{ type: string; description: string }>;
};

type AppointmentDetail = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  treatmentPlan?: string;
  evolutionNotes?: string;
  paymentAmount?: number;
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Pendiente",
  confirmed: "Confirmada",
  in_progress: "En consulta",
  completed: "Finalizada",
  cancelled: "Cancelada",
};

const STATUS_CLASS: Record<string, string> = {
  scheduled: "status-unconfirmed",
  confirmed: "status-confirmed",
  in_progress: "status-in-progress",
  completed: "status-completed",
  cancelled: "status-cancelled",
};

const HISTORY_LABELS: Record<string, string> = {
  medication: "Medicamentos",
  allergy_med: "Alergia a medicamentos",
  allergies: "Alergias",
  anemia: "Anemia",
  hepatitis: "Hepatitis",
  diabetes: "Diabetes",
  hypertension: "Hipertensión",
  cholesterol: "Colesterol",
  notes: "Notas médicas",
};

function formatDateTime(iso: string) {
  const dt = new Date(iso);
  return {
    date: dt.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }),
    time: dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

export function PatientDetailPage({ token }: { token: string }) {
  const navigate = useNavigate();
  const { patientId = "" } = useParams();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"general" | "historial" | "odontograma" | "citas">("general");
  const [search, setSearch] = useState("");
  const [patient, setPatient] = useState<PatientDetailData | null>(null);
  const [appointments, setAppointments] = useState<AppointmentDetail[]>([]);
  const [toothStates, setToothStates] = useState<Record<number, ToothState>>({});

  useEffect(() => {
    if (!patientId) {
      navigate("/dashboard/pacientes");
      return;
    }

    async function loadData() {
      setLoading(true);
      try {
        const [patientRes, appointmentsRes, odontogramRes] = await Promise.allSettled([
          clinicalApi.getPatient(patientId, token),
          clinicalApi.listAppointmentsByPatient(patientId, token),
          clinicalApi.getOdontogramByPatient(patientId, token),
        ]);

        if (patientRes.status === "fulfilled") {
          setPatient(patientRes.value as PatientDetailData);
        }

        if (appointmentsRes.status === "fulfilled") {
          const items = (appointmentsRes.value.items ?? []) as AppointmentDetail[];
          items.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
          setAppointments(items);
        }

        if (odontogramRes.status === "fulfilled" && Array.isArray(odontogramRes.value.teeth)) {
          const nextStates: Record<number, ToothState> = {};
          (odontogramRes.value.teeth as Array<{ toothNumber: number }>).forEach((tooth) => {
            nextStates[tooth.toothNumber] = deserializeToothState(tooth);
          });
          setToothStates(nextStates);
        }
      } catch (error) {
        notify.error("Error cargando detalle del paciente", error instanceof Error ? error.message : String(error));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [patientId, token, navigate]);

  const filteredAppointments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter((appt) => {
      const haystack = `${appt.treatmentPlan ?? ""} ${appt.evolutionNotes ?? ""} ${STATUS_LABEL[appt.status] ?? appt.status}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [appointments, search]);

  const age = patient?.birthDate
    ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  if (loading) {
    return (
      <div className="consulta-loading">
        <div className="auth-spinner" />
        <p>Cargando detalle del paciente...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="consulta-loading">
        <p>No se encontró el paciente.</p>
        <button className="action-btn" onClick={() => navigate("/dashboard/pacientes")}>Volver</button>
      </div>
    );
  }

  return (
    <section className="page-section patient-detail-page">
      <div className="patient-detail-header card elite-card">
        <div className="patient-detail-headline">
          <button className="consulta-back-btn" onClick={() => navigate("/dashboard/pacientes")}>← Volver a pacientes</button>
          <h2>Paciente</h2>
        </div>

        <div className="patient-detail-grid">
          <div>
            <label>Nombre</label>
            <strong>{patient.firstName}</strong>
          </div>
          <div>
            <label>Apellido</label>
            <strong>{patient.lastName}</strong>
          </div>
          <div>
            <label>Email</label>
            <strong>{patient.email || "—"}</strong>
          </div>
          <div>
            <label>Número de teléfono</label>
            <strong>{patient.phone || "—"}</strong>
          </div>
          <div>
            <label>Cédula / ID</label>
            <strong>{patient.documentId || patient.id}</strong>
          </div>
          <div>
            <label>Edad</label>
            <strong>{age !== null ? `${age} años` : "—"}</strong>
          </div>
        </div>
      </div>

      <article className="card elite-card patient-detail-content">
        <div className="patient-detail-tabs">
          <button type="button" className={`patient-detail-tab-btn ${activeTab === "general" ? "active" : ""}`} onClick={() => setActiveTab("general")}>General</button>
          <button type="button" className={`patient-detail-tab-btn ${activeTab === "historial" ? "active" : ""}`} onClick={() => setActiveTab("historial")}>Historia médica</button>
          <button type="button" className={`patient-detail-tab-btn ${activeTab === "odontograma" ? "active" : ""}`} onClick={() => setActiveTab("odontograma")}>Odontograma</button>
          <button type="button" className={`patient-detail-tab-btn ${activeTab === "citas" ? "active" : ""}`} onClick={() => setActiveTab("citas")}>Citas</button>
        </div>

        {activeTab === "general" && (
          <div className="patient-detail-panel">
            <div className="patient-summary-grid">
              <div className="patient-summary-card">
                <span>Total de citas</span>
                <strong>{appointments.length}</strong>
              </div>
              <div className="patient-summary-card">
                <span>Citas finalizadas</span>
                <strong>{appointments.filter((a) => a.status === "completed").length}</strong>
              </div>
              <div className="patient-summary-card">
                <span>Con odontograma</span>
                <strong>{Object.keys(toothStates).length > 0 ? "Sí" : "No"}</strong>
              </div>
            </div>
          </div>
        )}

        {activeTab === "historial" && (
          <div className="patient-detail-panel">
            <h3>Historial médico</h3>
            {(patient.medicalBackgrounds ?? []).length === 0 ? (
              <p className="text-muted-sm">Sin antecedentes médicos registrados.</p>
            ) : (
              <div className="patient-history-list">
                {(patient.medicalBackgrounds ?? []).map((item, idx) => (
                  <div key={`${item.type}-${idx}`} className="patient-history-item">
                    <span>{HISTORY_LABELS[item.type] ?? item.type}</span>
                    <p>{item.description || "Sí"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "odontograma" && (
          <div className="patient-detail-panel">
            <h3>Odontograma</h3>
            <p className="consulta-hint">Vista de solo lectura del último estado registrado.</p>
            <OdontogramChart toothStates={toothStates} readOnly patientAge={age} />
          </div>
        )}

        {activeTab === "citas" && (
          <div className="patient-detail-panel">
            <div className="patient-detail-citas-header">
              <h3>Consultas</h3>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar consulta..."
                className="elite-input"
              />
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Motivo de la consulta</th>
                    <th>Estado</th>
                    <th>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.map((appt) => {
                    const dt = formatDateTime(appt.startAt);
                    return (
                      <tr key={appt.id}>
                        <td>{dt.date} · {dt.time}</td>
                        <td>{appt.treatmentPlan || appt.evolutionNotes || "Sin detalle"}</td>
                        <td>
                          <span className={`badge ${STATUS_CLASS[appt.status] ?? "status-unconfirmed"}`}>
                            {STATUS_LABEL[appt.status] ?? appt.status}
                          </span>
                        </td>
                        <td>{appt.paymentAmount != null ? `$${appt.paymentAmount.toFixed(2)}` : "—"}</td>
                      </tr>
                    );
                  })}
                  {filteredAppointments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty-state">
                        <div className="empty-state-content">
                          <strong>0 resultados.</strong>
                          <p>No hay registros creados hasta ahora.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}

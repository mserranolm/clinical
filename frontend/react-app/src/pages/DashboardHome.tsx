import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AuthSession } from "../types";
import { clinicalApi } from "../api/clinical";
import { notify } from "../lib/notify";
import { canManageTreatments } from "../lib/rbac";

type AppointmentRow = {
  id: string;
  patientId: string;
  patientName?: string;
  startAt: string;
  status: string;
  paymentAmount?: number;
};

export function DashboardHome({ user, rows, loading, error, date, onDateChange }: { 
  user: AuthSession; 
  rows: AppointmentRow[]; 
  loading: boolean;
  error: string;
  date: string;
  onDateChange: (date: string) => void;
}) {
  const navigate = useNavigate();
  const [showPatientsBreakdown, setShowPatientsBreakdown] = useState(false);

  const isConfirmed = (status: string) => status === "confirmed";
  const confirmedRows = useMemo(() => rows.filter((r) => isConfirmed(r.status)), [rows]);
  const unconfirmedRows = useMemo(() => rows.filter((r) => !isConfirmed(r.status)), [rows]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const confirmed = confirmedRows.length;
    const unconfirmed = unconfirmedRows.length;
    return [
      { label: "Citas del día", value: String(total), trend: loading ? "Actualizando..." : "En vivo" },
      { label: "Confirmados", value: String(confirmed), trend: "Ver listado", clickable: true },
      { label: "No confirmados", value: String(unconfirmed), trend: "Ver listado", clickable: true }
    ];
  }, [confirmedRows.length, loading, rows.length, unconfirmedRows.length]);

  const statusClass = (status: string) => (isConfirmed(status) ? "status-confirmed" : "status-unconfirmed");

  const patientLabel = (row: AppointmentRow) => row.patientName || row.patientId;

  const goToTreatment = (row: AppointmentRow) => {
    navigate(`/dashboard/nuevo-tratamiento?patientId=${encodeURIComponent(row.patientId)}`);
  };

  // Removed duplicate create appointment button from header

  const onResend = (id: string) => {
    const promise = clinicalApi.resendAppointmentConfirmation(id, user.token);
    notify.promise(promise, {
      loading: "Reenviando confirmación...",
      success: () => "Confirmación reenviada",
      error: "Error al reenviar",
    });
  };

  return (
    <section className="page-section">
      <div className="stats-grid">
        {kpis.map((card) => (
          <article key={card.label} className="stat-card elite-card">
            <small>{card.label}</small>
            <h3>{card.value}</h3>
            {card.clickable ? (
              <button type="button" className="link-btn" onClick={() => setShowPatientsBreakdown((prev) => !prev)}>
                {card.trend}
              </button>
            ) : (
              <span>{card.trend}</span>
            )}
          </article>
        ))}
      </div>

      {showPatientsBreakdown ? (
        <article className="card elite-card" style={{ marginBottom: 24 }}>
          <header className="card-header" style={{ marginBottom: 16 }}>
            <h3>Listado de pacientes por estado</h3>
          </header>
          <div className="grid-2-cols">
            <div>
              <h4 style={{ marginBottom: 8 }}>Confirmados ({confirmedRows.length})</h4>
              <ul className="patient-status-list">
                {confirmedRows.map((row) => (
                  <li key={`confirmed-${row.id}`}>{patientLabel(row)}</li>
                ))}
                {confirmedRows.length === 0 ? <li>Sin pacientes confirmados.</li> : null}
              </ul>
            </div>
            <div>
              <h4 style={{ marginBottom: 8 }}>No confirmados ({unconfirmedRows.length})</h4>
              <ul className="patient-status-list">
                {unconfirmedRows.map((row) => (
                  <li key={`unconfirmed-${row.id}`}>{patientLabel(row)}</li>
                ))}
                {unconfirmedRows.length === 0 ? <li>Sin pacientes pendientes.</li> : null}
              </ul>
            </div>
          </div>
        </article>
      ) : null}

      <article className="chart-card elite-card">
        <header className="card-header">
          <div className="header-copy">
            <h3>Citas de la Jornada</h3>
            <p>Vista detallada de la agenda seleccionada.</p>
          </div>
          <div className="header-actions">
            <input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
          </div>
        </header>
        
        {error ? <div className="auth-error">{error}</div> : null}
        
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Paciente</th>
                <th>Horario</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.id.split("-")[0]}...</td>
                  <td><strong>{patientLabel(row)}</strong></td>
                  <td>{new Date(row.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>
                    <span className={`badge ${statusClass(row.status)}`}>{isConfirmed(row.status) ? "confirmada" : "no confirmada"}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      {canManageTreatments(user) && (
                        <button type="button" className="action-btn action-btn-treat" onClick={() => goToTreatment(row)}>
                          <span>Atender</span>
                          <span className="icon">→</span>
                        </button>
                      )}
                      <button type="button" className="action-btn" onClick={() => onResend(row.id)}>
                        <span className="icon">✉️</span>
                        <span>Reenviar</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} className="empty-state">No se encontraron citas para esta fecha.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

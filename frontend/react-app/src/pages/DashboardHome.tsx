import React, { useMemo } from "react";
import type { AuthSession } from "../types";

type AppointmentRow = {
  id: string;
  patientId: string;
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
  const kpis = useMemo(() => {
    const total = rows.length;
    const confirmed = rows.filter((r) => r.status === "confirmed").length;
    const completed = rows.filter((r) => r.status === "completed").length;
    const revenue = rows.reduce((acc, row) => acc + Number(row.paymentAmount || 0), 0);
    return [
      { label: "Citas del día", value: String(total), trend: loading ? "Actualizando..." : "En vivo" },
      { label: "Confirmadas", value: String(confirmed), trend: "Pacientes listos" },
      { label: "Completadas", value: String(completed), trend: "Atención finalizada" },
      { label: "Ingresos del día", value: `$${revenue.toLocaleString()}`, trend: "Facturación bruta" }
    ];
  }, [loading, rows]);

  return (
    <section className="page-section">
      <div className="stats-grid">
        {kpis.map((card) => (
          <article key={card.label} className="stat-card elite-card">
            <small>{card.label}</small>
            <h3>{card.value}</h3>
            <span>{card.trend}</span>
          </article>
        ))}
      </div>

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
                <th>Honorarios</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.id.split("-")[0]}...</td>
                  <td><strong>{row.patientId}</strong></td>
                  <td>{new Date(row.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>
                    <span className={`badge status-${row.status}`}>{row.status}</span>
                  </td>
                  <td>${Number(row.paymentAmount || 0).toFixed(2)}</td>
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

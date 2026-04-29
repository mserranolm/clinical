import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AuthSession } from "../types";
import { clinicalApi } from "../api/clinical";
import { notify } from "../lib/notify";
import {
  canManageTreatments,
  canWriteAppointments,
  isOrgAdmin,
} from "../lib/rbac";
import { localDateTimeToISO, isoToLocalDateTime } from "../lib/datetime";
import {
  AUTO_REFRESH_OPTS,
  DURATION_BLOCKS,
  TIME_SLOTS,
  fmtTimeSlot,
} from "../lib/constants";
import { Modal } from "../components/Modal";
import { DatePicker } from "../components/ui/DatePicker";
import {
  CheckCircle,
  Clock,
  CalendarCheck,
  List,
  Pencil,
  Stethoscope,
  Send,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

type AppointmentRow = {
  id: string;
  patientId: string;
  patientName?: string;
  startAt: string;
  status: string;
  paymentAmount?: number;
  consentSummary?: { total: number; accepted: number };
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  trend,
  bg,
  iconColor,
  Icon,
  onClick,
  highlight,
  active,
}: {
  label: string;
  value: string | number;
  trend?: string;
  bg: string;
  iconColor: string;
  Icon: React.ElementType;
  onClick?: () => void;
  highlight?: string;
  active?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "white",
        borderRadius: 14,
        padding: "20px 22px",
        cursor: onClick ? "pointer" : "default",
        borderTop: highlight ? `3px solid ${highlight}` : "1px solid #F1F5F9",
        border: active
          ? `2px solid ${highlight ?? "#0D9488"}`
          : highlight
            ? undefined
            : "1px solid #F1F5F9",
        boxShadow: active
          ? `0 0 0 3px ${highlight ? highlight + "22" : "#0D948822"}`
          : "0 1px 4px rgba(148,163,184,0.08)",
        transition: "box-shadow 0.15s ease, border 0.15s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Icon bubble */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
        }}
      >
        <Icon size={18} color={iconColor} strokeWidth={1.8} />
      </div>

      {/* Value */}
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: "#0F172A",
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>

      {/* Label */}
      <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
        {label}
      </div>

      {/* Trend badge */}
      {trend && (
        <span
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            fontSize: 11,
            color: "#10B981",
            background: "#F0FDF4",
            borderRadius: 100,
            padding: "3px 8px",
            fontWeight: 600,
          }}
        >
          {trend}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function DashboardHome({
  user,
  rows,
  loading,
  error,
  date,
  onDateChange,
  onRefresh,
  autoRefreshSeconds = 0,
  onAutoRefreshChange,
}: {
  user: AuthSession;
  rows: AppointmentRow[];
  loading: boolean;
  error: string;
  date: string;
  onDateChange: (date: string) => void;
  onRefresh?: () => void;
  autoRefreshSeconds?: number;
  onAutoRefreshChange?: (seconds: number) => void;
}) {
  const navigate = useNavigate();
  const [editRow, setEditRow] = useState<AppointmentRow | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editDuration, setEditDuration] = useState(30);
  const [saving, setSaving] = useState(false);
  const [orgStats, setOrgStats] = useState<{
    totalRevenue: number;
    pendingRevenue: number;
    totalConsultations: number;
  } | null>(null);
  const [activeView, setActiveView] = useState<"list" | "timeline">("list");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOrgAdmin(user)) {
      clinicalApi
        .getOrgStats(user.token)
        .then((s) =>
          setOrgStats({
            totalRevenue: s.totalRevenue,
            pendingRevenue: s.pendingRevenue,
            totalConsultations: s.totalConsultations,
          }),
        )
        .catch(() => {});
    }
  }, [user.token, user.role]);

  function openEdit(row: AppointmentRow) {
    const { date, time } = isoToLocalDateTime(row.startAt);
    setEditRow(row);
    setEditDate(date);
    setEditTime(time);
    setEditDuration(30);
  }

  async function saveEdit() {
    if (!editRow || !editDate || !editTime) return;
    setSaving(true);
    try {
      const startAt = localDateTimeToISO(editDate, editTime);
      const endAt = new Date(
        new Date(startAt).getTime() + editDuration * 60000,
      ).toISOString();
      await clinicalApi.updateAppointment(
        editRow.id,
        { startAt, endAt },
        user.token,
      );
      notify.success("Cita actualizada");
      setEditRow(null);
      onRefresh?.();
    } catch (err) {
      notify.error(
        "Error al actualizar",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setSaving(false);
    }
  }

  const isConfirmed = (status: string) => status === "confirmed";
  const isCompleted = (status: string) => status === "completed";
  const isInProgress = (status: string) => status === "in_progress";

  const confirmedRows = useMemo(
    () => rows.filter((r) => isConfirmed(r.status)),
    [rows],
  );
  const unconfirmedRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          !isConfirmed(r.status) &&
          !isCompleted(r.status) &&
          r.status !== "cancelled" &&
          !isInProgress(r.status),
      ),
    [rows],
  );
  // Filas filtradas según KPI seleccionado
  const filteredRows = useMemo(() => {
    if (!selectedStatus) return rows;
    if (selectedStatus === "unconfirmed") {
      return rows.filter(
        (r) =>
          !["confirmed", "completed", "cancelled"].includes(r.status) &&
          !isInProgress(r.status),
      );
    }
    return rows.filter((r) => r.status === selectedStatus);
  }, [rows, selectedStatus]);

  // Ingresos cobrados: orgStats si existe, si no calcular de rows
  const totalRevenue = useMemo(() => {
    if (orgStats?.totalRevenue != null) return orgStats.totalRevenue;
    return rows
      .filter((r) => (r.paymentAmount ?? 0) > 0)
      .reduce((s, r) => s + (r.paymentAmount ?? 0), 0);
  }, [orgStats, rows]);

  const canSeeRevenue = isOrgAdmin(user) || user.role === "doctor";
  const canSeePending = isOrgAdmin(user);

  const statusClass = (status: string) => {
    if (status === "confirmed") return "status-confirmed";
    if (status === "in_progress") return "status-in-progress";
    if (status === "completed") return "status-completed";
    if (status === "cancelled") return "status-cancelled";
    return "status-unconfirmed";
  };

  const statusLabel = (status: string) => {
    if (status === "confirmed") return "Confirmada";
    if (status === "in_progress") return "En consulta";
    if (status === "completed") return "Finalizada";
    if (status === "cancelled") return "Cancelada";
    return "No confirmada";
  };

  const patientLabel = (row: AppointmentRow) =>
    row.patientName || row.patientId;

  const rowTime = (row: AppointmentRow) =>
    new Date(row.startAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const goToTreatment = async (row: AppointmentRow) => {
    if (!isInProgress(row.status)) {
      try {
        await clinicalApi.updateAppointment(
          row.id,
          { status: "in_progress" },
          user.token,
        );
      } catch (_) {
        /* no bloquear si falla */
      }
    }
    navigate(
      `/dashboard/consulta?appointmentId=${encodeURIComponent(row.id)}&patientId=${encodeURIComponent(row.patientId)}`,
    );
  };

  const onConfirm = (id: string) => {
    const promise = clinicalApi.confirmAppointment(id, user.token);
    notify.promise(promise, {
      loading: "Confirmando cita...",
      success: () => {
        onRefresh?.();
        return "Cita confirmada";
      },
      error: "Error al confirmar",
    });
  };

  const onResend = (id: string) => {
    const promise = clinicalApi.resendAppointmentConfirmation(id, user.token);
    notify.promise(promise, {
      loading: "Reenviando confirmación...",
      success: () => "Confirmación reenviada",
      error: "Error al reenviar",
    });
  };

  const consentBadge = (row: AppointmentRow) => {
    if (!row.consentSummary || row.consentSummary.total === 0) return null;
    const done = row.consentSummary.accepted >= row.consentSummary.total;
    return (
      <span
        className={`badge ${done ? "status-confirmed" : "badge-neutral"}`}
        style={{ fontSize: "0.65rem", marginLeft: 4 }}
        title={
          done
            ? "Consentimientos completos"
            : `${row.consentSummary.accepted}/${row.consentSummary.total} pendientes`
        }
      >
        {done ? "✓ Cons." : "Cons. pend."}
      </span>
    );
  };

  const avatarInitials = (name: string) =>
    name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0] ?? "")
      .join("")
      .toUpperCase() || "?";

  // Toggle de filtro por estado
  function toggleStatus(status: string) {
    setSelectedStatus((prev) => (prev === status ? null : status));
  }

  return (
    <section className="page-section">
      {/* ── Modal de edición ── */}
      {editRow && (
        <Modal onClose={() => setEditRow(null)}>
          <h3 style={{ marginBottom: 16 }}>Editar Cita</h3>
          <div className="input-group">
            <label>Fecha</label>
            <DatePicker value={editDate} onChange={setEditDate} />
          </div>
          <div className="input-group">
            <label>Hora de inicio</label>
            <select
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
            >
              <option value="">Seleccione una hora</option>
              {TIME_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {fmtTimeSlot(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label>Bloque de tiempo</label>
            <select
              value={editDuration}
              onChange={(e) => setEditDuration(Number(e.target.value))}
            >
              {DURATION_BLOCKS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              className="action-btn action-btn-confirm"
              onClick={saveEdit}
              disabled={saving}
            >
              Guardar
            </button>
            <button className="action-btn" onClick={() => setEditRow(null)}>
              Cancelar
            </button>
          </div>
        </Modal>
      )}

      {/* ── KPI Grid 4 columnas ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <KpiCard
          label="Citas del día"
          value={rows.length}
          trend="En vivo"
          bg="#DBEAFE"
          iconColor="#1D4ED8"
          Icon={CalendarCheck}
          highlight="#3B82F6"
          active={selectedStatus === null}
          onClick={() => setSelectedStatus(null)}
        />
        <KpiCard
          label="Confirmados"
          value={confirmedRows.length}
          trend={`+${confirmedRows.length}`}
          bg="#DCFCE7"
          iconColor="#15803D"
          Icon={CheckCircle}
          highlight="#22C55E"
          active={selectedStatus === "confirmed"}
          onClick={() => toggleStatus("confirmed")}
        />
        <KpiCard
          label="Sin confirmar"
          value={unconfirmedRows.length}
          bg="#FEF3C7"
          iconColor="#B45309"
          Icon={Clock}
          highlight="#F59E0B"
          active={selectedStatus === "unconfirmed"}
          onClick={() => toggleStatus("unconfirmed")}
        />
        {canSeeRevenue && (
          <KpiCard
            label="Ingresos cobrados"
            value={`$${totalRevenue.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            bg="#F0FDFA"
            iconColor="#0D9488"
            Icon={TrendingUp}
            highlight="#0D9488"
          />
        )}
        {/* Si no puede ver revenue, ocupar el slot con un placeholder vacío para mantener el grid */}
        {!canSeeRevenue && <div />}
      </div>

      {/* ── KPIs plataforma/org admin ── */}
      {canSeePending && orgStats && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #F1F5F9",
            borderRadius: 12,
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginBottom: 20,
            boxShadow: "0 1px 4px rgba(148,163,184,0.08)",
            cursor: "pointer",
          }}
          onClick={() => navigate("/dashboard/pagos")}
        >
          <div>
            <div
              style={{
                fontSize: "0.63rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "#94A3B8",
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              PENDIENTES POR COBRAR
            </div>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 800,
                color: "#F59E0B",
                lineHeight: 1,
              }}
            >
              $
              {orgStats.pendingRevenue.toLocaleString("es-ES", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
          </div>
          <div
            style={{
              fontSize: "0.78rem",
              color: "#94A3B8",
              marginLeft: "auto",
            }}
          >
            Ver pagos →
          </div>
        </div>
      )}

      {/* ── Agenda card (columna única) ── */}
      <article className="agenda-card" style={{ margin: 0 }}>
        {/* Header */}
        <div className="agenda-header">
          <div className="agenda-header-left">
            <div className="agenda-header-icon">
              <CalendarCheck size={18} strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="agenda-title">Citas de la jornada</h3>
              <p className="agenda-subtitle">
                {selectedStatus ? "Filtrado · " : ""}
                {filteredRows.length} cita
                {filteredRows.length !== 1 ? "s" : ""}{" "}
                {selectedStatus ? "en este estado" : "programadas"}
              </p>
            </div>
          </div>
          <div
            className="agenda-header-right"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            {/* Botón "Ver todas" cuando hay filtro activo */}
            {selectedStatus && (
              <button
                type="button"
                onClick={() => setSelectedStatus(null)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #CCFBF1",
                  background: "#F0FDFA",
                  color: "#0D9488",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Ver todas ×
              </button>
            )}

            {/* Toggle Vista */}
            <div className="agenda-view-switch">
              <button
                type="button"
                className={`agenda-view-btn${activeView === "list" ? " is-active" : ""}`}
                onClick={() => setActiveView("list")}
                title="Vista lista"
              >
                <List size={12} strokeWidth={2} />
                Lista
              </button>
              <button
                type="button"
                className={`agenda-view-btn${activeView === "timeline" ? " is-active" : ""}`}
                onClick={() => setActiveView("timeline")}
                title="Vista timeline"
              >
                <Clock size={12} strokeWidth={2} />
                Timeline
              </button>
            </div>

            <button
              type="button"
              className="agenda-btn"
              onClick={onRefresh}
              title="Actualizar citas"
              disabled={loading}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw size={13} strokeWidth={1.5} />
              <span>Actualizar</span>
            </button>

            {onAutoRefreshChange && (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.875rem",
                  color: "#64748b",
                }}
              >
                <span>Auto:</span>
                <select
                  value={autoRefreshSeconds}
                  onChange={(e) => onAutoRefreshChange(Number(e.target.value))}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: "0.8rem",
                    minWidth: 100,
                  }}
                >
                  {AUTO_REFRESH_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <DatePicker value={date} onChange={onDateChange} />
          </div>
        </div>

        {error ? (
          <div className="auth-error" style={{ margin: "0 0 16px" }}>
            {error}
          </div>
        ) : null}

        {/* Tabla */}
        <div className="agenda-table-wrap">
          {filteredRows.length === 0 && !loading ? (
            <div className="agenda-empty">
              <div className="agenda-empty-icon">
                <CalendarCheck size={32} strokeWidth={1} />
              </div>
              <strong>
                {selectedStatus
                  ? "Sin citas con este estado"
                  : "Sin citas para esta fecha"}
              </strong>
              <p>
                {selectedStatus
                  ? "Prueba con otro filtro o ve todas las citas."
                  : "Selecciona otro día o crea una nueva cita."}
              </p>
            </div>
          ) : (
            <table className="agenda-table">
              <thead>
                <tr>
                  <th>HORA</th>
                  <th>PACIENTE</th>
                  <th>ESTADO</th>
                  <th>$</th>
                  <th style={{ textAlign: "right" }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="agenda-row">
                    {/* HORA */}
                    <td style={{ width: 90 }}>
                      <div className="agenda-time">
                        <Clock size={12} strokeWidth={1.5} />
                        {rowTime(row)}
                      </div>
                    </td>

                    {/* PACIENTE */}
                    <td>
                      <div className="agenda-patient">
                        <div
                          className="agenda-patient-avatar"
                          style={{
                            background:
                              "linear-gradient(135deg,#CCFBF1,#99F6E4)",
                            color: "#0D9488",
                          }}
                        >
                          {avatarInitials(patientLabel(row))}
                        </div>
                        <div>
                          <strong className="agenda-patient-name">
                            {patientLabel(row)}
                          </strong>
                          <span className="agenda-patient-ref">
                            #{row.id.split("-")[0]}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* ESTADO */}
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          flexWrap: "wrap",
                        }}
                      >
                        <span className={`badge ${statusClass(row.status)}`}>
                          {statusLabel(row.status)}
                        </span>
                        {consentBadge(row)}
                      </div>
                    </td>

                    {/* $ */}
                    <td>
                      {row.paymentAmount != null && row.paymentAmount > 0 ? (
                        <span
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            color: "#10B981",
                          }}
                        >
                          $
                          {row.paymentAmount.toLocaleString("es-ES", {
                            minimumFractionDigits: 0,
                          })}
                        </span>
                      ) : (
                        <span style={{ color: "#CBD5E1", fontSize: "0.82rem" }}>
                          —
                        </span>
                      )}
                    </td>

                    {/* ACCIONES */}
                    <td>
                      <div
                        className="agenda-actions"
                        style={{ justifyContent: "flex-end" }}
                      >
                        {/* Editar — solo icono */}
                        {canWriteAppointments(user) &&
                          !isCompleted(row.status) &&
                          row.status !== "cancelled" && (
                            <button
                              type="button"
                              className="agenda-btn"
                              onClick={() => openEdit(row)}
                              title="Editar cita"
                              style={{
                                width: 32,
                                height: 32,
                                padding: 0,
                                justifyContent: "center",
                              }}
                            >
                              <Pencil size={13} strokeWidth={1.5} />
                            </button>
                          )}

                        {/* Reenviar — solo icono */}
                        {!isCompleted(row.status) &&
                          row.status !== "cancelled" && (
                            <button
                              type="button"
                              className="agenda-btn"
                              onClick={() => onResend(row.id)}
                              title="Reenviar confirmación"
                              style={{
                                width: 32,
                                height: 32,
                                padding: 0,
                                justifyContent: "center",
                              }}
                            >
                              <Send size={13} strokeWidth={1.5} />
                            </button>
                          )}

                        {/* Confirmar */}
                        {canWriteAppointments(user) &&
                          !isConfirmed(row.status) &&
                          !isCompleted(row.status) &&
                          row.status !== "cancelled" &&
                          !isInProgress(row.status) && (
                            <button
                              type="button"
                              className="agenda-btn agenda-btn-confirm"
                              onClick={() => onConfirm(row.id)}
                              title="Confirmar cita"
                            >
                              <CheckCircle size={13} strokeWidth={1.5} />
                              <span>Confirmar</span>
                            </button>
                          )}

                        {/* Atender — prominente */}
                        {canManageTreatments(user) &&
                          !isCompleted(row.status) &&
                          row.status !== "cancelled" && (
                            <button
                              type="button"
                              onClick={() =>
                                isConfirmed(row.status) ||
                                isInProgress(row.status)
                                  ? goToTreatment(row)
                                  : notify.error(
                                      "Cita no confirmada",
                                      "Confirma la cita antes de atender al paciente.",
                                    )
                              }
                              title={
                                isConfirmed(row.status) ||
                                isInProgress(row.status)
                                  ? "Atender paciente"
                                  : "Confirma primero"
                              }
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "7px 14px",
                                borderRadius: 8,
                                border: "none",
                                background:
                                  isConfirmed(row.status) ||
                                  isInProgress(row.status)
                                    ? "#0F172A"
                                    : "#94A3B8",
                                color: "#ffffff",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                                cursor:
                                  isConfirmed(row.status) ||
                                  isInProgress(row.status)
                                    ? "pointer"
                                    : "not-allowed",
                                opacity:
                                  isConfirmed(row.status) ||
                                  isInProgress(row.status)
                                    ? 1
                                    : 0.55,
                                transition: "all 0.15s ease",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <Stethoscope size={13} strokeWidth={1.5} />
                              Atender
                            </button>
                          )}

                        {/* Finalizada badge */}
                        {isCompleted(row.status) && (
                          <span className="agenda-done-badge">
                            <CheckCircle size={12} strokeWidth={1.5} />{" "}
                            Finalizada
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </article>
    </section>
  );
}

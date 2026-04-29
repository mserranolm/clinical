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
  const inProgressRows = useMemo(
    () => rows.filter((r) => isInProgress(r.status)),
    [rows],
  );

  const total = rows.length;
  const confirmed = confirmedRows.length;
  const unconfirmed = unconfirmedRows.length;
  const inProgress = inProgressRows.length;

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

  // Panel derecho: items de atención pendiente
  const attentionItems = useMemo(() => {
    const items: Array<{
      key: string;
      tipo: "CITA" | "EN CONSULTA";
      texto: string;
      subtexto: string;
    }> = [];
    for (const row of unconfirmedRows) {
      items.push({
        key: row.id,
        tipo: "CITA",
        texto: `${patientLabel(row)} · ${rowTime(row)}`,
        subtexto: "Sin confirmar",
      });
    }
    for (const row of inProgressRows) {
      items.push({
        key: row.id,
        tipo: "EN CONSULTA",
        texto: patientLabel(row),
        subtexto: "En curso",
      });
    }
    return items;
  }, [unconfirmedRows, inProgressRows]);

  // Últimos 3 pacientes para "Vistos recientemente"
  const recentPatients = useMemo(() => rows.slice(0, 3), [rows]);

  const avatarInitials = (name: string) =>
    name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0] ?? "")
      .join("")
      .toUpperCase() || "?";

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

      {/* ── Stats bar ── */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #F1F5F9",
          borderRadius: 12,
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 0,
          overflowX: "auto",
          marginBottom: 20,
          boxShadow: "0 1px 4px rgba(148,163,184,0.08)",
        }}
      >
        {/* HOY */}
        <div style={{ padding: "0 20px 0 0", flexShrink: 0 }}>
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
            HOY
          </div>
          <div
            style={{
              fontSize: "1.4rem",
              fontWeight: 800,
              color: "#0F172A",
              lineHeight: 1,
            }}
          >
            {total}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#94A3B8", marginTop: 1 }}>
            citas
          </div>
        </div>

        <div
          style={{ width: 1, height: 36, background: "#F1F5F9", flexShrink: 0 }}
        />

        {/* CONFIRMADOS */}
        <div style={{ padding: "0 20px", flexShrink: 0 }}>
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
            CONFIRMADOS
          </div>
          <div
            style={{
              fontSize: "1.4rem",
              fontWeight: 800,
              color: "#0F172A",
              lineHeight: 1,
            }}
          >
            {confirmed}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#94A3B8", marginTop: 1 }}>
            pac.
          </div>
        </div>

        <div
          style={{ width: 1, height: 36, background: "#F1F5F9", flexShrink: 0 }}
        />

        {/* SIN CONFIRMAR */}
        <div style={{ padding: "0 20px", flexShrink: 0 }}>
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
            SIN CONFIRMAR
          </div>
          <div
            style={{
              fontSize: "1.4rem",
              fontWeight: 800,
              color: "#0F172A",
              lineHeight: 1,
            }}
          >
            {unconfirmed}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#94A3B8", marginTop: 1 }}>
            pend.
          </div>
        </div>

        <div
          style={{ width: 1, height: 36, background: "#F1F5F9", flexShrink: 0 }}
        />

        {/* EN CONSULTA */}
        <div style={{ padding: "0 20px", flexShrink: 0 }}>
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
            EN CONSULTA
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                fontSize: "1.4rem",
                fontWeight: 800,
                color: "#10B981",
                lineHeight: 1,
              }}
            >
              {inProgress}
            </div>
            {inProgress > 0 && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#10B981",
                  boxShadow: "0 0 0 3px rgba(16,185,129,0.25)",
                  animation: "pulse 2s infinite",
                  flexShrink: 0,
                }}
              />
            )}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#94A3B8", marginTop: 1 }}>
            ahora
          </div>
        </div>

        {canSeeRevenue && orgStats && (
          <>
            <div
              style={{
                width: 1,
                height: 36,
                background: "#F1F5F9",
                flexShrink: 0,
              }}
            />
            <div style={{ padding: "0 20px", flexShrink: 0 }}>
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
                COBRADO HOY
              </div>
              <div
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 800,
                  color: "#10B981",
                  lineHeight: 1,
                }}
              >
                $
                {orgStats.totalRevenue.toLocaleString("es-ES", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </div>
              <div
                style={{ fontSize: "0.7rem", color: "#94A3B8", marginTop: 1 }}
              >
                USD
              </div>
            </div>
          </>
        )}

        {canSeePending && orgStats && (
          <>
            <div
              style={{
                width: 1,
                height: 36,
                background: "#F1F5F9",
                flexShrink: 0,
              }}
            />
            <div
              style={{ padding: "0 20px", flexShrink: 0, cursor: "pointer" }}
              onClick={() => navigate("/dashboard/pagos")}
            >
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
                PENDIENTES
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
              <div
                style={{ fontSize: "0.7rem", color: "#94A3B8", marginTop: 1 }}
              >
                por cobrar
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Layout de 2 columnas ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* ── Columna izquierda: Agenda ── */}
        <article className="agenda-card" style={{ margin: 0 }}>
          {/* Header */}
          <div className="agenda-header">
            <div className="agenda-header-left">
              <div className="agenda-header-icon">
                <CalendarCheck size={18} strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="agenda-title">Agenda · Hoy</h3>
                <p className="agenda-subtitle">
                  {rows.length > 0
                    ? `${rows.length} cita${rows.length !== 1 ? "s" : ""} · vista compacta`
                    : "Sin citas para esta fecha"}
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
                    onChange={(e) =>
                      onAutoRefreshChange(Number(e.target.value))
                    }
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
            {rows.length === 0 && !loading ? (
              <div className="agenda-empty">
                <div className="agenda-empty-icon">
                  <CalendarCheck size={32} strokeWidth={1} />
                </div>
                <strong>Sin citas para esta fecha</strong>
                <p>Selecciona otro día o crea una nueva cita.</p>
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
                  {rows.map((row) => (
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
                          <span
                            style={{ color: "#CBD5E1", fontSize: "0.82rem" }}
                          >
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

        {/* ── Columna derecha: Panel atención + Recientes ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Panel "Requiere atención" */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #F1F5F9",
              borderRadius: 12,
              boxShadow: "0 1px 4px rgba(148,163,184,0.08)",
              overflow: "hidden",
            }}
          >
            {/* Header panel */}
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid #F8FAFC",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#1E293B",
                }}
              >
                Requiere atención
              </span>
              {attentionItems.length > 0 && (
                <span
                  style={{
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    background: "#EF4444",
                    color: "#fff",
                    fontSize: "0.68rem",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 6px",
                  }}
                >
                  {attentionItems.length}
                </span>
              )}
            </div>

            {/* Lista de items */}
            {attentionItems.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center" }}>
                <div style={{ fontSize: "0.78rem", color: "#94A3B8" }}>
                  Sin items pendientes
                </div>
              </div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {attentionItems.map((item) => (
                  <li
                    key={item.key}
                    style={{
                      padding: "10px 16px",
                      borderBottom: "1px solid #F8FAFC",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    {/* Badge tipo */}
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "2px 7px",
                        borderRadius: 6,
                        fontSize: "0.6rem",
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        flexShrink: 0,
                        marginTop: 2,
                        ...(item.tipo === "EN CONSULTA"
                          ? { background: "#D1FAE5", color: "#059669" }
                          : { background: "#F1F5F9", color: "#475569" }),
                      }}
                    >
                      {item.tipo}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          color: "#1E293B",
                          lineHeight: 1.3,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.texto}
                      </div>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          color: "#94A3B8",
                          marginTop: 2,
                        }}
                      >
                        {item.subtexto}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Panel "Vistos recientemente" */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #F1F5F9",
              borderRadius: 12,
              boxShadow: "0 1px 4px rgba(148,163,184,0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid #F8FAFC",
              }}
            >
              <span
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#1E293B",
                }}
              >
                Vistos recientemente
              </span>
            </div>
            {recentPatients.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center" }}>
                <div style={{ fontSize: "0.78rem", color: "#94A3B8" }}>
                  Sin pacientes hoy
                </div>
              </div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {recentPatients.map((row, idx) => (
                  <li
                    key={row.id}
                    style={{
                      padding: "10px 16px",
                      borderBottom:
                        idx < recentPatients.length - 1
                          ? "1px solid #F8FAFC"
                          : "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: "linear-gradient(135deg,#CCFBF1,#99F6E4)",
                        color: "#0D9488",
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {avatarInitials(patientLabel(row))}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          color: "#1E293B",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {patientLabel(row)}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "#94A3B8" }}>
                        {idx === 0 ? "ahora" : "antes"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

import { CalendarDays, List, RefreshCw, Stethoscope } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { clinicalApi } from "../api/clinical";
import { Modal } from "../components/Modal";
import { DatePicker } from "../components/ui/DatePicker";
import { isoToLocalDateTime, localDateTimeToISO } from "../lib/datetime";
import { notify } from "../lib/notify";
import { canDeleteAppointments, canManageTreatments, canWriteAppointments } from "../lib/rbac";
import { DoctorSearch } from "../modules/appointments/components/DoctorSearch";
import { PatientSearch } from "../modules/appointments/components/PatientSearch";
import type { AuthSession } from "../types";

type AppointmentRow = {
  id: string;
  patientId: string;
  patientName?: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  status: string;
  paymentAmount?: number;
  paymentPaid?: boolean;
  paymentMethod?: string;
  consentSummary?: { total: number; accepted: number };
};

type ViewMode = "day" | "week" | "month";
type DisplayMode = "list" | "calendar";

const AUTO_REFRESH_OPTS = [
  { value: 0, label: "Desactivada" },
  { value: 10, label: "Cada 10 s" },
  { value: 15, label: "Cada 15 s" },
  { value: 30, label: "Cada 30 s" },
  { value: 60, label: "Cada 60 s" },
] as const;

const VIEW_MODE_OPTS: Array<{ value: ViewMode; label: string }> = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
];

const DISPLAY_MODE_OPTS: Array<{ value: DisplayMode; label: string }> = [
  { value: "calendar", label: "Calendario" },
  { value: "list", label: "Lista" },
];

const DURATION_BLOCKS = [
  { label: "30 minutos", value: 30 },
  { label: "1 hora", value: 60 },
  { label: "1 hora 30 min", value: 90 },
  { label: "2 horas", value: 120 },
  { label: "2 horas 30 min", value: 150 },
  { label: "3 horas", value: 180 },
];

const TIME_SLOTS = [
  "07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30",
  "11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30","17:00","17:30","18:00",
];

function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function getDateRangeByView(anchorDate: string, viewMode: ViewMode): string[] {
  const anchor = parseLocalDate(anchorDate);
  const dates: string[] = [];

  if (viewMode === "day") return [toLocalDateString(anchor)];

  if (viewMode === "week") {
    const dayOfWeek = anchor.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = addDays(anchor, diffToMonday);
    for (let i = 0; i < 7; i += 1) {
      dates.push(toLocalDateString(addDays(weekStart, i)));
    }
    return dates;
  }

  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  for (let d = new Date(monthStart); d <= monthEnd; d = addDays(d, 1)) {
    dates.push(toLocalDateString(d));
  }
  return dates;
}

function formatTimeRange(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatSlotLabel(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function AppointmentsPage({ token, doctorId, session }: { token: string; doctorId: string; session: AuthSession }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [createDate, setCreateDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("list");
  const [hideCompletedCancelled, setHideCompletedCancelled] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; firstName: string; lastName: string; } | null>(null);
  const [duration, setDuration] = useState<number>(30);
  const [editRow, setEditRow] = useState<AppointmentRow | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editDuration, setEditDuration] = useState(30);
  const [saving, setSaving] = useState(false);
  const [payRow, setPayRow] = useState<AppointmentRow | null>(null);
  const [payPaid, setPayPaid] = useState(true);
  const [payMethod, setPayMethod] = useState("efectivo");
  const [payAmount, setPayAmount] = useState(0);
  const [payingSaving, setPayingSaving] = useState(false);
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPastDateTime = (dateStr: string, timeStr: string) => {
    const dt = new Date(localDateTimeToISO(dateStr, timeStr));
    return dt.getTime() < Date.now();
  };

  function openEdit(row: AppointmentRow) {
    const { date, time } = isoToLocalDateTime(row.startAt);
    setEditRow(row);
    setEditDate(date);
    setEditTime(time);
    setEditDuration(row.durationMinutes || 30);
  }

  function formatAgendaDate(startAt: string): string {
    const dateValue = new Date(startAt);
    return dateValue.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  }

  function formatCalendarDayLabel(localDate: string): string {
    return parseLocalDate(localDate).toLocaleDateString("es-ES", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  }

  const todayLocal = toLocalDateString(new Date());
  const isCreateDateToday = createDate === todayLocal;
  const hasCreateTimeSlots = TIME_SLOTS.some((slot) => !isCreateDateToday || !isPastDateTime(createDate, slot));

  async function saveEdit() {
    if (!editRow || !editDate || !editTime) return;
    setSaving(true);
    try {
      const startAt = localDateTimeToISO(editDate, editTime);
      const endAt = new Date(new Date(startAt).getTime() + editDuration * 60000).toISOString();
      await clinicalApi.updateAppointment(editRow.id, { startAt, endAt }, token);
      notify.success("Cita actualizada");
      setEditRow(null);
      loadAppointments(date, effectiveDoctorId);
    } catch (err) {
      notify.error("Error al actualizar", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const isDoctor = session.role === "doctor";
  const isAdmin = session.role === "admin";
  const canSelectDoctor = isAdmin || session.role === "assistant";
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");

  useEffect(() => {
    if (canSelectDoctor && session.orgId) {
      clinicalApi.listOrgUsers(session.orgId, token).then((res) => {
        const docs = (res.items ?? []).filter((u) => u.role === "doctor" && u.status === "active");
        const list: { id: string; name: string }[] = docs.map((u) => ({ id: u.id, name: u.name }));
        if (isAdmin && session.userId && !list.find((d) => d.id === session.userId)) {
          list.unshift({ id: session.userId, name: `${session.name || "Administrador"} (yo)` });
        }
        // Admin puede ver toda la agenda de la organización
        if (isAdmin) list.unshift({ id: "", name: "Toda la agenda" });
        setDoctors(list);
        if (list.length > 0) setSelectedDoctorId(list[0].id);
      }).catch(() => {});
    }
  }, [canSelectDoctor, session.orgId, isAdmin, session.userId, session.name, token]);

  const effectiveDoctorId = isDoctor ? doctorId : selectedDoctorId;

  useEffect(() => {
    loadAppointments(date, effectiveDoctorId, viewMode);
  }, [location.key, effectiveDoctorId, date, viewMode]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (autoRefreshSeconds > 0) {
      intervalRef.current = setInterval(() => loadAppointments(date, effectiveDoctorId, viewMode), autoRefreshSeconds * 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefreshSeconds, date, effectiveDoctorId, viewMode]);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;

    if (canSelectDoctor && !selectedDoctorId) {
      notify.error("Selecciona un doctor", "Debes asignar un doctor a la cita.");
      return;
    }
    if (!selectedPatient?.id) {
      notify.error("Selecciona un paciente", "Debes elegir un paciente antes de confirmar el espacio.");
      return;
    }
    const selectedDate = String(fd.get("date") || createDate);
    const selectedTime = String(fd.get("time") || "");
    if (!selectedDate || !selectedTime) {
      notify.error("Fecha y hora requeridas", "Selecciona fecha y hora de inicio para agendar.");
      return;
    }
    if (isPastDateTime(selectedDate, selectedTime)) {
      notify.error("Hora no válida", "La cita debe ser a futuro. Si es hoy, selecciona una hora igual o posterior a la actual.");
      return;
    }

    const startAt = localDateTimeToISO(selectedDate, selectedTime);
    const promise = clinicalApi.createAppointment(
      {
        doctorId: effectiveDoctorId,
        patientId: selectedPatient?.id || '',
        startAt,
        durationMinutes: duration,
        treatmentPlan: String(fd.get("treatmentPlan") || ""),
        paymentAmount: Number(fd.get("paymentAmount") || 0),
        paymentMethod: String(fd.get("paymentMethod") || "")
      },
      token
    );

    notify.promise(promise, {
      loading: "Agendando cita...",
      success: () => { form.reset(); loadAppointments(date, effectiveDoctorId); return "Cita agendada"; },
      successDesc: "La consulta fue registrada en la agenda.",
      error: "Error al agendar",
      errorDesc: (err) => err instanceof Error ? err.message : "Verifica los datos e intenta de nuevo.",
    });
  }

  const isConfirmed = (status: string) => status === "confirmed";
  const isCompleted = (status: string) => status === "completed";

  const statusLabel: Record<string, string> = {
    scheduled: "pendiente",
    confirmed: "confirmada",
    in_progress: "En consulta",
    completed: "finalizada",
    cancelled: "cancelada",
  };
  const statusClass: Record<string, string> = {
    scheduled: "status-unconfirmed",
    confirmed: "status-confirmed",
    in_progress: "status-in-progress",
    completed: "status-completed",
    cancelled: "status-cancelled",
  };

  const visibleRows = hideCompletedCancelled
    ? rows.filter((row) => row.status !== "completed" && row.status !== "cancelled")
    : rows;

  const visibleDates = getDateRangeByView(date, viewMode);
  const rowsByDate: Record<string, AppointmentRow[]> = visibleDates.reduce((acc, localDate) => {
    acc[localDate] = [];
    return acc;
  }, {} as Record<string, AppointmentRow[]>);

  visibleRows.forEach((row) => {
    const localDate = toLocalDateString(new Date(row.startAt));
    if (!rowsByDate[localDate]) rowsByDate[localDate] = [];
    rowsByDate[localDate].push(row);
  });

  const goToTreatment = async (row: AppointmentRow) => {
    if (row.status !== "in_progress") {
      try {
        await clinicalApi.updateAppointment(row.id, { status: "in_progress" }, token);
      } catch (_) { /* no bloquear si falla */ }
    }
    navigate(`/dashboard/consulta?appointmentId=${encodeURIComponent(row.id)}&patientId=${encodeURIComponent(row.patientId)}`);
  };

  function renderRowActions(row: AppointmentRow) {
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canWriteAppointments(session) && !isCompleted(row.status) && row.status !== "cancelled" && (
          <button type="button" className="action-btn" onClick={() => openEdit(row)}>
            <span className="icon">✏️</span>
            <span>Editar</span>
          </button>
        )}
        {canWriteAppointments(session) && !isConfirmed(row.status) && !isCompleted(row.status) && row.status !== "cancelled" && (
          <button type="button" className="action-btn action-btn-confirm" onClick={() => onConfirm(row.id)}>
            <span className="icon">✓</span>
            <span>Confirmar</span>
          </button>
        )}
        {canWriteAppointments(session) && !isCompleted(row.status) && row.status !== "cancelled" && (
          <button type="button" className="action-btn" onClick={() => onCancel(row.id)}>
            <span className="icon">✕</span>
            <span>Cancelar</span>
          </button>
        )}
        {canWriteAppointments(session) && !isCompleted(row.status) && row.status !== "in_progress" && row.status !== "cancelled" && !(row.consentSummary && row.consentSummary.total > 0 && row.consentSummary.accepted >= row.consentSummary.total) && (
          <button type="button" className="action-btn" onClick={() => onResend(row.id)}>
            <span className="icon">✉️</span>
            <span>Reenviar</span>
          </button>
        )}
        {canWriteAppointments(session) && isCompleted(row.status) && (
          <button
            type="button"
            className="agenda-btn"
            style={{ background: row.paymentPaid ? "#d1fae5" : "#fef3c7", color: row.paymentPaid ? "#065f46" : "#92400e", borderColor: row.paymentPaid ? "#6ee7b7" : "#fcd34d", opacity: row.paymentPaid ? 0.7 : 1, cursor: row.paymentPaid ? "default" : "pointer" }}
            onClick={() => !row.paymentPaid && openPayModal(row)}
            disabled={row.paymentPaid}
            title={row.paymentPaid ? "Pago ya registrado" : "Registrar pago"}
          >
            <span>{row.paymentPaid ? "💰 Pagado" : "💳 Registrar Pago"}</span>
          </button>
        )}
        {canManageTreatments(session) && !isCompleted(row.status) && row.status !== "cancelled" && (
          <button
            type="button"
            className="agenda-btn agenda-btn-treat"
            onClick={() => (isConfirmed(row.status) || row.status === "in_progress") ? goToTreatment(row) : notify.error("Cita no confirmada", "Confirma la cita antes de atender al paciente.")}
            title={(isConfirmed(row.status) || row.status === "in_progress") ? "Atender paciente" : "Confirma primero"}
            style={!(isConfirmed(row.status) || row.status === "in_progress") ? { opacity: 0.45, cursor: "not-allowed" } : {}}
          >
            <Stethoscope size={13} strokeWidth={1.5} />
            <span>Atender</span>
          </button>
        )}
        {canDeleteAppointments(session) && (
          <button type="button" className="action-btn action-btn-delete" onClick={() => onDelete(row.id)}>
            <span className="icon">🗑️</span>
            <span>Eliminar</span>
          </button>
        )}
      </div>
    );
  }

  function loadAppointments(forDate?: string, forDoctorId?: string, forViewMode: ViewMode = viewMode) {
    const d = forDate ?? date;
    const did = forDoctorId ?? effectiveDoctorId;
    const requestedDates = getDateRangeByView(d, forViewMode);

    const promise = Promise.all([
      Promise.all(requestedDates.map((day) => clinicalApi.listAppointments(did, day, token))),
      clinicalApi.listPatients("", token)
    ]).then(([appointmentsByDate, patients]) => {
      const allAppointments = appointmentsByDate.flatMap((appointmentPage) => appointmentPage.items || []);
      const patientById = new Map(
        (patients.items || []).map((patient) => [patient.id, `${patient.firstName} ${patient.lastName}`.trim()])
      );

      setRows(allAppointments
        .slice()
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
        .map((item) => ({
        id: item.id,
        patientId: item.patientId,
        patientName: patientById.get(item.patientId),
        startAt: item.startAt,
        endAt: item.endAt,
        durationMinutes: item.durationMinutes ?? 30,
        status: item.status,
        paymentAmount: item.paymentAmount,
        paymentPaid: item.paymentPaid,
        paymentMethod: item.paymentMethod,
        consentSummary: item.consentSummary,
      })));
      return { total: allAppointments.length };
    });

    notify.promise(promise, {
      loading: "Sincronizando agenda...",
      success: (_r) => "Agenda actualizada",
      successDesc: (r) => `${r.total} citas encontradas.`,
      error: () => { setRows([]); return "Error de sincronización"; },
      errorDesc: (err) => err instanceof Error ? err.message : "Intenta de nuevo.",
    });
  }

  async function onConfirm(id: string) {
    const promise = clinicalApi.confirmAppointment(id, token);
    notify.promise(promise, {
      loading: "Confirmando cita...",
      success: () => { loadAppointments(date, effectiveDoctorId); return "Cita confirmada"; },
      error: "Error al confirmar",
    });
  }

  async function onResend(id: string) {
    const promise = clinicalApi.resendAppointmentConfirmation(id, token).then((r) => {
      loadAppointments(date, effectiveDoctorId);
      return r;
    });
    notify.promise(promise, {
      loading: "Reenviando confirmación...",
      success: () => "Confirmación reenviada",
      error: "Error al reenviar",
    });
  }

  async function onCancel(id: string) {
    if (!window.confirm("¿Cancelar esta cita?")) return;
    const promise = clinicalApi.updateAppointment(id, { status: "cancelled" }, token);
    notify.promise(promise, {
      loading: "Cancelando cita...",
      success: () => { loadAppointments(date, effectiveDoctorId); return "Cita cancelada"; },
      error: "Error al cancelar",
    });
  }

  function openPayModal(row: AppointmentRow) {
    setPayRow(row);
    setPayPaid(row.paymentPaid ?? false);
    setPayMethod(row.paymentMethod || "efectivo");
    setPayAmount(row.paymentAmount ?? 0);
  }

  async function savePayment() {
    if (!payRow) return;
    setPayingSaving(true);
    try {
      await clinicalApi.registerPayment(payRow.id, { paid: payPaid, paymentMethod: payMethod, paymentAmount: payAmount }, token);
      notify.success(payPaid ? "Pago registrado — cita finalizada" : "Marcado como pendiente de pago");
      setPayRow(null);
      loadAppointments(date, effectiveDoctorId);
    } catch (err) {
      notify.error("Error al registrar pago", err instanceof Error ? err.message : String(err));
    } finally {
      setPayingSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("¿Eliminar esta cita permanentemente?")) return;
    const promise = clinicalApi.deleteAppointment(id, token);
    notify.promise(promise, {
      loading: "Eliminando cita...",
      success: () => { loadAppointments(date, effectiveDoctorId); return "Cita eliminada"; },
      error: "Error al eliminar",
    });
  }

  return (
    <section className="page-section">
      {payRow && (
        <Modal onClose={() => setPayRow(null)}>
          <h3 style={{ marginBottom: 4 }}>Registrar Pago</h3>
          <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: 20 }}>
            Paciente: <strong>{payRow.patientName || payRow.patientId}</strong>
          </p>
          <div className="input-group">
            <label>Estado del pago</label>
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: payPaid ? 700 : 400 }}>
                <input type="radio" name="paid" checked={payPaid} onChange={() => setPayPaid(true)} />
                ✅ Pagó
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: !payPaid ? 700 : 400 }}>
                <input type="radio" name="paid" checked={!payPaid} onChange={() => setPayPaid(false)} />
                ⏳ Pendiente
              </label>
            </div>
          </div>
          {payPaid && (
            <>
              <div className="input-group">
                <label>Monto cobrado</label>
                <input
                  type="number" min={0} step={0.01}
                  className="elite-input"
                  value={payAmount}
                  onChange={e => setPayAmount(Number(e.target.value))}
                  placeholder="0.00"
                />
              </div>
              <div className="input-group">
                <label>Método de pago</label>
                <select className="elite-input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="zelle">Zelle</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button type="button" className="action-btn action-btn-confirm" onClick={savePayment} disabled={payingSaving}>
              {payingSaving ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" className="action-btn" onClick={() => setPayRow(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
      {editRow && (
        <Modal onClose={() => setEditRow(null)}>
          <h3 style={{ marginBottom: 16 }}>Editar Cita</h3>
          <div className="input-group">
            <label>Fecha</label>
            <DatePicker value={editDate} onChange={setEditDate} />
          </div>
          <div className="input-group">
            <label>Hora de inicio</label>
            <select value={editTime} onChange={(e) => setEditTime(e.target.value)}>
              <option value="">Seleccione una hora</option>
              {["07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30",
                "11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30",
                "15:00","15:30","16:00","16:30","17:00","17:30","18:00"].map((s) => {
                const [h, m] = s.split(":").map(Number);
                const ampm = h >= 12 ? "PM" : "AM";
                const h12 = h % 12 || 12;
                const label = `${String(h12).padStart(2,"0")}:${String(m).padStart(2,"0")} ${ampm}`;
                return <option key={s} value={s}>{label}</option>;
              })}
            </select>
          </div>
          <div className="input-group">
            <label>Bloque de tiempo</label>
            <select value={editDuration} onChange={(e) => setEditDuration(Number(e.target.value))}>
              {DURATION_BLOCKS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button type="button" className="action-btn action-btn-confirm" onClick={saveEdit} disabled={saving}>Guardar</button>
            <button type="button" className="action-btn" onClick={() => setEditRow(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
      <div className="grid-2-cols">
        <article className="card elite-card">
          <header className="card-header">
            <h3>Nueva Cita Médica</h3>
          </header>
          <form className="card-form" onSubmit={onCreate}>
            {canSelectDoctor && (
              <div className="input-group">
                <label>Doctor</label>
                <DoctorSearch
                  doctors={doctors}
                  onDoctorSelect={(d) => setSelectedDoctorId(d.id)}
                />
              </div>
            )}
            <div className="input-group">
              <label>Paciente</label>
              <PatientSearch doctorId="" token={token} onPatientSelect={setSelectedPatient} />
              <input type="hidden" name="patientId" value={selectedPatient?.id || ''} />
            </div>
            <div className="row-inputs">
              <div className="input-group">
                <label>Fecha</label>
                <DatePicker value={createDate} onChange={setCreateDate} name="date" required minDate={new Date()} />
              </div>
              <div className="input-group">
                <label>Hora de inicio</label>
                <select name="time" required>
                  <option value="">Seleccione una hora</option>
                  {TIME_SLOTS.map((slot) => (
                    <option
                      key={slot}
                      value={slot}
                      disabled={isCreateDateToday && isPastDateTime(createDate, slot)}
                    >
                      {formatSlotLabel(slot)}
                    </option>
                  ))}
                </select>
                {isCreateDateToday && !hasCreateTimeSlots && (
                  <small style={{ color: "#b45309", fontSize: "0.75rem" }}>
                    Ya no hay horarios disponibles para hoy. Selecciona una fecha futura.
                  </small>
                )}
              </div>
            </div>
            <div className="input-group">
              <label>Bloque de tiempo</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                required
              >
                {DURATION_BLOCKS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>
            <button type="submit">Confirmar Espacio</button>
          </form>
        </article>

        <article className="card elite-card">
          <header className="card-header">
            <h3>Control de Agenda</h3>
          </header>
          <div className="card-form">
            <div className="input-group">
              <label>Fecha de Consulta</label>
              <div className="inline-actions">
                <DatePicker value={date} onChange={(v) => { setDate(v); }} />
                <button type="button" onClick={() => loadAppointments(date, effectiveDoctorId)}>Actualizar</button>
              </div>
            </div>
          </div>
        </article>
      </div>

      <article className="card elite-card" style={{ marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <h3 style={{ margin: 0 }}>
            {viewMode === "day" ? "Calendario Diario de Atención" : viewMode === "week" ? "Calendario Semanal de Atención" : "Calendario Mensual de Atención"}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="agenda-view-switch" role="tablist" aria-label="Modo de visualización de agenda">
              {VIEW_MODE_OPTS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`agenda-view-btn ${viewMode === option.value ? "is-active" : ""}`}
                  onClick={() => setViewMode(option.value)}
                  aria-pressed={viewMode === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="agenda-view-switch" role="tablist" aria-label="Formato de visualización de agenda">
              {DISPLAY_MODE_OPTS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`agenda-view-btn ${displayMode === option.value ? "is-active" : ""}`}
                  onClick={() => setDisplayMode(option.value)}
                  aria-pressed={displayMode === option.value}
                >
                  {option.value === "calendar" ? <CalendarDays size={13} strokeWidth={1.7} /> : <List size={13} strokeWidth={1.7} />}
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
            <button type="button" className="agenda-btn" onClick={() => loadAppointments(date, effectiveDoctorId, viewMode)} title="Actualizar agenda">
              <RefreshCw size={13} strokeWidth={1.5} />
              <span>Actualizar</span>
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.875rem", color: "#64748b" }}>
              <span>Auto:</span>
              <select
                value={autoRefreshSeconds}
                onChange={(e) => setAutoRefreshSeconds(Number(e.target.value))}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: "0.8rem", minWidth: 100 }}
              >
                {AUTO_REFRESH_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="agenda-filter-check">
              <input
                type="checkbox"
                checked={hideCompletedCancelled}
                onChange={(e) => setHideCompletedCancelled(e.target.checked)}
              />
              <span>Ocultar finalizadas y canceladas</span>
            </label>
          </div>
        </div>
        {displayMode === "list" ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Referencia</th>
                  <th>Paciente</th>
                  {viewMode !== "day" && <th>Fecha</th>}
                  <th>Horario</th>
                  <th>Estado</th>
                  <th>Consentimientos</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{row.id.split("-")[0]}...</td>
                    <td>
                      <strong>{row.patientName || row.patientId}</strong>
                    </td>
                    {viewMode !== "day" && <td>{formatAgendaDate(row.startAt)}</td>}
                    <td>{formatTimeRange(row.startAt, row.endAt)}</td>
                    <td>
                      <span className={`badge ${statusClass[row.status] ?? "status-unconfirmed"}`}>
                        {statusLabel[row.status] ?? row.status}
                      </span>
                    </td>
                    <td>
                      {row.consentSummary && row.consentSummary.total > 0 ? (
                        row.consentSummary.accepted >= row.consentSummary.total ? (
                          <span className="badge status-confirmed" title="Todos firmados">Completo</span>
                        ) : (
                          <span className="badge badge-neutral" title={`${row.consentSummary.accepted}/${row.consentSummary.total} aceptados. El paciente debe abrir todos los enlaces del correo.`}>Pendiente</span>
                        )
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>{renderRowActions(row)}</td>
                  </tr>
                ))}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={viewMode === "day" ? 6 : 7} className="empty-state">
                      {hideCompletedCancelled
                        ? "No hay citas visibles con el filtro actual."
                        : viewMode === "day"
                        ? "Sin citas programadas para esta fecha."
                        : viewMode === "week"
                          ? "Sin citas programadas para esta semana."
                          : "Sin citas programadas para este mes."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="agenda-calendar-wrap">
            <div className={`agenda-calendar-grid ${viewMode === "day" ? "is-day" : ""}`}>
              {visibleDates.map((localDate) => {
                const dateRows = rowsByDate[localDate] ?? [];
                return (
                  <section className="agenda-calendar-column" key={localDate}>
                    <header className="agenda-calendar-column-header">
                      <strong>{formatCalendarDayLabel(localDate)}</strong>
                      <small>{dateRows.length} cita{dateRows.length === 1 ? "" : "s"}</small>
                    </header>
                    <div className="agenda-calendar-column-body">
                      {dateRows.length === 0 ? (
                        <div className="agenda-calendar-empty">Sin citas</div>
                      ) : (
                        dateRows.map((row) => (
                          <article key={row.id} className="agenda-calendar-item">
                            <div className="agenda-calendar-top">
                              <span className="agenda-calendar-time">{formatTimeRange(row.startAt, row.endAt)}</span>
                              <span className={`badge ${statusClass[row.status] ?? "status-unconfirmed"}`}>
                                {statusLabel[row.status] ?? row.status}
                              </span>
                            </div>
                            <div className="agenda-calendar-patient">
                              <strong>{row.patientName || row.patientId}</strong>
                              <small className="mono">{row.id.split("-")[0]}...</small>
                            </div>
                            <div className="agenda-calendar-actions">{renderRowActions(row)}</div>
                          </article>
                        ))
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </article>
    </section>
  );
}

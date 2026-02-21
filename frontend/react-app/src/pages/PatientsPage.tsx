import { FormEvent, useEffect, useRef, useState } from "react";
import { clinicalApi } from "../api/clinical";
import { notify } from "../lib/notify";
import { canWritePatients, canDeletePatients } from "../lib/rbac";
import { DatePicker } from "../components/ui/DatePicker";
import { Modal } from "../components/Modal";
import type { AuthSession } from "../types";

type PatientRow = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  documentId?: string;
  birthDate?: string;
};

type ConsultaHistorial = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  evolutionNotes?: string;
  treatmentPlan?: string;
  paymentAmount?: number;
  paymentMethod?: string;
  imageKeys?: string[];
};

type PatientDetail = PatientRow & {
  medicalBackgrounds?: Array<{ type: string; description: string }>;
};

const statusLabel: Record<string, string> = {
  scheduled: "Pendiente",
  confirmed: "Confirmada",
  in_progress: "En consulta",
  completed: "Finalizada",
  cancelled: "Cancelada",
};
const statusClass: Record<string, string> = {
  scheduled: "status-unconfirmed",
  confirmed: "status-confirmed",
  in_progress: "status-in-progress",
  completed: "status-completed",
  cancelled: "status-cancelled",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function exportCSV(patient: PatientRow, consultas: ConsultaHistorial[]) {
  const header = ["Fecha", "Hora", "Estado", "Notas de evolución", "Plan de tratamiento", "Monto", "Método de pago"];
  const escape = (v: string | number | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = consultas.map(c => [
    escape(fmtDate(c.startAt)),
    escape(fmtTime(c.startAt)),
    escape(statusLabel[c.status] ?? c.status),
    escape(c.evolutionNotes),
    escape(c.treatmentPlan),
    escape(c.paymentAmount != null ? c.paymentAmount.toFixed(2) : ""),
    escape(c.paymentMethod),
  ].join(","));
  const csv = [header.map(h => `"${h}"`).join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `consultas_${patient.firstName}_${patient.lastName}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(patient: PatientRow, consultas: ConsultaHistorial[], patientDetail: PatientDetail | null) {
  const bgs = patientDetail?.medicalBackgrounds ?? [];
  const antecedentes = bgs.length > 0
    ? bgs.map(b => `${b.type}: ${b.description || "Sí"}`).join(" | ")
    : "Sin antecedentes registrados";

  const consultasHTML = consultas.map((c, i) => `
    <div class="consulta-block">
      <div class="consulta-header">
        <span class="consulta-num">#${consultas.length - i}</span>
        <span class="consulta-fecha">${fmtDate(c.startAt)} · ${fmtTime(c.startAt)}</span>
        <span class="consulta-estado">${statusLabel[c.status] ?? c.status}</span>
      </div>
      <div class="campo"><span class="label">Notas de evolución</span><p>${c.evolutionNotes || "Sin notas."}</p></div>
      <div class="campo"><span class="label">Plan de tratamiento</span><p>${c.treatmentPlan || "Sin plan registrado."}</p></div>
      ${c.paymentAmount ? `<div class="campo"><span class="label">Pago</span><p>$${c.paymentAmount.toFixed(2)} · ${c.paymentMethod ?? "—"}</p></div>` : ""}
    </div>
  `).join("");

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Historial — ${patient.firstName} ${patient.lastName}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 0; padding: 24px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .subtitle { color: #64748b; font-size: 11px; margin: 0 0 16px; }
    .patient-info { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
    .patient-info p { margin: 2px 0; font-size: 11px; color: #475569; }
    .patient-info strong { font-size: 14px; color: #0f172a; }
    .antecedentes { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 12px; margin-bottom: 20px; font-size: 11px; color: #92400e; }
    .consulta-block { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; page-break-inside: avoid; }
    .consulta-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
    .consulta-num { font-weight: 700; color: #0ea5e9; font-size: 11px; }
    .consulta-fecha { font-weight: 600; font-size: 12px; flex: 1; }
    .consulta-estado { font-size: 10px; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; border-radius: 999px; padding: 2px 8px; }
    .campo { margin-bottom: 8px; }
    .label { font-weight: 700; font-size: 10px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; display: block; margin-bottom: 2px; }
    .campo p { margin: 0; color: #334155; line-height: 1.5; white-space: pre-wrap; }
    .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 10px; color: #94a3b8; text-align: center; }
    @media print { body { padding: 0; } }
  </style></head><body>
  <h1>Historial de Consultas</h1>
  <p class="subtitle">Generado el ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}</p>
  <div class="patient-info">
    <strong>${patient.firstName} ${patient.lastName}</strong>
    <p>${patient.documentId ? `🇮🇩 ${patient.documentId}` : ""} ${patient.phone ? `· 📞 ${patient.phone}` : ""} ${patient.email ? `· ✉️ ${patient.email}` : ""}</p>
  </div>
  ${bgs.length > 0 ? `<div class="antecedentes"><strong>Antecedentes médicos:</strong> ${antecedentes}</div>` : ""}
  ${consultasHTML}
  <div class="footer">CliniSense — ${consultas.length} consulta${consultas.length !== 1 ? "s" : ""} registrada${consultas.length !== 1 ? "s" : ""}</div>
  </body></html>`;

  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

export function PatientsPage({ token, doctorId, session }: { token: string; doctorId: string; session: AuthSession }) {
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingPatient, setEditingPatient] = useState<PatientRow | null>(null);
  const [birthDate, setBirthDate] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);

  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(null);
  const [patientDetail, setPatientDetail] = useState<PatientDetail | null>(null);
  const [historial, setHistorial] = useState<ConsultaHistorial[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [detailCita, setDetailCita] = useState<ConsultaHistorial | null>(null);

  const closeModal = () => {
    setShowModal(false);
    setEditingPatient(null);
    formRef.current?.reset();
  };

  const loadPatients = () => {
    setLoading(true);
    clinicalApi.listPatients(doctorId, token)
      .then((result) => {
        setRows(result.items.map((p) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          phone: p.phone,
          documentId: p.documentId,
        })));
      })
      .catch(() => {
        notify.error("Error al cargar pacientes", "No se pudo obtener la lista del servidor.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPatients();
  }, [doctorId, token]);

  async function openHistorial(patient: PatientRow) {
    setSelectedPatient(patient);
    setPatientDetail(null);
    setHistorial([]);
    setLoadingHistorial(true);
    try {
      const [apptResult, patResult] = await Promise.allSettled([
        clinicalApi.listAppointmentsByPatient(patient.id, token),
        clinicalApi.getPatient(patient.id, token),
      ]);
      if (apptResult.status === "fulfilled") {
        const items = (apptResult.value.items ?? []) as ConsultaHistorial[];
        items.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
        setHistorial(items);
      }
      if (patResult.status === "fulfilled") {
        setPatientDetail(patResult.value as PatientDetail);
      }
    } catch {
      notify.error("Error al cargar historial");
    } finally {
      setLoadingHistorial(false);
    }
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      firstName: String(fd.get("firstName") || ""),
      lastName: String(fd.get("lastName") || ""),
      phone: String(fd.get("phone") || ""),
      email: String(fd.get("email") || ""),
      birthDate: String(fd.get("birthDate") || ""),
      documentId: String(fd.get("documentId") || ""),
    };

    setSaving(true);

    const promise = editingPatient
      ? clinicalApi.updatePatient(editingPatient.id, data, token)
      : clinicalApi.onboardPatient({ ...data, doctorId, specialty: "odontology", medicalBackgrounds: [], imageKeys: [] }, token);

    notify.promise(promise, {
      loading: editingPatient ? "Actualizando paciente..." : "Registrando paciente...",
      success: () => {
        loadPatients();
        setShowModal(false);
        setEditingPatient(null);
        formRef.current?.reset();
        return editingPatient ? "Paciente actualizado" : "Paciente registrado";
      },
      error: editingPatient ? "Error al actualizar" : "Error al registrar",
    }).finally(() => setSaving(false));
  }

  const handleEdit = (patient: PatientRow) => {
    setEditingPatient(patient);
    setBirthDate(patient.birthDate ?? "");
    setShowModal(true);
  };

  const handleDelete = (patient: PatientRow) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar a ${patient.firstName} ${patient.lastName}?`)) {
      const promise = clinicalApi.deletePatient(patient.id, token);
      notify.promise(promise, {
        loading: 'Eliminando paciente...',
        success: () => {
          loadPatients();
          return 'Paciente eliminado';
        },
        error: 'Error al eliminar',
      });
    }
  };

  async function onSearch() {
    if (!query.trim()) return;
    setSearching(true);
    const promise = clinicalApi.searchPatients(query.trim(), doctorId, token);
    notify.promise(promise, {
      loading: "Buscando pacientes...",
      success: (result) => {
        const found: PatientRow[] = result.items.map((p) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          phone: p.phone,
          documentId: p.documentId,
        }));
        setRows(found);
        return `${result.total} resultado${result.total !== 1 ? "s" : ""} encontrado${result.total !== 1 ? "s" : ""}`;
      },
      successDesc: (result) => result.total === 0 ? "Intenta con otro dato." : "Lista actualizada.",
      error: "Error en la búsqueda",
      errorDesc: (err) => err instanceof Error ? err.message : "Verifica los datos e intenta de nuevo.",
    }).finally(() => setSearching(false));
  }

  return (
    <section className="page-section">

      {/* Header de página */}
      <div className="patients-page-header">
        <div className="patients-header-left">
          <h2 className="patients-title">Pacientes</h2>
          <span className="patients-count">
            {loading ? "Cargando..." : `${rows.length} resultado${rows.length !== 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="patients-header-right">
          <div className="patients-search-bar">
            <span className="search-icon">🔍</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              placeholder="Nombre, apellido, cédula, email o teléfono..."
            />
            {query && (
              <button type="button" className="search-clear" onClick={() => setQuery("")}>✕</button>
            )}
            <button type="button" onClick={onSearch} disabled={searching} className="search-remote-btn">
              {searching ? <span className="auth-spinner" style={{borderTopColor: "white"}} /> : "Buscar"}
            </button>
          </div>
          {canWritePatients(session) && (
            <button className="btn-new-patient" onClick={() => setShowModal(true)}>
              + Nuevo Paciente
            </button>
          )}
        </div>
      </div>

      {/* Layout principal: tabla + drawer */}
      <div className={`patients-layout ${selectedPatient ? "with-drawer" : ""}`}>

        {/* Tabla de pacientes */}
        <article className="card elite-card patients-table-card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cédula / ID</th>
                  <th>Nombre Completo</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="skeleton-row">
                      <td><div className="skeleton-cell" /></td>
                      <td><div className="skeleton-cell" /></td>
                      <td><div className="skeleton-cell" /></td>
                      <td><div className="skeleton-cell" /></td>
                      <td><div className="skeleton-cell" /></td>
                    </tr>
                  ))
                )}
                {!loading && rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`patient-row-clickable ${selectedPatient?.id === row.id ? "patient-row-active" : ""}`}
                    onClick={() => openHistorial(row)}
                    title="Ver historial de consultas"
                  >
                    <td>
                      <div className="patient-id-cell">
                        <div className="patient-avatar-sm">
                          {row.firstName[0]}{row.lastName[0]}
                        </div>
                        <span className="mono">{row.documentId || row.id}</span>
                      </div>
                    </td>
                    <td><strong>{row.firstName} {row.lastName}</strong></td>
                    <td>{row.email || <span className="text-muted-sm">—</span>}</td>
                    <td>{row.phone || <span className="text-muted-sm">—</span>}</td>
                    <td><span className="badge status-confirmed">Activo</span></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 8 }}>
                        {canWritePatients(session) && (
                          <button type="button" className="action-btn" onClick={() => handleEdit(row)}>
                            <span className="icon">✏️</span>
                            <span>Editar</span>
                          </button>
                        )}
                        {canDeletePatients(session) && (
                          <button type="button" className="action-btn action-btn-delete" onClick={() => handleDelete(row)}>
                            <span className="icon">🗑️</span>
                            <span>Eliminar</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      <div className="empty-state-content">
                        <span className="empty-icon">👥</span>
                        <strong>{query ? `Sin resultados para "${query}"` : "Sin pacientes registrados"}</strong>
                        <p>{query ? "Intenta con otro dato de búsqueda." : "Usa el botón \"Nuevo Paciente\" para agregar el primer expediente."}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        {/* Drawer de historial */}
        {selectedPatient && (
          <aside className="historial-drawer">
            <div className="historial-drawer-header">
              <div className="historial-drawer-title">
                <div className="patient-avatar-sm" style={{ width: 36, height: 36, fontSize: "0.9rem" }}>
                  {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                </div>
                <div>
                  <strong>{selectedPatient.firstName} {selectedPatient.lastName}</strong>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>Historial de consultas</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {historial.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="export-btn"
                      onClick={() => exportPDF(selectedPatient, historial, patientDetail)}
                      title="Exportar todas las consultas como PDF"
                    >
                      📄 PDF
                    </button>
                    <button
                      type="button"
                      className="export-btn export-btn-csv"
                      onClick={() => exportCSV(selectedPatient, historial)}
                      title="Exportar todas las consultas como CSV"
                    >
                      📊 CSV
                    </button>
                  </>
                )}
                <button className="historial-drawer-close" onClick={() => setSelectedPatient(null)}>✕</button>
              </div>
            </div>

            <div className="historial-drawer-body">
              {loadingHistorial && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div className="auth-spinner" style={{ margin: "0 auto" }} />
                  <p style={{ color: "#94a3b8", marginTop: 12, fontSize: "0.85rem" }}>Cargando historial...</p>
                </div>
              )}

              {!loadingHistorial && historial.length === 0 && (
                <div className="historial-empty">
                  <span style={{ fontSize: "2rem" }}>📋</span>
                  <p>Sin consultas registradas</p>
                  <small>Las consultas finalizadas aparecerán aquí</small>
                </div>
              )}

              {!loadingHistorial && historial.map((cita) => {
                const fecha = new Date(cita.startAt);
                const fechaLabel = fecha.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
                const horaLabel = fecha.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                return (
                  <div
                    key={cita.id}
                    className={`historial-item historial-item-clickable ${cita.status === "completed" ? "historial-item-completed" : ""}`}
                    onClick={() => setDetailCita(cita)}
                    title="Ver detalle completo"
                  >
                    <div className="historial-item-header">
                      <div>
                        <span className="historial-fecha">{fechaLabel}</span>
                        <span className="historial-hora"> · {horaLabel}</span>
                      </div>
                      <span className={`badge ${statusClass[cita.status] ?? "status-unconfirmed"}`} style={{ fontSize: "0.65rem" }}>
                        {statusLabel[cita.status] ?? cita.status}
                      </span>
                    </div>

                    {cita.evolutionNotes && (
                      <div className="historial-field">
                        <span className="historial-field-label">📝 Evolución</span>
                        <p className="historial-field-value historial-field-preview">{cita.evolutionNotes}</p>
                      </div>
                    )}

                    {cita.treatmentPlan && (
                      <div className="historial-field">
                        <span className="historial-field-label">🦷 Plan de tratamiento</span>
                        <p className="historial-field-value historial-field-preview">{cita.treatmentPlan}</p>
                      </div>
                    )}

                    {cita.paymentAmount != null && cita.paymentAmount > 0 && (
                      <div className="historial-field">
                        <span className="historial-field-label">💰 Pago</span>
                        <p className="historial-field-value">
                          ${cita.paymentAmount.toFixed(2)} · {cita.paymentMethod ?? "—"}
                        </p>
                      </div>
                    )}

                    {!cita.evolutionNotes && !cita.treatmentPlan && (
                      <p style={{ color: "#94a3b8", fontSize: "0.8rem", margin: "4px 0 0" }}>Sin notas registradas</p>
                    )}

                    <span className="historial-ver-detalle">Ver detalle →</span>
                  </div>
                );
              })}
            </div>
          </aside>
        )}
      </div>

      {/* Modal de detalle completo de consulta */}
      {detailCita && selectedPatient && (() => {
        const bgs = patientDetail?.medicalBackgrounds ?? [];
        const has = (t: string) => bgs.some(b => b.type === t);
        const detail = (t: string) => bgs.find(b => b.type === t)?.description ?? "";
        const imageUrls = (detailCita.imageKeys ?? []).map(k =>
          k.startsWith("http") ? k : `https://clinical-appointment-images-975738006503.s3.amazonaws.com/${k}`
        );
        return (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDetailCita(null)}>
            <div className="modal-card detalle-consulta-modal" style={{ maxWidth: 680 }}>
              <div className="modal-header">
                <div>
                  <h3>Detalle de Consulta</h3>
                  <p>
                    {new Date(detailCita.startAt).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    {" · "}
                    {new Date(detailCita.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {" – "}
                    {new Date(detailCita.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <button className="modal-close" onClick={() => setDetailCita(null)}>✕</button>
              </div>

              <div className="detalle-consulta-body">

                {/* Paciente y estado */}
                <div className="detalle-paciente-row">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="patient-avatar-sm">{selectedPatient.firstName[0]}{selectedPatient.lastName[0]}</div>
                    <div>
                      <strong>{selectedPatient.firstName} {selectedPatient.lastName}</strong>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>
                        {selectedPatient.documentId && <span>🪪 {selectedPatient.documentId} · </span>}
                        {selectedPatient.phone && <span>📞 {selectedPatient.phone} · </span>}
                        {selectedPatient.email && <span>✉️ {selectedPatient.email}</span>}
                      </p>
                    </div>
                  </div>
                  <span className={`badge ${statusClass[detailCita.status] ?? "status-unconfirmed"}`}>
                    {statusLabel[detailCita.status] ?? detailCita.status}
                  </span>
                </div>

                {/* ── Historial Médico ── */}
                <div className="detalle-seccion">
                  <h4 className="detalle-seccion-titulo">📋 Historial Médico</h4>
                  <div className="detalle-grid-2">
                    {has("medication") && (
                      <div className="detalle-campo">
                        <span className="detalle-campo-label">Medicamentos</span>
                        <span>{detail("medication") || "Sí"}</span>
                      </div>
                    )}
                    {has("allergy_med") && (
                      <div className="detalle-campo">
                        <span className="detalle-campo-label">Alergia medicamentos</span>
                        <span>{detail("allergy_med") || "Sí"}</span>
                      </div>
                    )}
                    {has("allergies") && (
                      <div className="detalle-campo">
                        <span className="detalle-campo-label">Alergias</span>
                        <span>{detail("allergies") || "Sí"}</span>
                      </div>
                    )}
                    {(["anemia","hepatitis","diabetes","hypertension","cholesterol"] as const).filter(has).length > 0 && (
                      <div className="detalle-campo" style={{ gridColumn: "1 / -1" }}>
                        <span className="detalle-campo-label">Antecedentes patológicos</span>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                          {(["anemia","hepatitis","diabetes","hypertension","cholesterol"] as const).filter(has).map(p => (
                            <span key={p} className="badge status-unconfirmed" style={{ fontSize: "0.7rem" }}>
                              {p.charAt(0).toUpperCase() + p.slice(1)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {has("notes") && (
                      <div className="detalle-campo" style={{ gridColumn: "1 / -1" }}>
                        <span className="detalle-campo-label">Otras observaciones</span>
                        <span>{detail("notes")}</span>
                      </div>
                    )}
                    {bgs.length === 0 && (
                      <p style={{ color: "#94a3b8", fontSize: "0.82rem", margin: 0 }}>Sin antecedentes registrados</p>
                    )}
                  </div>
                </div>

                {/* ── Evolución ── */}
                <div className="detalle-seccion">
                  <h4 className="detalle-seccion-titulo">📝 Evolución de la Consulta</h4>
                  <div className="detalle-campo">
                    <span className="detalle-campo-label">Notas de evolución</span>
                    <p className="detalle-texto">{detailCita.evolutionNotes || "Sin notas registradas."}</p>
                  </div>
                  <div className="detalle-campo" style={{ marginTop: 10 }}>
                    <span className="detalle-campo-label">Plan de tratamiento</span>
                    <p className="detalle-texto">{detailCita.treatmentPlan || "Sin plan registrado."}</p>
                  </div>
                </div>

                {/* ── Pago ── */}
                {detailCita.paymentAmount != null && detailCita.paymentAmount > 0 && (
                  <div className="detalle-seccion">
                    <h4 className="detalle-seccion-titulo">💰 Pago</h4>
                    <div className="detalle-grid-2">
                      <div className="detalle-campo">
                        <span className="detalle-campo-label">Monto cobrado</span>
                        <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#10b981" }}>${detailCita.paymentAmount.toFixed(2)}</span>
                      </div>
                      <div className="detalle-campo">
                        <span className="detalle-campo-label">Método de pago</span>
                        <span style={{ textTransform: "capitalize" }}>{detailCita.paymentMethod ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Imágenes ── */}
                <div className="detalle-seccion">
                  <h4 className="detalle-seccion-titulo">🖼️ Imágenes ({imageUrls.length})</h4>
                  {imageUrls.length === 0 ? (
                    <p style={{ color: "#94a3b8", fontSize: "0.82rem", margin: 0 }}>Sin imágenes registradas</p>
                  ) : (
                    <div className="image-gallery" style={{ marginTop: 8 }}>
                      {imageUrls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer" className="image-thumb-link">
                          <img src={url} alt={`Imagen ${i + 1}`} className="image-thumb" />
                          <span className="image-thumb-label">Ver original</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="modal-actions" style={{ justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="export-btn"
                      onClick={() => exportPDF(selectedPatient, [detailCita], patientDetail)}
                      title="Exportar esta consulta como PDF"
                    >
                      📄 PDF
                    </button>
                    <button
                      type="button"
                      className="export-btn export-btn-csv"
                      onClick={() => exportCSV(selectedPatient, [detailCita])}
                      title="Exportar esta consulta como CSV"
                    >
                      📊 CSV
                    </button>
                  </div>
                  <button type="button" onClick={() => setDetailCita(null)}>Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de registro/edición */}
      {showModal && (
        <Modal onClose={closeModal}>
          <div className="modal-header">
            <div>
              <h3>{editingPatient ? "Editar Paciente" : "Registrar Nuevo Paciente"}</h3>
              <p style={{ color: "#64748b", fontSize: "0.85rem", margin: 0 }}>Complete los datos del expediente clínico</p>
            </div>
            <button className="modal-close" onClick={closeModal}>✕</button>
          </div>

          <form ref={formRef} className="card-form modal-form" onSubmit={onSave}>
            <div className="row-inputs">
              <div className="input-group">
                <label>Nombre(s) <span className="required">*</span></label>
                <input name="firstName" placeholder="Juan" required defaultValue={editingPatient?.firstName} />
              </div>
              <div className="input-group">
                <label>Apellido(s) <span className="required">*</span></label>
                <input name="lastName" placeholder="Pérez" required defaultValue={editingPatient?.lastName} />
              </div>
            </div>

            <div className="input-group">
              <label>Cédula / Documento de Identidad</label>
              <input name="documentId" placeholder="V-12345678" defaultValue={editingPatient?.documentId} />
            </div>

            <div className="row-inputs">
              <div className="input-group">
                <label>Email de contacto</label>
                <input name="email" type="email" placeholder="paciente@email.com" defaultValue={editingPatient?.email} />
              </div>
              <div className="input-group">
                <label>Teléfono</label>
                <input name="phone" placeholder="+58 414 000 0000" defaultValue={editingPatient?.phone} />
              </div>
            </div>

            <div className="input-group">
              <label>Fecha de Nacimiento</label>
              <DatePicker value={birthDate} onChange={setBirthDate} name="birthDate" />
            </div>

            <div className="modal-actions">
              <button type="button" className="ghost" onClick={closeModal}>
                Cancelar
              </button>
              <button type="submit" disabled={saving}>
                {saving ? <><span className="auth-spinner" />Guardando...</> : (editingPatient ? 'Guardar Cambios' : 'Registrar Paciente')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

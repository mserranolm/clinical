import { FormEvent, useEffect, useRef, useState } from "react";
import { clinicalApi } from "../api/clinical";
import { notify } from "../lib/notify";

type PatientRow = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  documentId?: string;
};

export function PatientsPage({ token, doctorId }: { token: string; doctorId: string }) {
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
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
  }, [doctorId, token]);

  async function onRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const firstName = String(fd.get("firstName") || "");
    const lastName = String(fd.get("lastName") || "");

    setSaving(true);
    const promise = clinicalApi.onboardPatient(
      {
        doctorId,
        specialty: "odontology",
        firstName,
        lastName,
        phone: String(fd.get("phone") || ""),
        email: String(fd.get("email") || ""),
        birthDate: String(fd.get("birthDate") || ""),
        documentId: String(fd.get("documentId") || ""),
        medicalBackgrounds: [],
        imageKeys: []
      },
      token
    );

    notify.promise(promise, {
      loading: "Registrando paciente...",
      success: (result) => {
        const newRow: PatientRow = {
          id: String(result.id),
          firstName,
          lastName,
          email: String(fd.get("email") || "") || undefined,
          phone: String(fd.get("phone") || "") || undefined,
          documentId: String(fd.get("documentId") || "") || undefined,
        };
        setRows((prev) => [newRow, ...prev]);
        setShowModal(false);
        formRef.current?.reset();
        setSaving(false);
        return "Paciente registrado";
      },
      successDesc: `${firstName} ${lastName} fue agregado al expediente.`,
      error: "Error al registrar",
      errorDesc: (err) => err instanceof Error ? err.message : "Intenta nuevamente.",
    }).finally(() => setSaving(false));
  }

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
          <button className="btn-new-patient" onClick={() => setShowModal(true)}>
            + Nuevo Paciente
          </button>
        </div>
      </div>

      {/* Tabla de pacientes */}
      <article className="card elite-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cédula / ID</th>
                <th>Nombre Completo</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Estado</th>
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
                <tr key={row.id}>
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
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-state">
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

      {/* Modal de registro */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Registrar Nuevo Paciente</h3>
                <p>Complete los datos del expediente clínico</p>
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form className="card-form modal-form" onSubmit={onRegister}>
              <div className="row-inputs">
                <div className="input-group">
                  <label>Nombre(s) <span className="required">*</span></label>
                  <input name="firstName" placeholder="Juan" required />
                </div>
                <div className="input-group">
                  <label>Apellido(s) <span className="required">*</span></label>
                  <input name="lastName" placeholder="Pérez" required />
                </div>
              </div>

              <div className="input-group">
                <label>Cédula / Documento de Identidad</label>
                <input name="documentId" placeholder="V-12345678" />
              </div>

              <div className="row-inputs">
                <div className="input-group">
                  <label>Email de contacto</label>
                  <input name="email" type="email" placeholder="paciente@email.com" />
                </div>
                <div className="input-group">
                  <label>Teléfono</label>
                  <input name="phone" placeholder="+58 414 000 0000" />
                </div>
              </div>

              <div className="input-group">
                <label>Fecha de Nacimiento</label>
                <input name="birthDate" type="date" />
              </div>

              <div className="modal-actions">
                <button type="button" className="ghost" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving}>
                  {saving ? <><span className="auth-spinner" />Guardando...</> : "Registrar Paciente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

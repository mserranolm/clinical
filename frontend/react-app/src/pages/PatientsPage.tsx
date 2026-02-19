import { FormEvent, useEffect, useRef, useState } from "react";
import { clinicalApi } from "../api/clinical";
import { notify } from "../lib/notify";
import { canWritePatients, canDeletePatients } from "../lib/rbac";
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

export function PatientsPage({ token, doctorId, session }: { token: string; doctorId: string; session: AuthSession }) {
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingPatient, setEditingPatient] = useState<PatientRow | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
        loadPatients(); // Recargar la lista
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
                  <td>
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
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>{editingPatient ? "Editar Paciente" : "Registrar Nuevo Paciente"}</h3>
                <p>Complete los datos del expediente clínico</p>
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
                <input name="birthDate" type="date" defaultValue={editingPatient?.birthDate} />
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
          </div>
        </div>
      )}
    </section>
  );
}

import { useEffect, useState } from "react";
import { clinicalApi } from "../api/clinical";
import type { AuthSession } from "../types";

type OrgUser = { id: string; name: string; email: string; phone?: string; address?: string; role: string; status: string; createdAt: string };

const ROLE_LABELS: Record<string, string> = { admin: "Admin", doctor: "Doctor", assistant: "Asistente", patient: "Paciente" };

const roleBadge = (role: string) => {
  const colors: Record<string, { bg: string; text: string }> = {
    admin: { bg: "#dbeafe", text: "#1e40af" },
    doctor: { bg: "#d1fae5", text: "#065f46" },
    assistant: { bg: "#fef3c7", text: "#92400e" },
    patient: { bg: "#f3f4f6", text: "#374151" },
  };
  const c = colors[role] ?? { bg: "#f3f4f6", text: "#374151" };
  return <span style={{ background: c.bg, color: c.text, padding: "2px 8px", borderRadius: 4, fontSize: "0.75rem", fontWeight: 600 }}>{ROLE_LABELS[role] ?? role}</span>;
};

const statusBadge = (status: string) => (
  <span style={{
    background: status === "active" ? "#d1fae5" : "#fee2e2",
    color: status === "active" ? "#065f46" : "#991b1b",
    padding: "2px 8px", borderRadius: 4, fontSize: "0.75rem", fontWeight: 600
  }}>{status === "active" ? "Activo" : "Deshabilitado"}</span>
);

const inp: React.CSSProperties = { width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box", fontSize: "0.875rem" };
const lbl: React.CSSProperties = { display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: 4 };

const EMPTY_CREATE = { name: "", email: "", phone: "", address: "", role: "doctor", password: "", confirm: "" };
const EMPTY_INVITE = { email: "", role: "doctor" };

export function UsersAdminPage({ session }: { session: AuthSession }) {
  const orgId = session.orgId ?? "";
  const token = session.token;

  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "invite">("create");

  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE);
  const [submitting, setSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const [editUser, setEditUser] = useState<OrgUser | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editInfoUser, setEditInfoUser] = useState<OrgUser | null>(null);
  const [editInfo, setEditInfo] = useState({ name: "", phone: "", address: "" });
  const [confirmDelete, setConfirmDelete] = useState<OrgUser | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadUsers() {
    if (!orgId) return;
    setLoading(true);
    setError("");
    try {
      const res = await clinicalApi.listOrgUsers(orgId, token);
      setUsers(res.items ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando usuarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, [orgId]);

  const countByRole = (role: string) => users.filter(u => u.role === role && u.status === "active").length;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (createForm.password !== createForm.confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (createForm.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setSubmitting(true);
    setError(""); setSuccess("");
    try {
      await clinicalApi.createOrgUser(orgId, {
        name: createForm.name,
        email: createForm.email,
        phone: createForm.phone,
        address: createForm.address,
        role: createForm.role,
        password: createForm.password,
      }, token);
      setSuccess(`Usuario ${createForm.name} creado correctamente como ${ROLE_LABELS[createForm.role]}`);
      setCreateForm(EMPTY_CREATE);
      setShowForm(false);
      loadUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error creando usuario");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(""); setSuccess(""); setInviteLink("");
    try {
      const res = await clinicalApi.inviteUser(orgId, inviteForm, token);
      const base = window.location.origin;
      const link = `${base}/accept-invitation?token=${res.token}`;
      setInviteLink(link);
      setSuccess(`Invitación enviada a ${res.email} (${ROLE_LABELS[res.role] ?? res.role}). Expira: ${new Date(res.expiresAt).toLocaleString()}`);
      setInviteForm(EMPTY_INVITE);
      setShowForm(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error enviando invitación");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(user: OrgUser) {
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await clinicalApi.deleteOrgUser(orgId, user.id, token);
      setSuccess(`Usuario ${user.name || user.email} eliminado`);
      setConfirmDelete(null);
      loadUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error eliminando usuario");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!editInfoUser) return;
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await clinicalApi.updateOrgUser(orgId, editInfoUser.id, { name: editInfo.name, phone: editInfo.phone, address: editInfo.address } as Parameters<typeof clinicalApi.updateOrgUser>[2], token);
      setSuccess(`Datos de ${editInfo.name} actualizados`);
      setEditInfoUser(null);
      loadUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error actualizando usuario");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(user: OrgUser) {
    setSaving(true);
    setError(""); setSuccess("");
    try {
      const newStatus = user.status === "active" ? "disabled" : "active";
      await clinicalApi.updateOrgUser(orgId, user.id, { status: newStatus }, token);
      setSuccess(`Usuario ${user.name} ${newStatus === "active" ? "habilitado" : "deshabilitado"}`);
      loadUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error actualizando usuario");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRole(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await clinicalApi.updateOrgUser(orgId, editUser.id, { role: editRole }, token);
      setSuccess(`Rol de ${editUser.name} actualizado a ${ROLE_LABELS[editRole] ?? editRole}`);
      setEditUser(null);
      loadUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error actualizando rol");
    } finally {
      setSaving(false);
    }
  }

  const orgLimits = { maxDoctors: 5, maxAssistants: 2, maxPatients: 20 };

  if (!orgId) {
    return <div style={{ padding: "2rem" }}><p style={{ color: "#6b7280" }}>No hay organización asociada a tu cuenta.</p></div>;
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}>Usuarios y permisos</h1>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>Org: <code style={{ background: "#f3f4f6", padding: "1px 6px", borderRadius: 4 }}>{orgId}</code></p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setError(""); setSuccess(""); }}
          style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 600 }}>
          + Agregar usuario
        </button>
      </div>

      {/* Contadores por rol */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {([
          { role: "admin", limit: orgLimits.maxDoctors, label: "Admin" },
          { role: "doctor", limit: orgLimits.maxDoctors, label: "Doctor" },
          { role: "assistant", limit: orgLimits.maxAssistants, label: "Asistente" },
        ] as const).map(({ role, limit, label }) => {
          const count = countByRole(role);
          const full = count >= limit;
          return (
            <div key={role} style={{ background: full ? "#fef2f2" : "#f9fafb", border: `1px solid ${full ? "#fca5a5" : "#e5e7eb"}`, borderRadius: 8, padding: "0.75rem 1rem", minWidth: 120 }}>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>{label}</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: full ? "#dc2626" : "#111827" }}>{count}<span style={{ fontSize: "0.875rem", fontWeight: 400, color: "#6b7280" }}>/{limit}</span></div>
              {full && <div style={{ fontSize: "0.7rem", color: "#dc2626", marginTop: "0.25rem" }}>Límite alcanzado</div>}
            </div>
          );
        })}
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "0.75rem 1rem", minWidth: 120 }}>
          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>Pacientes</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{countByRole("patient")}<span style={{ fontSize: "0.875rem", fontWeight: 400, color: "#6b7280" }}>/{orgLimits.maxPatients}</span></div>
        </div>
      </div>

      {error && <div style={{ background: "#fee2e2", color: "#991b1b", padding: "0.75rem 1rem", borderRadius: 6, marginBottom: "1rem" }}>{error}</div>}
      {success && <div style={{ background: "#d1fae5", color: "#065f46", padding: "0.75rem 1rem", borderRadius: 6, marginBottom: "1rem" }}>{success}</div>}

      {inviteLink && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          <p style={{ fontWeight: 600, marginBottom: "0.25rem", fontSize: "0.875rem" }}>Link de invitación (comparte con el usuario):</p>
          <code style={{ fontSize: "0.75rem", wordBreak: "break-all", color: "#1e40af" }}>{inviteLink}</code>
          <button onClick={() => navigator.clipboard.writeText(inviteLink)}
            style={{ marginLeft: "0.5rem", background: "#2563eb", color: "#fff", border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: "0.75rem" }}>
            Copiar
          </button>
        </div>
      )}

      {/* Formulario principal */}
      {showForm && (
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ fontWeight: 700, fontSize: "1rem", margin: 0 }}>Agregar usuario</h3>
            <button type="button" onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "#6b7280" }}>✕</button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.75rem" }}>
            <button type="button" onClick={() => setFormMode("create")}
              style={{ padding: "0.4rem 1rem", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem", background: formMode === "create" ? "#2563eb" : "#f3f4f6", color: formMode === "create" ? "#fff" : "#374151" }}>
              👤 Crear directamente
            </button>
            <button type="button" onClick={() => setFormMode("invite")}
              style={{ padding: "0.4rem 1rem", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem", background: formMode === "invite" ? "#2563eb" : "#f3f4f6", color: formMode === "invite" ? "#fff" : "#374151" }}>
              ✉️ Invitar por email
            </button>
          </div>

          {/* Modo: Crear directamente */}
          {formMode === "create" && (
            <form onSubmit={handleCreate}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={lbl}>Nombre completo *</label>
                  <input required style={inp} value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Dr. Juan Pérez" />
                </div>
                <div>
                  <label style={lbl}>Email *</label>
                  <input required type="email" style={inp} value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="doctor@clinica.com" />
                </div>
                <div>
                  <label style={lbl}>Teléfono</label>
                  <input type="tel" style={inp} value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} placeholder="+57 300 000 0000" />
                </div>
                <div>
                  <label style={lbl}>Rol *</label>
                  <select required style={inp} value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="doctor">Doctor</option>
                    <option value="assistant">Asistente</option>
                    <option value="admin">Admin</option>
                    <option value="patient">Paciente</option>
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={lbl}>Dirección</label>
                  <input style={inp} value={createForm.address} onChange={e => setCreateForm(f => ({ ...f, address: e.target.value }))} placeholder="Calle 10 # 5-20, Ciudad" />
                </div>
                <div>
                  <label style={lbl}>Contraseña * (mín. 8 caracteres)</label>
                  <input required type="password" style={inp} value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
                </div>
                <div>
                  <label style={lbl}>Confirmar contraseña *</label>
                  <input required type="password" style={inp} value={createForm.confirm} onChange={e => setCreateForm(f => ({ ...f, confirm: e.target.value }))} placeholder="••••••••" />
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={submitting}
                  style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1.25rem", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>
                  {submitting ? "Creando..." : "Crear usuario"}
                </button>
              </div>
            </form>
          )}

          {/* Modo: Invitar por email */}
          {formMode === "invite" && (
            <form onSubmit={handleInvite}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={lbl}>Email *</label>
                  <input required type="email" style={inp} value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="doctor@clinica.com" />
                </div>
                <div>
                  <label style={lbl}>Rol *</label>
                  <select style={inp} value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="doctor">Doctor</option>
                    <option value="assistant">Asistente</option>
                    <option value="admin">Admin</option>
                    <option value="patient">Paciente</option>
                  </select>
                </div>
              </div>
              <p style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.75rem" }}>
                📧 Se enviará un email con el link de invitación. El usuario completará su nombre, teléfono y dirección al aceptar.
              </p>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={submitting}
                  style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1.25rem", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>
                  {submitting ? "Enviando..." : "Enviar invitación"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Modal confirmar eliminación */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "1.5rem", minWidth: 320, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#dc2626" }}>⚠️ Eliminar usuario</h3>
            <p style={{ color: "#374151", marginBottom: "1rem", fontSize: "0.9rem" }}>
              ¿Estás seguro de eliminar a <strong>{confirmDelete.name || confirmDelete.email}</strong>? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={saving}
                style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 600 }}>
                {saving ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar info (nombre, teléfono, dirección) */}
      {editInfoUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <form onSubmit={handleSaveInfo} style={{ background: "#fff", borderRadius: 12, padding: "1.5rem", minWidth: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ fontWeight: 700, marginBottom: "1rem" }}>Editar — {editInfoUser.name || editInfoUser.email}</h3>
            <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
              <div>
                <label style={lbl}>Nombre completo</label>
                <input style={inp} value={editInfo.name} onChange={e => setEditInfo(f => ({ ...f, name: e.target.value }))} placeholder="Nombre" />
              </div>
              <div>
                <label style={lbl}>Teléfono</label>
                <input type="tel" style={inp} value={editInfo.phone} onChange={e => setEditInfo(f => ({ ...f, phone: e.target.value }))} placeholder="+57 300 000 0000" />
              </div>
              <div>
                <label style={lbl}>Dirección</label>
                <input style={inp} value={editInfo.address} onChange={e => setEditInfo(f => ({ ...f, address: e.target.value }))} placeholder="Calle 10 # 5-20" />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setEditInfoUser(null)}
                style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button type="submit" disabled={saving}
                style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 600 }}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal editar rol */}
      {editUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <form onSubmit={handleSaveRole} style={{ background: "#fff", borderRadius: 12, padding: "1.5rem", minWidth: 320, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>Cambiar rol — {editUser.name}</h3>
            <select value={editRole} onChange={e => setEditRole(e.target.value)}
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 6, marginBottom: "1rem" }}>
              <option value="doctor">Doctor</option>
              <option value="assistant">Asistente</option>
              <option value="admin">Admin</option>
              <option value="patient">Paciente</option>
            </select>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setEditUser(null)}
                style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button type="submit" disabled={saving}
                style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 600 }}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de miembros */}
      <h2 style={{ fontWeight: 700, marginBottom: "0.75rem", fontSize: "1rem" }}>Miembros ({users.length})</h2>
      {loading ? (
        <p style={{ color: "#6b7280" }}>Cargando...</p>
      ) : users.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No hay usuarios en esta organización aún.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {users.map(u => (
            <div key={u.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "0.875rem 1rem", opacity: u.status === "disabled" ? 0.6 : 1, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{u.name || <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Sin nombre</span>}</span>
                  {roleBadge(u.role)}
                  {statusBadge(u.status)}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#6b7280", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <span>✉️ {u.email}</span>
                  {u.phone && <span>📞 {u.phone}</span>}
                  {u.address && <span>📍 {u.address}</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={() => { setEditInfoUser(u); setEditInfo({ name: u.name || "", phone: u.phone || "", address: u.address || "" }); }}
                  style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}>
                  ✏️ Editar
                </button>
                <button onClick={() => { setEditUser(u); setEditRole(u.role); }}
                  style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}>
                  Rol
                </button>
                <button onClick={() => handleToggleStatus(u)} disabled={saving}
                  style={{ background: u.status === "active" ? "#fef2f2" : "#f0fdf4", color: u.status === "active" ? "#dc2626" : "#16a34a", border: `1px solid ${u.status === "active" ? "#fca5a5" : "#86efac"}`, borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}>
                  {u.status === "active" ? "Deshabilitar" : "Habilitar"}
                </button>
                <button onClick={() => setConfirmDelete(u)} disabled={saving}
                  style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}>
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

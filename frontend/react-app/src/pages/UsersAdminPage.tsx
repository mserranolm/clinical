import { useEffect, useState } from "react";
import { clinicalApi } from "../api/clinical";
import type { AuthSession } from "../types";

type OrgUser = { id: string; name: string; email: string; role: string; status: string; createdAt: string };

const ROLE_LABELS: Record<string, string> = { admin: "Admin", doctor: "Doctor", assistant: "Asistente", patient: "Paciente" };
const ROLE_LIMITS: Record<string, number> = { admin: 2, doctor: 5, assistant: 2 };

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

export function UsersAdminPage({ session }: { session: AuthSession }) {
  const orgId = session.orgId ?? "";
  const token = session.token;

  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "doctor" });
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const [editUser, setEditUser] = useState<OrgUser | null>(null);
  const [editRole, setEditRole] = useState("");
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

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError(""); setSuccess(""); setInviteLink("");
    try {
      const res = await clinicalApi.inviteUser(orgId, inviteForm, token);
      const base = window.location.origin;
      setInviteLink(`${base}/accept-invitation?token=${res.token}`);
      setSuccess(`Invitación creada para ${res.email} (${ROLE_LABELS[res.role] ?? res.role}). Expira: ${new Date(res.expiresAt).toLocaleString()}`);
      setInviteForm({ email: "", role: "doctor" });
      setShowInvite(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error enviando invitación");
    } finally {
      setInviting(false);
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

  if (!orgId) {
    return <div style={{ padding: "2rem" }}><p style={{ color: "#6b7280" }}>No hay organización asociada a tu cuenta.</p></div>;
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}>Usuarios y permisos</h1>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>Org: <code style={{ background: "#f3f4f6", padding: "1px 6px", borderRadius: 4 }}>{orgId}</code></p>
        </div>
        <button onClick={() => { setShowInvite(!showInvite); setInviteLink(""); }}
          style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 500 }}>
          + Invitar usuario
        </button>
      </div>

      {/* Contadores por rol */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {(["admin", "doctor", "assistant"] as const).map(role => {
          const count = countByRole(role);
          const limit = ROLE_LIMITS[role];
          const full = count >= limit;
          return (
            <div key={role} style={{ background: full ? "#fef2f2" : "#f9fafb", border: `1px solid ${full ? "#fca5a5" : "#e5e7eb"}`, borderRadius: 8, padding: "0.75rem 1rem", minWidth: 120 }}>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>{ROLE_LABELS[role]}</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: full ? "#dc2626" : "#111827" }}>{count}<span style={{ fontSize: "0.875rem", fontWeight: 400, color: "#6b7280" }}>/{limit}</span></div>
              {full && <div style={{ fontSize: "0.7rem", color: "#dc2626", marginTop: "0.25rem" }}>Límite alcanzado</div>}
            </div>
          );
        })}
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "0.75rem 1rem", minWidth: 120 }}>
          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>Pacientes</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{countByRole("patient")}<span style={{ fontSize: "0.875rem", fontWeight: 400, color: "#6b7280" }}>/∞</span></div>
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

      {showInvite && (
        <form onSubmit={handleInvite} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "1rem", marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>Invitar nuevo usuario</h3>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input required type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
              placeholder="Email del usuario" style={{ flex: 2, minWidth: 200, padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 6 }} />
            <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
              style={{ flex: 1, minWidth: 140, padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 6 }}>
              <option value="doctor">Doctor</option>
              <option value="assistant">Asistente</option>
              <option value="admin">Admin</option>
              <option value="patient">Paciente</option>
            </select>
            <button type="submit" disabled={inviting}
              style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer" }}>
              {inviting ? "Enviando..." : "Invitar"}
            </button>
          </div>
        </form>
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
                style={{ background: "#f3f4f6", border: "none", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer" }}>Cancelar</button>
              <button type="submit" disabled={saving}
                style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer" }}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}

      <h2 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Miembros ({users.length})</h2>
      {loading ? (
        <p style={{ color: "#6b7280" }}>Cargando...</p>
      ) : users.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No hay usuarios en esta organización aún.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "#f3f4f6" }}>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e5e7eb" }}>Nombre</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e5e7eb" }}>Email</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e5e7eb" }}>Rol</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e5e7eb" }}>Estado</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e5e7eb" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: "1px solid #f3f4f6", opacity: u.status === "disabled" ? 0.6 : 1 }}>
                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 500 }}>{u.name || "—"}</td>
                <td style={{ padding: "0.5rem 0.75rem", color: "#6b7280" }}>{u.email}</td>
                <td style={{ padding: "0.5rem 0.75rem" }}>{roleBadge(u.role)}</td>
                <td style={{ padding: "0.5rem 0.75rem" }}>{statusBadge(u.status)}</td>
                <td style={{ padding: "0.5rem 0.75rem" }}>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button onClick={() => { setEditUser(u); setEditRole(u.role); }}
                      style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: "0.75rem" }}>
                      Rol
                    </button>
                    <button onClick={() => handleToggleStatus(u)} disabled={saving}
                      style={{ background: u.status === "active" ? "#fef2f2" : "#f0fdf4", color: u.status === "active" ? "#dc2626" : "#16a34a", border: `1px solid ${u.status === "active" ? "#fca5a5" : "#86efac"}`, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: "0.75rem" }}>
                      {u.status === "active" ? "Deshabilitar" : "Habilitar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

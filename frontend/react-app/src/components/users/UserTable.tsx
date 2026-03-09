import { useState } from "react";
import { clinicalApi } from "../../api/clinical";
import type { AuthSession } from "../../types";
import { OrgUser, roleBadge, statusBadge, ROLE_LABELS } from "./UserBadges";
import { useThemeTokens } from "../../lib/use-is-dark";

interface UserTableProps {
  users: OrgUser[];
  session: AuthSession;
  onUpdate: () => void;
  onError: (error: string) => void;
  onSuccess: (message: string) => void;
}

export function UserTable({ users, session, onUpdate, onError, onSuccess }: UserTableProps) {
  const [editUser, setEditUser] = useState<OrgUser | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editInfoUser, setEditInfoUser] = useState<OrgUser | null>(null);
  const [editInfo, setEditInfo] = useState({ name: "", email: "", phone: "", address: "" });
  const [confirmDelete, setConfirmDelete] = useState<OrgUser | null>(null);
  const [saving, setSaving] = useState(false);

  const orgId = session.orgId ?? "";
  const token = session.token;
  const t = useThemeTokens();

  async function handleUpdateRole(userId: string) {
    if (!editRole) return;
    setSaving(true);
    try {
      await clinicalApi.updateOrgUser(orgId, userId, { role: editRole }, token);
      onSuccess("Rol actualizado correctamente");
      setEditUser(null);
      setEditRole("");
      onUpdate();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Error actualizando rol");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateInfo() {
    if (!editInfoUser) return;
    setSaving(true);
    try {
      await clinicalApi.updateOrgUser(orgId, editInfoUser.id, {
        name: editInfo.name,
        email: editInfo.email,
        phone: editInfo.phone,
        address: editInfo.address,
      }, token);
      onSuccess("Información actualizada correctamente");
      setEditInfoUser(null);
      setEditInfo({ name: "", email: "", phone: "", address: "" });
      onUpdate();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Error actualizando información");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setSaving(true);
    try {
      await clinicalApi.deleteOrgUser(orgId, confirmDelete.id, token);
      onSuccess("Usuario eliminado correctamente");
      setConfirmDelete(null);
      onUpdate();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Error eliminando usuario");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: t.surface, borderRadius: 12, overflow: "hidden", border: `1px solid ${t.border}`, boxShadow: t.isDark ? "none" : "0 1px 3px rgba(0,0,0,0.1)" }}>
      <div style={{ padding: "1rem 1.5rem", borderBottom: `1px solid ${t.border}` }}>
        <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: t.text }}>
          Usuarios ({users.length})
        </h3>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: t.surface2 }}>
            <tr>
              {["Usuario","Contacto","Rol","Estado","Creado","Acciones"].map(h => (
                <th key={h} style={{ padding: "0.75rem 1rem", textAlign: h === "Acciones" ? "center" : "left", fontSize: "0.75rem", fontWeight: 600, color: t.textSub, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}
                style={{ borderBottom: `1px solid ${t.borderFaint}` }}
                onMouseEnter={e => (e.currentTarget.style.background = t.surfaceHover)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "1rem" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: t.text }}>{user.name}</div>
                    <div style={{ fontSize: "0.875rem", color: t.textSub }}>{user.id}</div>
                  </div>
                </td>
                <td style={{ padding: "1rem" }}>
                  <div style={{ fontSize: "0.875rem" }}>
                    <div style={{ color: t.text }}>{user.email}</div>
                    {user.phone && <div style={{ color: t.textSub }}>{user.phone}</div>}
                    {user.address && <div style={{ color: t.textMuted, fontSize: "0.75rem" }}>{user.address}</div>}
                  </div>
                </td>
                <td style={{ padding: "1rem" }}>
                  {editUser?.id === user.id ? (
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        style={{ padding: "0.25rem 0.5rem", border: `1px solid ${t.border}`, borderRadius: 4, fontSize: "0.875rem", background: t.surface, color: t.text }}
                      >
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <button onClick={() => handleUpdateRole(user.id)} disabled={saving}
                        style={{ padding: "0.25rem 0.5rem", background: "#10b981", color: "#fff", border: "none", borderRadius: 4, fontSize: "0.75rem", cursor: "pointer" }}>✓</button>
                      <button onClick={() => { setEditUser(null); setEditRole(""); }}
                        style={{ padding: "0.25rem 0.5rem", background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, fontSize: "0.75rem", cursor: "pointer" }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {roleBadge(user.role)}
                      <button onClick={() => { setEditUser(user); setEditRole(user.role); }}
                        style={{ padding: "0.25rem", background: "none", border: "none", color: t.textSub, cursor: "pointer", fontSize: "0.75rem" }}>✏️</button>
                    </div>
                  )}
                </td>
                <td style={{ padding: "1rem" }}>{statusBadge(user.status)}</td>
                <td style={{ padding: "1rem", fontSize: "0.875rem", color: t.textSub }}>
                  {new Date(user.createdAt).toLocaleDateString("es-ES")}
                </td>
                <td style={{ padding: "1rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                    <button onClick={() => { setEditInfoUser(user); setEditInfo({ name: user.name, email: user.email || "", phone: user.phone || "", address: user.address || "" }); }}
                      style={{ padding: "0.25rem 0.5rem", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 4, fontSize: "0.75rem", cursor: "pointer" }}>Editar</button>
                    <button onClick={() => setConfirmDelete(user)}
                      style={{ padding: "0.25rem 0.5rem", background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, fontSize: "0.75rem", cursor: "pointer" }}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit info modal */}
      {editInfoUser && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: t.surface, borderRadius: 12, padding: "1.5rem", width: "100%", maxWidth: 400, boxShadow: "0 20px 40px rgba(0,0,0,0.3)", border: `1px solid ${t.border}` }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.25rem", fontWeight: 700, color: t.text }}>Editar información</h3>
            <div style={{ display: "grid", gap: "1rem" }}>
              {[
                { label: "Nombre", key: "name" as const },
                { label: "Correo electrónico", key: "email" as const, type: "email" },
                { label: "Teléfono", key: "phone" as const },
                { label: "Dirección", key: "address" as const },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem", color: t.textSub }}>{label}</label>
                  <input type={type || "text"} value={editInfo[key]}
                    onChange={(e) => setEditInfo({ ...editInfo, [key]: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", border: `1px solid ${t.border}`, borderRadius: 6, background: t.surface2, color: t.text, boxSizing: "border-box" }} />
                </div>
              ))}
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button onClick={() => { setEditInfoUser(null); setEditInfo({ name: "", email: "", phone: "", address: "" }); }}
                  style={{ padding: "0.5rem 1rem", background: t.surface2, color: t.textSub, border: `1px solid ${t.border}`, borderRadius: 6, cursor: "pointer" }}>Cancelar</button>
                <button onClick={handleUpdateInfo} disabled={saving}
                  style={{ padding: "0.5rem 1rem", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: t.surface, borderRadius: 12, padding: "1.5rem", width: "100%", maxWidth: 400, boxShadow: "0 20px 40px rgba(0,0,0,0.3)", border: `1px solid ${t.border}` }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.25rem", fontWeight: 700, color: t.danger }}>Confirmar eliminación</h3>
            <p style={{ margin: "0 0 1.5rem 0", color: t.textSub }}>
              ¿Estás seguro de que deseas eliminar a <strong style={{ color: t.text }}>{confirmDelete.name}</strong>? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ padding: "0.5rem 1rem", background: t.surface2, color: t.textSub, border: `1px solid ${t.border}`, borderRadius: 6, cursor: "pointer" }}>Cancelar</button>
              <button onClick={handleDelete} disabled={saving}
                style={{ padding: "0.5rem 1rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                {saving ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

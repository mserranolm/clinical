import { useState } from "react";
import { clinicalApi } from "../../api/clinical";
import type { AuthSession } from "../../types";
import { OrgUser, roleBadge, statusBadge, ROLE_LABELS } from "./UserBadges";

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
    <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
      <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #e5e7eb" }}>
        <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "#111827" }}>
          Usuarios ({users.length})
        </h3>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f9fafb" }}>
            <tr>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Usuario</th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Contacto</th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Rol</th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Estado</th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Creado</th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "center", fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "1rem" }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "#111827" }}>{user.name}</div>
                    <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>{user.id}</div>
                  </div>
                </td>
                <td style={{ padding: "1rem" }}>
                  <div style={{ fontSize: "0.875rem" }}>
                    <div style={{ color: "#111827" }}>{user.email}</div>
                    {user.phone && <div style={{ color: "#6b7280" }}>{user.phone}</div>}
                    {user.address && <div style={{ color: "#6b7280", fontSize: "0.75rem" }}>{user.address}</div>}
                  </div>
                </td>
                <td style={{ padding: "1rem" }}>
                  {editUser?.id === user.id ? (
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        style={{ padding: "0.25rem 0.5rem", border: "1px solid #d1d5db", borderRadius: 4, fontSize: "0.875rem" }}
                      >
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleUpdateRole(user.id)}
                        disabled={saving}
                        style={{ padding: "0.25rem 0.5rem", background: "#10b981", color: "#fff", border: "none", borderRadius: 4, fontSize: "0.75rem", cursor: "pointer" }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => { setEditUser(null); setEditRole(""); }}
                        style={{ padding: "0.25rem 0.5rem", background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, fontSize: "0.75rem", cursor: "pointer" }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {roleBadge(user.role)}
                      <button
                        onClick={() => { setEditUser(user); setEditRole(user.role); }}
                        style={{ padding: "0.25rem", background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "0.75rem" }}
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                </td>
                <td style={{ padding: "1rem" }}>
                  {statusBadge(user.status)}
                </td>
                <td style={{ padding: "1rem", fontSize: "0.875rem", color: "#6b7280" }}>
                  {new Date(user.createdAt).toLocaleDateString("es-ES")}
                </td>
                <td style={{ padding: "1rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                    <button
                      onClick={() => { setEditInfoUser(user); setEditInfo({ name: user.name, email: user.email || "", phone: user.phone || "", address: user.address || "" }); }}
                      style={{ padding: "0.25rem 0.5rem", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 4, fontSize: "0.75rem", cursor: "pointer" }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setConfirmDelete(user)}
                      style={{ padding: "0.25rem 0.5rem", background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, fontSize: "0.75rem", cursor: "pointer" }}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editInfoUser && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "#fff", borderRadius: 12, padding: "1.5rem", width: "100%", maxWidth: 400,
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)"
          }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.25rem", fontWeight: 700 }}>Editar información</h3>
            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>Nombre</label>
                <input
                  value={editInfo.name}
                  onChange={(e) => setEditInfo({ ...editInfo, name: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #d1d5db", borderRadius: 6 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>Correo electrónico</label>
                <input
                  type="email"
                  value={editInfo.email}
                  onChange={(e) => setEditInfo({ ...editInfo, email: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #d1d5db", borderRadius: 6 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>Teléfono</label>
                <input
                  value={editInfo.phone}
                  onChange={(e) => setEditInfo({ ...editInfo, phone: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #d1d5db", borderRadius: 6 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>Dirección</label>
                <input
                  value={editInfo.address}
                  onChange={(e) => setEditInfo({ ...editInfo, address: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", border: "1px solid #d1d5db", borderRadius: 6 }}
                />
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button
                  onClick={() => { setEditInfoUser(null); setEditInfo({ name: "", email: "", phone: "", address: "" }); }}
                  style={{ padding: "0.5rem 1rem", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateInfo}
                  disabled={saving}
                  style={{ padding: "0.5rem 1rem", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "#fff", borderRadius: 12, padding: "1.5rem", width: "100%", maxWidth: 400,
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)"
          }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.25rem", fontWeight: 700, color: "#dc2626" }}>
              Confirmar eliminación
            </h3>
            <p style={{ margin: "0 0 1.5rem 0", color: "#6b7280" }}>
              ¿Estás seguro de que deseas eliminar a <strong>{confirmDelete.name}</strong>? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ padding: "0.5rem 1rem", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                style={{ padding: "0.5rem 1rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
              >
                {saving ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

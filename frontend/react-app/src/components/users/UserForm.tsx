import { useState } from "react";
import { clinicalApi } from "../../api/clinical";
import type { AuthSession } from "../../types";
import { ROLE_LABELS } from "./UserBadges";

const inp: React.CSSProperties = { 
  width: "100%", 
  padding: "0.5rem 0.75rem", 
  border: "1px solid #d1d5db", 
  borderRadius: 6, 
  boxSizing: "border-box", 
  fontSize: "0.875rem" 
};

const lbl: React.CSSProperties = { 
  display: "block", 
  fontSize: "0.75rem", 
  fontWeight: 600, 
  color: "#374151", 
  marginBottom: 4 
};

const EMPTY_CREATE = { name: "", email: "", phone: "", address: "", role: "doctor" };
const EMPTY_INVITE = { email: "", role: "doctor" };

interface UserFormProps {
  session: AuthSession;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

export function UserForm({ session, onClose, onSuccess, onError }: UserFormProps) {
  const [formMode, setFormMode] = useState<"create" | "invite">("create");
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE);
  const [submitting, setSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const orgId = session.orgId ?? "";
  const token = session.token;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    onError("");
    try {
      await clinicalApi.createOrgUser(orgId, {
        name: createForm.name,
        email: createForm.email,
        phone: createForm.phone,
        address: createForm.address,
        role: createForm.role,
      }, token);
      onSuccess(`Usuario ${createForm.name} creado. Se envió un correo con la contraseña temporal.`);
      setCreateForm(EMPTY_CREATE);
      onClose();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Error creando usuario");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    onError("");
    try {
      const result = await clinicalApi.inviteUser(orgId, {
        email: inviteForm.email,
        role: inviteForm.role,
      }, token);
      setInviteLink(`${window.location.origin}/accept-invitation?token=${result.token}`);
      onSuccess(`Invitación enviada a ${inviteForm.email}`);
      setInviteForm(EMPTY_INVITE);
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Error creando invitación");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, width: "100%", maxWidth: 500,
        maxHeight: "90vh", overflowY: "auto", margin: 20,
        boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)"
      }}>
        <div style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>
              {formMode === "create" ? "Crear Usuario" : "Invitar Usuario"}
            </h2>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#6b7280" }}>
              ×
            </button>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <button
              onClick={() => setFormMode("create")}
              style={{
                flex: 1,
                padding: "0.5rem",
                border: formMode === "create" ? "1px solid #2563eb" : "1px solid #d1d5db",
                background: formMode === "create" ? "#2563eb" : "#fff",
                color: formMode === "create" ? "#fff" : "#374151",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500
              }}
            >
              Crear directamente
            </button>
            <button
              onClick={() => setFormMode("invite")}
              style={{
                flex: 1,
                padding: "0.5rem",
                border: formMode === "invite" ? "1px solid #2563eb" : "1px solid #d1d5db",
                background: formMode === "invite" ? "#2563eb" : "#fff",
                color: formMode === "invite" ? "#fff" : "#374151",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500
              }}
            >
              Enviar invitación
            </button>
          </div>

          {formMode === "create" ? (
            <form onSubmit={handleCreate} style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={lbl}>Nombre completo *</label>
                <input required style={inp} value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Dr. Juan Pérez" />
              </div>
              <div>
                <label style={lbl}>Email *</label>
                <input required type="email" style={inp} value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="doctor@clinisense.com" />
              </div>
              <div>
                <label style={lbl}>Teléfono</label>
                <input style={inp} value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} placeholder="+57 300 123 4567" />
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
              <div>
                <label style={lbl}>Dirección</label>
                <input style={inp} value={createForm.address} onChange={e => setCreateForm(f => ({ ...f, address: e.target.value }))} placeholder="Calle 10 # 5-20, Ciudad" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#6b7280", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "0.5rem 0.75rem" }}>
                  🔐 Se generará una contraseña temporal automáticamente y se enviará por correo. El usuario deberá cambiarla en su primer inicio de sesión.
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={onClose} style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1.25rem", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>
                  {submitting ? "Creando..." : "Crear usuario"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleInvite} style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={lbl}>Email *</label>
                <input required type="email" style={inp} value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="doctor@clinisense.com" />
              </div>
              <div>
                <label style={lbl}>Rol *</label>
                <select required style={inp} value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={onClose} style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1.25rem", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>
                  {submitting ? "Enviando..." : "Enviar invitación"}
                </button>
              </div>
            </form>
          )}

          {inviteLink && (
            <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#f0f9ff", border: "1px solid #0ea5e9", borderRadius: 6 }}>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#0c4a6e", fontWeight: 600 }}>Enlace de invitación:</p>
              <input
                type="text"
                readOnly
                value={inviteLink}
                style={{ width: "100%", marginTop: "0.5rem", padding: "0.5rem", border: "1px solid #0ea5e9", borderRadius: 4, fontSize: "0.875rem", background: "#fff" }}
                onClick={(e) => e.currentTarget.select()}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { clinicalApi } from "../../api/clinical";
import { notify } from "../../lib/notify";
import type { AuthSession } from "../../types";

type OrgLimits = { maxDoctors: number; maxAssistants: number; maxPatients: number };
type Org = {
  id: string;
  name: string;
  businessName: string;
  taxId: string;
  address: string;
  email: string;
  phone: string;
  status: string;
  paymentStatus: string;
  limits: OrgLimits;
  createdAt: string;
};

const EMPTY_ORG_FORM = {
  name: "", businessName: "", taxId: "", address: "", email: "", phone: "",
  status: "active", paymentStatus: "current",
  maxDoctors: 5, maxAssistants: 2, maxPatients: 20,
};

type OrgForm = typeof EMPTY_ORG_FORM;

const STATUS_LABELS: Record<string, string> = { active: "Activa", inactive: "Inactiva" };
const PAYMENT_LABELS: Record<string, string> = { current: "Al día", overdue: "Vencido", suspended: "Suspendido" };
const STATUS_COLORS: Record<string, string> = { active: "#d1fae5", inactive: "#fee2e2" };
const PAYMENT_COLORS: Record<string, string> = { current: "#d1fae5", overdue: "#fef3c7", suspended: "#fee2e2" };
const STATUS_TEXT: Record<string, string> = { active: "#065f46", inactive: "#991b1b" };
const PAYMENT_TEXT: Record<string, string> = { current: "#065f46", overdue: "#92400e", suspended: "#991b1b" };

export function AdminConsoleHome({ session }: { session: AuthSession }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Org | null>(null);
  const [form, setForm] = useState<OrgForm>(EMPTY_ORG_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState({ orgId: "", name: "", email: "", password: "" });
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  const token = session.token;

  async function loadOrgs() {
    setLoading(true);
    try {
      const res = await clinicalApi.listOrgs(token);
      setOrgs(res.items ?? []);
    } catch (e) {
      notify.error("Error cargando organizaciones", e instanceof Error ? e.message : "");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOrgs(); }, []);

  function openCreate() {
    setEditingOrg(null);
    setForm(EMPTY_ORG_FORM);
    setShowForm(true);
  }

  function openEdit(org: Org) {
    setEditingOrg(org);
    setForm({
      name: org.name,
      businessName: org.businessName || "",
      taxId: org.taxId || "",
      address: org.address || "",
      email: org.email || "",
      phone: org.phone || "",
      status: org.status || "active",
      paymentStatus: org.paymentStatus || "current",
      maxDoctors: org.limits?.maxDoctors ?? 5,
      maxAssistants: org.limits?.maxAssistants ?? 2,
      maxPatients: org.limits?.maxPatients ?? 20,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      name: form.name,
      businessName: form.businessName,
      taxId: form.taxId,
      address: form.address,
      email: form.email,
      phone: form.phone,
      status: form.status,
      paymentStatus: form.paymentStatus,
      maxDoctors: Number(form.maxDoctors),
      maxAssistants: Number(form.maxAssistants),
      maxPatients: Number(form.maxPatients),
    };

    const finalPromise = editingOrg
      ? clinicalApi.updateOrg(editingOrg.id, payload, token)
      : clinicalApi.createOrg(payload, token);

    notify.promise(finalPromise, {
      loading: editingOrg ? "Actualizando organización..." : "Creando organización...",
      success: () => {
        loadOrgs();
        setShowForm(false);
        setEditingOrg(null);
        return editingOrg ? "Organización actualizada" : "Organización creada";
      },
      error: editingOrg ? "Error al actualizar" : "Error al crear",
    }).finally(() => setSubmitting(false));
  }

  function handleDelete(org: Org) {
    if (!window.confirm(`¿Eliminar la organización "${org.name}"? Esta acción no se puede deshacer.`)) return;
    const promise = clinicalApi.deleteOrg(org.id, token);
    notify.promise(promise, {
      loading: "Eliminando organización...",
      success: () => { loadOrgs(); return "Organización eliminada"; },
      error: "Error al eliminar",
    });
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    setAdminSubmitting(true);
    const promise = clinicalApi.createOrgAdmin(adminForm.orgId, {
      name: adminForm.name, email: adminForm.email, password: adminForm.password,
    }, token);
    notify.promise(promise, {
      loading: "Creando admin...",
      success: () => {
        setAdminForm({ orgId: "", name: "", email: "", password: "" });
        setShowAdminForm(false);
        return "Admin creado";
      },
      error: "Error al crear admin",
    }).finally(() => setAdminSubmitting(false));
  }

  const inp: React.CSSProperties = { padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 6, width: "100%", fontSize: "0.875rem" };
  const label: React.CSSProperties = { display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: 4 };

  return (
    <div style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}>Consola de Plataforma</h1>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            {session.email} · <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 4, fontSize: "0.75rem" }}>platform_admin</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button onClick={openCreate}
            style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 600 }}>
            + Nueva organización
          </button>
          <button onClick={() => { setShowAdminForm(!showAdminForm); setShowForm(false); }}
            style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 600 }}>
            + Crear admin de org
          </button>
        </div>
      </div>

      {/* Form crear/editar org */}
      {showForm && (
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "1.5rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ fontWeight: 700, fontSize: "1rem" }}>{editingOrg ? `Editar: ${editingOrg.name}` : "Nueva organización"}</h3>
            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", color: "#6b7280" }}>✕</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={label}>Nombre de la clínica *</label>
                <input required style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Clínica San José" />
              </div>
              <div>
                <label style={label}>Razón social</label>
                <input style={inp} value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} placeholder="Clínica San José S.A.S." />
              </div>
              <div>
                <label style={label}>NIT / RUC / Tax ID</label>
                <input style={inp} value={form.taxId} onChange={e => setForm(f => ({ ...f, taxId: e.target.value }))} placeholder="900.123.456-7" />
              </div>
              <div>
                <label style={label}>Teléfono</label>
                <input style={inp} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+57 300 000 0000" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={label}>Dirección</label>
                <input style={inp} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Calle 10 # 5-20, Bogotá" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={label}>Email de contacto</label>
                <input type="email" style={inp} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contacto@clinica.com" />
              </div>
            </div>

            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "1rem", marginBottom: "1rem" }}>
              <p style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.75rem", color: "#374151" }}>Estado y pago</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={label}>Estado de la organización</label>
                  <select style={inp} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="active">Activa</option>
                    <option value="inactive">Inactiva</option>
                  </select>
                </div>
                <div>
                  <label style={label}>Estado de pago</label>
                  <select style={inp} value={form.paymentStatus} onChange={e => setForm(f => ({ ...f, paymentStatus: e.target.value }))}>
                    <option value="current">Al día</option>
                    <option value="overdue">Vencido</option>
                    <option value="suspended">Suspendido</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "1rem", marginBottom: "1rem" }}>
              <p style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.75rem", color: "#374151" }}>Límites de usuarios</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={label}>Máx. Doctores</label>
                  <input type="number" min={1} style={inp} value={form.maxDoctors} onChange={e => setForm(f => ({ ...f, maxDoctors: Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={label}>Máx. Asistentes</label>
                  <input type="number" min={1} style={inp} value={form.maxAssistants} onChange={e => setForm(f => ({ ...f, maxAssistants: Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={label}>Máx. Pacientes</label>
                  <input type="number" min={1} style={inp} value={form.maxPatients} onChange={e => setForm(f => ({ ...f, maxPatients: Number(e.target.value) }))} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer" }}>
                Cancelar
              </button>
              <button type="submit" disabled={submitting}
                style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1.25rem", cursor: "pointer", fontWeight: 600 }}>
                {submitting ? "Guardando..." : (editingOrg ? "Guardar cambios" : "Crear organización")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Form crear admin */}
      {showAdminForm && (
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "1.5rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ fontWeight: 700, fontSize: "1rem" }}>Crear admin de organización</h3>
            <button onClick={() => setShowAdminForm(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", color: "#6b7280" }}>✕</button>
          </div>
          <form onSubmit={handleCreateAdmin}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={label}>Organización</label>
                <select required style={inp} value={adminForm.orgId} onChange={e => setAdminForm(f => ({ ...f, orgId: e.target.value }))}>
                  <option value="">Seleccionar organización...</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name} ({o.id})</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Nombre completo</label>
                <input required style={inp} value={adminForm.name} onChange={e => setAdminForm(f => ({ ...f, name: e.target.value }))} placeholder="Dr. Juan Pérez" />
              </div>
              <div>
                <label style={label}>Email</label>
                <input required type="email" style={inp} value={adminForm.email} onChange={e => setAdminForm(f => ({ ...f, email: e.target.value }))} placeholder="admin@clinica.com" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={label}>Contraseña (mín. 8 caracteres)</label>
                <input required type="password" style={inp} value={adminForm.password} onChange={e => setAdminForm(f => ({ ...f, password: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowAdminForm(false)}
                style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer" }}>
                Cancelar
              </button>
              <button type="submit" disabled={adminSubmitting}
                style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1.25rem", cursor: "pointer", fontWeight: 600 }}>
                {adminSubmitting ? "Creando..." : "Crear admin"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla de organizaciones */}
      <h2 style={{ fontWeight: 700, marginBottom: "0.75rem", fontSize: "1rem" }}>
        Organizaciones ({orgs.length})
      </h2>
      {loading ? (
        <p style={{ color: "#6b7280" }}>Cargando...</p>
      ) : orgs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280", background: "#f9fafb", borderRadius: 10, border: "1px dashed #d1d5db" }}>
          <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🏥</p>
          <p>No hay organizaciones aún. Crea la primera.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {orgs.map(org => (
            <div key={org.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
                    <strong style={{ fontSize: "1rem" }}>{org.name}</strong>
                    <span style={{ background: STATUS_COLORS[org.status] || "#f3f4f6", color: STATUS_TEXT[org.status] || "#374151", padding: "2px 8px", borderRadius: 4, fontSize: "0.7rem", fontWeight: 700 }}>
                      {STATUS_LABELS[org.status] || org.status}
                    </span>
                    <span style={{ background: PAYMENT_COLORS[org.paymentStatus] || "#f3f4f6", color: PAYMENT_TEXT[org.paymentStatus] || "#374151", padding: "2px 8px", borderRadius: 4, fontSize: "0.7rem", fontWeight: 700 }}>
                      💳 {PAYMENT_LABELS[org.paymentStatus] || org.paymentStatus}
                    </span>
                  </div>
                  {org.businessName && <p style={{ color: "#6b7280", fontSize: "0.8rem", margin: "0 0 0.25rem" }}>{org.businessName}{org.taxId ? ` · ${org.taxId}` : ""}</p>}
                  <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.8rem", color: "#6b7280" }}>
                    {org.address && <span>📍 {org.address}</span>}
                    {org.email && <span>✉️ {org.email}</span>}
                    {org.phone && <span>📞 {org.phone}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.75rem", textAlign: "center" }}>
                    <div style={{ fontWeight: 700, color: "#0369a1" }}>{org.limits?.maxDoctors ?? 5}</div>
                    <div style={{ color: "#6b7280" }}>Doctores</div>
                  </div>
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.75rem", textAlign: "center" }}>
                    <div style={{ fontWeight: 700, color: "#15803d" }}>{org.limits?.maxAssistants ?? 2}</div>
                    <div style={{ color: "#6b7280" }}>Asistentes</div>
                  </div>
                  <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.75rem", textAlign: "center" }}>
                    <div style={{ fontWeight: 700, color: "#a16207" }}>{org.limits?.maxPatients ?? 20}</div>
                    <div style={{ color: "#6b7280" }}>Pacientes</div>
                  </div>
                  <button onClick={() => openEdit(org)}
                    style={{ background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 6, padding: "0.4rem 0.75rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>
                    ✏️ Editar
                  </button>
                  <button onClick={() => handleDelete(org)}
                    style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "0.4rem 0.75rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, color: "#991b1b" }}>
                    🗑️ Eliminar
                  </button>
                </div>
              </div>
              <div style={{ marginTop: "0.5rem", fontSize: "0.7rem", color: "#9ca3af", fontFamily: "monospace" }}>
                ID: {org.id} · Creada: {new Date(org.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

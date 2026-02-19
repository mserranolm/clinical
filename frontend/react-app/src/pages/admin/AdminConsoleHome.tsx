import { useEffect, useState } from "react";
import { clinicalApi } from "../../api/clinical";
import type { AuthSession } from "../../types";

type Org = { id: string; name: string; createdAt: string };

type NewOrgForm = { name: string };
type NewAdminForm = { orgId: string; name: string; email: string; password: string };

export function AdminConsoleHome({ session }: { session: AuthSession }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showOrgForm, setShowOrgForm] = useState(false);
  const [orgForm, setOrgForm] = useState<NewOrgForm>({ name: "" });
  const [orgSubmitting, setOrgSubmitting] = useState(false);

  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState<NewAdminForm>({ orgId: "", name: "", email: "", password: "" });
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  const token = session.token;

  async function loadOrgs() {
    setLoading(true);
    setError("");
    try {
      const res = await clinicalApi.listOrgs(token);
      setOrgs(res.items ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando organizaciones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOrgs(); }, []);

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    setOrgSubmitting(true);
    setError(""); setSuccess("");
    try {
      await clinicalApi.createOrg(orgForm.name, token);
      setSuccess("Organización creada");
      setOrgForm({ name: "" });
      setShowOrgForm(false);
      loadOrgs();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error creando organización");
    } finally {
      setOrgSubmitting(false);
    }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    setAdminSubmitting(true);
    setError(""); setSuccess("");
    try {
      await clinicalApi.createOrgAdmin(adminForm.orgId, {
        name: adminForm.name,
        email: adminForm.email,
        password: adminForm.password,
      }, token);
      setSuccess(`Admin creado para org ${adminForm.orgId}`);
      setAdminForm({ orgId: "", name: "", email: "", password: "" });
      setShowAdminForm(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error creando admin");
    } finally {
      setAdminSubmitting(false);
    }
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}>Consola de Plataforma</h1>
      <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
        {session.email} · <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 4, fontSize: "0.75rem" }}>platform_admin</span>
      </p>

      {error && <div style={{ background: "#fee2e2", color: "#991b1b", padding: "0.75rem 1rem", borderRadius: 6, marginBottom: "1rem" }}>{error}</div>}
      {success && <div style={{ background: "#d1fae5", color: "#065f46", padding: "0.75rem 1rem", borderRadius: 6, marginBottom: "1rem" }}>{success}</div>}

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <button onClick={() => { setShowOrgForm(!showOrgForm); setShowAdminForm(false); }}
          style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer" }}>
          + Nueva organización
        </button>
        <button onClick={() => { setShowAdminForm(!showAdminForm); setShowOrgForm(false); }}
          style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer" }}>
          + Crear admin de org
        </button>
      </div>

      {showOrgForm && (
        <form onSubmit={handleCreateOrg} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "1rem", marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>Nueva organización</h3>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              required value={orgForm.name} onChange={e => setOrgForm({ name: e.target.value })}
              placeholder="Nombre de la clínica"
              style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 6 }}
            />
            <button type="submit" disabled={orgSubmitting}
              style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer" }}>
              {orgSubmitting ? "Creando..." : "Crear"}
            </button>
          </div>
        </form>
      )}

      {showAdminForm && (
        <form onSubmit={handleCreateAdmin} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "1rem", marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>Crear admin de organización</h3>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <select required value={adminForm.orgId} onChange={e => setAdminForm(f => ({ ...f, orgId: e.target.value }))}
              style={{ padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 6 }}>
              <option value="">Seleccionar organización...</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name} ({o.id})</option>)}
            </select>
            <input required value={adminForm.name} onChange={e => setAdminForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nombre completo" style={{ padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 6 }} />
            <input required type="email" value={adminForm.email} onChange={e => setAdminForm(f => ({ ...f, email: e.target.value }))}
              placeholder="Email" style={{ padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 6 }} />
            <input required type="password" value={adminForm.password} onChange={e => setAdminForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Contraseña (mín. 8 caracteres)" style={{ padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 6 }} />
            <button type="submit" disabled={adminSubmitting}
              style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer" }}>
              {adminSubmitting ? "Creando..." : "Crear admin"}
            </button>
          </div>
        </form>
      )}

      <h2 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Organizaciones ({orgs.length})</h2>
      {loading ? (
        <p style={{ color: "#6b7280" }}>Cargando...</p>
      ) : orgs.length === 0 ? (
        <p style={{ color: "#6b7280" }}>No hay organizaciones aún.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "#f3f4f6" }}>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e5e7eb" }}>Nombre</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e5e7eb" }}>ID</th>
              <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e5e7eb" }}>Creada</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map(org => (
              <tr key={org.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "0.5rem 0.75rem", fontWeight: 500 }}>{org.name}</td>
                <td style={{ padding: "0.5rem 0.75rem", color: "#6b7280", fontFamily: "monospace", fontSize: "0.75rem" }}>{org.id}</td>
                <td style={{ padding: "0.5rem 0.75rem", color: "#6b7280" }}>{new Date(org.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

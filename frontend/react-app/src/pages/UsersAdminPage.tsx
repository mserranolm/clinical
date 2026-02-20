import { useEffect, useState } from "react";
import { clinicalApi } from "../api/clinical";
import type { AuthSession } from "../types";
import { UserForm } from "../components/users/UserForm";
import { UserTable } from "../components/users/UserTable";
import { OrgUser, ROLE_LABELS } from "../components/users/UserBadges";

export function UsersAdminPage({ session }: { session: AuthSession }) {
  const orgId = session.orgId ?? "";
  const token = session.token;

  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);

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

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.875rem", fontWeight: 800, color: "#111827", margin: "0 0 0.5rem 0" }}>
          Gestión de Usuarios
        </h1>
        <p style={{ color: "#6b7280", margin: 0, fontSize: "1rem" }}>
          Administra los usuarios de tu organización y sus roles
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
        gap: "1rem", 
        marginBottom: "2rem" 
      }}>
        {Object.entries(ROLE_LABELS).map(([role, label]) => (
          <div key={role} style={{
            background: "#fff", padding: "1.5rem", borderRadius: 12, border: "1px solid #e5e7eb",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
          }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#111827" }}>
              {countByRole(role)}
            </div>
            <div style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.25rem" }}>
              {label}s
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827", margin: 0 }}>
            Lista de Usuarios
          </h2>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0 0", fontSize: "0.875rem" }}>
            Total: {users.length} usuarios
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            background: "#2563eb", color: "#fff", border: "none", borderRadius: 8,
            padding: "0.75rem 1.5rem", fontWeight: 600, cursor: "pointer",
            fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem"
          }}
        >
          + Nuevo Usuario
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8,
          padding: "1rem", marginBottom: "1rem", color: "#dc2626"
        }}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div style={{
          background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8,
          padding: "1rem", marginBottom: "1rem", color: "#166534"
        }}>
          ✅ {success}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          <div style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>Cargando usuarios...</div>
        </div>
      ) : (
        /* User Table */
        <UserTable
          users={users}
          session={session}
          onUpdate={loadUsers}
          onError={setError}
          onSuccess={setSuccess}
        />
      )}

      {/* User Form Modal */}
      {showForm && (
        <UserForm
          session={session}
          onClose={() => setShowForm(false)}
          onSuccess={(message) => {
            setSuccess(message);
            setShowForm(false);
            loadUsers();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}
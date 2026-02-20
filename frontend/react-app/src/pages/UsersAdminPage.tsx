import { useEffect, useState } from "react";
import { clinicalApi } from "../api/clinical";
import type { AuthSession } from "../types";
import { UserForm } from "../components/users/UserForm";
import { UserTable } from "../components/users/UserTable";
import { OrgUser } from "../components/users/UserBadges";

type OrgStats = {
  totalDoctors: number;
  totalAssistants: number;
  totalAdmins: number;
  totalUsers: number;
  totalPatients: number;
  maxDoctors: number;
  maxAssistants: number;
  maxPatients: number;
};

const STAT_CARDS = [
  { key: "totalAdmins",    label: "Admins",     max: "maxDoctors"    },
  { key: "totalDoctors",   label: "Doctores",   max: "maxDoctors"    },
  { key: "totalAssistants",label: "Asistentes", max: "maxAssistants" },
  { key: "totalPatients",  label: "Pacientes",  max: "maxPatients"   },
] as const;

export function UsersAdminPage({ session }: { session: AuthSession }) {
  const orgId = session.orgId ?? "";
  const token = session.token;

  const [users, setUsers]   = useState<OrgUser[]>([]);
  const [stats, setStats]   = useState<OrgStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function loadData() {
    if (!orgId) return;
    setLoading(true);
    setError("");
    try {
      const [usersRes, statsRes] = await Promise.all([
        clinicalApi.listOrgUsers(orgId, token),
        clinicalApi.getOrgStats(orgId, token),
      ]);
      setUsers(usersRes.items ?? []);
      setStats(statsRes);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [orgId]);

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

      {/* Stats Cards — datos reales del backend */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "1rem",
        marginBottom: "2rem"
      }}>
        {STAT_CARDS.map(({ key, label, max }) => {
          const value = stats ? stats[key] : 0;
          const maxVal = stats && key !== "totalAdmins" ? stats[max] : null;
          return (
            <div key={key} style={{
              background: "#fff", padding: "1.5rem", borderRadius: 12,
              border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
            }}>
              <div style={{ fontSize: "2rem", fontWeight: 700, color: "#111827" }}>
                {loading ? "—" : value}
              </div>
              <div style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.25rem" }}>
                {label}
              </div>
              {maxVal !== null && (
                <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                  Límite: {maxVal}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827", margin: 0 }}>
            Lista de Usuarios
          </h2>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0 0", fontSize: "0.875rem" }}>
            Total: {users.length} usuarios registrados
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            background: "#2563eb", color: "#fff", border: "none", borderRadius: 8,
            padding: "0.75rem 1.5rem", fontWeight: 600, cursor: "pointer",
            fontSize: "0.875rem"
          }}
        >
          + Nuevo Usuario
        </button>
      </div>

      {/* Mensajes */}
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

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          Cargando...
        </div>
      ) : (
        <UserTable
          users={users}
          session={session}
          onUpdate={loadData}
          onError={setError}
          onSuccess={setSuccess}
        />
      )}

      {showForm && (
        <UserForm
          session={session}
          onClose={() => setShowForm(false)}
          onSuccess={(message) => {
            setSuccess(message);
            setShowForm(false);
            loadData();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

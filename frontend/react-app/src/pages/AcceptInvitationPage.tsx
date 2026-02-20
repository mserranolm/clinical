import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { clinicalApi } from "../api/clinical";
import type { AuthSession } from "../types";

export function AcceptInvitationPage({ onSuccess }: { onSuccess: (session: AuthSession) => void }) {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", phone: "", address: "", password: "", confirm: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (form.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await clinicalApi.acceptInvitation(token, { name: form.name, phone: form.phone, address: form.address, password: form.password });
      onSuccess({
        token: res.accessToken,
        userId: res.userId,
        orgId: res.orgId,
        name: res.name,
        email: res.email,
        role: res.role,
      });
      navigate("/dashboard", { replace: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al aceptar invitación");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: "2rem", maxWidth: 400, width: "100%", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
          <p style={{ color: "#dc2626", fontWeight: 600 }}>Token de invitación no válido o faltante.</p>
          <button onClick={() => navigate("/login")} style={{ marginTop: "1rem", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1.5rem", cursor: "pointer" }}>
            Ir al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: "2rem", maxWidth: 420, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <span style={{ fontSize: "2rem" }}>🦷</span>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.5rem" }}>Activa tu cuenta</h1>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>Recibiste una contraseña temporal por email. Aquí debes crear tu contraseña definitiva.</p>
        </div>

        {error && (
          <div style={{ background: "#fee2e2", color: "#991b1b", padding: "0.75rem 1rem", borderRadius: 6, marginBottom: "1rem", fontSize: "0.875rem" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.75rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Nombre completo *</label>
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Tu nombre completo"
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Teléfono</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+57 300 000 0000"
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Dirección</label>
            <input
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Calle 10 # 5-20, Ciudad"
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Contraseña *</label>
            <input
              required
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Mínimo 8 caracteres"
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>Confirmar contraseña *</label>
            <input
              required
              type="password"
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              placeholder="Repite la contraseña"
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "0.625rem 1rem", cursor: "pointer", fontWeight: 600, marginTop: "0.25rem" }}
          >
            {submitting ? "Creando cuenta..." : "Crear cuenta y entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

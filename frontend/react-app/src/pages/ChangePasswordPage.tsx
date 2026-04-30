import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clinicalApi } from "../api/clinical";
import type { AuthSession } from "../types";
import { Lock } from "lucide-react";

export function ChangePasswordPage({
  session,
  onSuccess,
}: {
  session: AuthSession;
  onSuccess: (updated: AuthSession) => void;
}) {
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await clinicalApi.changePassword(
        { oldPassword, newPassword },
        session.token,
      );
      const updated: AuthSession = { ...session, mustChangePassword: false };
      onSuccess(updated);
      navigate("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al cambiar contraseña",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F8FAFC",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "2.5rem",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "0.5rem",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "#0D9488",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Lock size={20} color="white" />
            </div>
          </div>
          <h1
            style={{
              fontWeight: 800,
              fontSize: "1.4rem",
              color: "#111827",
              margin: 0,
            }}
          >
            Cambio de contraseña obligatorio
          </h1>
          <p
            style={{
              color: "#6b7280",
              fontSize: "0.875rem",
              marginTop: "0.5rem",
            }}
          >
            Por seguridad, debes establecer una nueva contraseña antes de
            continuar.
          </p>
        </div>

        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            borderRadius: 8,
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            fontSize: "0.8rem",
            color: "#92400e",
          }}
        >
          ⚠️ Tu cuenta fue creada con una contraseña temporal. Crea una nueva
          contraseña personal para acceder al sistema.
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#374151",
                marginBottom: 4,
              }}
            >
              Contraseña temporal (recibida por correo)
            </label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#374151",
                marginBottom: 4,
              }}
            >
              Nueva contraseña (mín. 8 caracteres)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#374151",
                marginBottom: 4,
              }}
            >
              Confirmar nueva contraseña
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                fontSize: "0.875rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: 8,
                padding: "0.6rem 0.75rem",
                color: "#dc2626",
                fontSize: "0.8rem",
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? "#5eead4" : "#0D9488",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "0.75rem",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: "0.25rem",
            }}
          >
            {loading ? "Guardando..." : "Establecer nueva contraseña →"}
          </button>
        </form>
      </div>
    </main>
  );
}

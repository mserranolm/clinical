import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clinicalApi } from "../api/clinical";
import { AuthSession } from "../types";

export function LoginView({ onSuccess }: { onSuccess: (session: AuthSession) => void }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  async function onLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    setError("");
    try {
      const result = await clinicalApi.login({
        email: String(fd.get("email") || ""),
        password: String(fd.get("password") || "")
      });
      onSuccess({ token: result.accessToken, userId: result.userId, name: result.name, email: result.email });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  async function onRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    setError("");
    try {
      await clinicalApi.register({
        name: String(fd.get("name") || ""),
        email: String(fd.get("email") || ""),
        password: String(fd.get("password") || "")
      });
      setMode("login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible registrar usuario");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <div className="login-decor">
        <div className="landing-glow landing-glow-a" />
        <div className="landing-glow landing-glow-b" />
      </div>
      
      <article className="auth-card">
        <header className="auth-header">
          <button className="back-link" onClick={() => navigate("/")}>
            ← Volver al inicio
          </button>
          <div className="auth-brand">
            <h2>Clini<span>Sense</span></h2>
          </div>
          <h1>{mode === "login" ? "Acceso Profesional" : "Registro Médico"}</h1>
          <p>{mode === "login" ? "Ingresa tus credenciales para gestionar tu clínica." : "Crea tu cuenta elite para comenzar el onboarding."}</p>
        </header>

        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Iniciar Sesión</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Registrarse</button>
        </div>

        <div className="auth-form-container">
          <form onSubmit={mode === "login" ? onLogin : onRegister} className="card-form">
            {mode === "register" && (
              <div className="input-group">
                <label>Nombre Completo</label>
                <input name="name" placeholder="Dr. Juan Pérez" required />
              </div>
            )}
            <div className="input-group">
              <label>Email Profesional</label>
              <input name="email" type="email" placeholder="doctor@clinisense.com" required />
            </div>
            <div className="input-group">
              <label>Contraseña</label>
              <input name="password" type="password" placeholder="••••••••" minLength={8} required />
            </div>
            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? "Procesando..." : mode === "login" ? "Ingresar al Panel" : "Registrar mi Clínica"}
            </button>
          </form>
        </div>

        {error && <div className="auth-error">⚠️ {error}</div>}
        <footer className="auth-footer"><small>© 2026 CliniSense Elite.</small></footer>
      </article>
    </main>
  );
}

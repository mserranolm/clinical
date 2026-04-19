import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clinicalApi } from "../api/clinical";
import { AuthSession } from "../types";

export function LoginView({ onSuccess }: { onSuccess: (session: AuthSession) => void }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

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
      let orgName: string | undefined;
      try {
        const profile = await clinicalApi.getUserProfile(result.accessToken);
        orgName = profile.orgName;
      } catch {
        // non-critical
      }
      onSuccess({
        token: result.accessToken,
        userId: result.userId,
        orgId: result.orgId,
        name: result.name,
        email: result.email,
        role: result.role,
        orgName,
        mustChangePassword: result.mustChangePassword,
      });
      if (result.mustChangePassword) {
        navigate("/change-password");
      } else {
        navigate("/dashboard");
      }
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

      {/* Panel izquierdo decorativo */}
      <aside className="login-panel-left">
        <div className="login-panel-glow" />
        <div className="login-panel-content">
          <button className="back-link-panel" onClick={() => navigate("/")}>← Inicio</button>
          <div className="login-brand">
            <h2>DOCCO<span style={{ color: "#0D9488" }}>.</span></h2>
            <small>Plataforma clínica para LATAM</small>
          </div>
          <ul className="login-features">
            {[
              { title: "Agenda Inteligente", desc: "Gestión de citas en tiempo real" },
              { title: "Odontograma Digital", desc: "Registro interactivo por diente" },
              { title: "Historia Clínica", desc: "Expedientes completos y seguros" },
              { title: "Consentimientos", desc: "Firma digital integrada" },
            ].map(f => (
              <li key={f.title}>
                <span className="feat-icon" style={{ background: "rgba(13,148,136,0.18)", color: "#0D9488", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 800, flexShrink: 0 }}>✓</span>
                <div><strong>{f.title}</strong><p>{f.desc}</p></div>
              </li>
            ))}
          </ul>
          <div className="login-panel-stats">
            <div className="pstat"><strong>500+</strong><span>Clínicas</span></div>
            <div className="pstat"><strong>99.9%</strong><span>Uptime</span></div>
            <div className="pstat"><strong>50K+</strong><span>Citas/mes</span></div>
          </div>
        </div>
      </aside>

      {/* Panel derecho con formulario */}
      <section className="login-panel-right">
        <article className="auth-card">

          <header className="auth-header">
            <h1>{mode === "login" ? "Bienvenido de vuelta" : "Crea tu cuenta"}</h1>
            <p>{mode === "login" ? "Ingresa tus credenciales para acceder a tu panel clínico." : "Únete a DOCCO y digitaliza tu práctica médica."}</p>
          </header>

          <div className="auth-tabs">
            <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Iniciar Sesión</button>
            <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Registrarse</button>
          </div>

          <form onSubmit={mode === "login" ? onLogin : onRegister} className="card-form auth-form">
            {mode === "register" && (
              <div className="input-group">
                <label>Nombre Completo</label>
                <input name="name" placeholder="Dr. Juan Pérez" required autoComplete="name" />
              </div>
            )}
            <div className="input-group">
              <label>Usuario o Email</label>
              <input name="email" type="text" placeholder="admin o doctor@clinisense.com" required autoComplete="username" />
            </div>
            <div className="input-group">
              <label>Contraseña</label>
              <div className="password-input-wrap">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  minLength={8}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(p => !p)}
                  title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  tabIndex={-1}
                >
                  {showPassword ? "○" : "●"}
                </button>
              </div>
            </div>

            {error && (
              <div className="auth-error">
                <span>⚠️</span> {error}
              </div>
            )}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading
                ? <><span className="auth-spinner" />Procesando...</>
                : mode === "login" ? "Ingresar al Panel →" : "Crear mi Cuenta →"
              }
            </button>
          </form>

          <footer className="auth-footer">
            <small>© 2026 DOCCO · Todos los derechos reservados</small>
          </footer>
        </article>
      </section>
    </main>
  );
}

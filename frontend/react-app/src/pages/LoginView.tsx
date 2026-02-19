import { useState } from "react";
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
      onSuccess({
        token: result.accessToken,
        userId: result.userId,
        orgId: result.orgId,
        name: result.name,
        email: result.email,
        role: result.role
      });
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

      {/* Panel izquierdo decorativo */}
      <aside className="login-panel-left">
        <div className="login-panel-glow" />
        <div className="login-panel-content">
          <button className="back-link-panel" onClick={() => navigate("/")}>← Inicio</button>
          <div className="login-brand">
            <div className="login-brand-icon">🦷</div>
            <h2>Clini<span>Sense</span></h2>
            <small>Sistema Clínico Elite</small>
          </div>
          <ul className="login-features">
            <li><span className="feat-icon">🗓️</span><div><strong>Agenda Inteligente</strong><p>Gestión de citas en tiempo real</p></div></li>
            <li><span className="feat-icon">🦷</span><div><strong>Odontograma Digital</strong><p>Registro interactivo por diente</p></div></li>
            <li><span className="feat-icon">📋</span><div><strong>Historia Clínica</strong><p>Expedientes completos y seguros</p></div></li>
            <li><span className="feat-icon">✅</span><div><strong>Consentimientos</strong><p>Firma digital integrada</p></div></li>
          </ul>
          <div className="login-panel-stats">
            <div className="pstat"><strong>2.4K+</strong><span>Citas/mes</span></div>
            <div className="pstat"><strong>99.2%</strong><span>Satisfacción</span></div>
            <div className="pstat"><strong>1.1K+</strong><span>Pacientes</span></div>
          </div>
        </div>
      </aside>

      {/* Panel derecho con formulario */}
      <section className="login-panel-right">
        <article className="auth-card">

          <header className="auth-header">
            <div className="auth-mode-badge">
              {mode === "login" ? "🔐 Acceso Profesional" : "📝 Registro Médico"}
            </div>
            <h1>{mode === "login" ? "Bienvenido de vuelta" : "Crea tu cuenta"}</h1>
            <p>{mode === "login" ? "Ingresa tus credenciales para acceder a tu panel clínico." : "Únete a CliniSense y digitaliza tu práctica médica."}</p>
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
              <label>Email Profesional</label>
              <input name="email" type="email" placeholder="doctor@clinisense.com" required autoComplete="email" />
            </div>
            <div className="input-group">
              <label>Contraseña</label>
              <input name="password" type="password" placeholder="••••••••" minLength={8} required autoComplete={mode === "login" ? "current-password" : "new-password"} />
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
            <small>© 2026 CliniSense Elite · Todos los derechos reservados</small>
          </footer>
        </article>
      </section>
    </main>
  );
}

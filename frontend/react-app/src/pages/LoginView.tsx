import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Calendar, Users, FileText, Sparkles } from "lucide-react";
import { clinicalApi } from "../api/clinical";
import { AuthSession } from "../types";
import { Logo } from "../components/ui/Logo";

const FEATURES = [
  {
    icon: <Calendar size={16} />,
    title: "Agenda inteligente",
    desc: "Citas en tiempo real",
  },
  {
    icon: <Users size={16} />,
    title: "Gestión de pacientes",
    desc: "Expedientes completos",
  },
  {
    icon: <FileText size={16} />,
    title: "Consentimientos digitales",
    desc: "Firma integrada",
  },
  {
    icon: <Sparkles size={16} />,
    title: "Asistente IA Docco",
    desc: "Soporte clínico 24/7",
  },
];

const STATS = [
  ["2.4K+", "Citas/mes"],
  ["99.2%", "Satisfacción"],
  ["1.1K+", "Pacientes"],
];

export function LoginView({
  onSuccess,
}: {
  onSuccess: (session: AuthSession) => void;
}) {
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
        password: String(fd.get("password") || ""),
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
      setError(
        err instanceof Error ? err.message : "No fue posible iniciar sesión",
      );
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
        password: String(fd.get("password") || ""),
      });
      setMode("login");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No fue posible registrar usuario",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "inherit",
      }}
    >
      {/* ── Panel izquierdo ── */}
      <aside
        style={{
          width: 420,
          flexShrink: 0,
          background: "#060914",
          backgroundImage:
            "linear-gradient(rgba(99,102,241,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.025) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
          padding: "40px 48px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Radial glow indigo — esquina superior */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 360,
            height: 360,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        {/* Radial glow emerald — esquina inferior */}
        <div
          style={{
            position: "absolute",
            bottom: -80,
            left: -60,
            width: 280,
            height: 280,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Boton volver */}
        <button
          onClick={() => navigate("/")}
          style={{
            position: "absolute",
            top: 40,
            right: 20,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            color: "#64748B",
            cursor: "pointer",
            zIndex: 1,
          }}
        >
          ← Inicio
        </button>

        {/* Logo */}
        <div style={{ marginBottom: 48, position: "relative", zIndex: 1 }}>
          <Logo variant="light" style={{ height: 28, width: "auto" }} />
        </div>

        {/* Headline */}
        <div style={{ position: "relative", zIndex: 1, marginBottom: 36 }}>
          <h2
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: "white",
              margin: "0 0 12px",
              lineHeight: 1.2,
              letterSpacing: "-0.025em",
            }}
          >
            El sistema clínico
            <br />
            que tu consultorio
            <br />
            <span style={{ color: "#a5b4fc" }}>merece.</span>
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "#64748B",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Gestión digital completa para profesionales de la salud.
          </p>
        </div>

        {/* Features */}
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            position: "relative",
            zIndex: 1,
            flex: 1,
          }}
        >
          {FEATURES.map((f) => (
            <li
              key={f.title}
              style={{ display: "flex", alignItems: "center", gap: 14 }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: "rgba(99,102,241,0.15)",
                  border: "1px solid rgba(129,140,248,0.25)",
                  color: "#a5b4fc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {f.icon}
              </span>
              <div>
                <div
                  style={{ fontSize: 13, fontWeight: 700, color: "#F8FAFC" }}
                >
                  {f.title}
                </div>
                <div style={{ fontSize: 12, color: "#64748B" }}>{f.desc}</div>
              </div>
            </li>
          ))}
        </ul>

        {/* Stats */}
        <div
          style={{
            paddingTop: 32,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            gap: 28,
            position: "relative",
            zIndex: 1,
          }}
        >
          {STATS.map(([value, label]) => (
            <div key={label}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "white",
                  lineHeight: 1,
                }}
              >
                {value}
              </div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Panel derecho ── */}
      <main
        style={{
          flex: 1,
          background: "linear-gradient(160deg, #f0fdf4 0%, #f9fafb 50%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 420 }}>
          {/* Mode tabs */}
          <div
            style={{
              background: "#F1F5F9",
              borderRadius: 12,
              padding: 4,
              display: "flex",
              marginBottom: 32,
            }}
          >
            <button
              onClick={() => {
                setMode("login");
                setError("");
              }}
              style={{
                flex: 1,
                padding: "9px 0",
                borderRadius: 9,
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
                ...(mode === "login"
                  ? {
                      background: "white",
                      color: "#0F172A",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    }
                  : {
                      background: "transparent",
                      color: "#94A3B8",
                    }),
              }}
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => {
                setMode("register");
                setError("");
              }}
              style={{
                flex: 1,
                padding: "9px 0",
                borderRadius: 9,
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
                ...(mode === "register"
                  ? {
                      background: "white",
                      color: "#0F172A",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    }
                  : {
                      background: "transparent",
                      color: "#94A3B8",
                    }),
              }}
            >
              Registrarse
            </button>
          </div>

          {/* Heading */}
          <h1
            style={{
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              color: "#0F172A",
              margin: "0 0 28px",
            }}
          >
            {mode === "login" ? "Bienvenido de vuelta" : "Crea tu cuenta"}
          </h1>

          {/* Form */}
          <form
            onSubmit={mode === "login" ? onLogin : onRegister}
            style={{ display: "flex", flexDirection: "column", gap: 20 }}
          >
            {mode === "register" && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#94A3B8",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  Nombre Completo
                </label>
                <input
                  name="name"
                  placeholder="Dr. Juan Pérez"
                  required
                  autoComplete="name"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #E2E8F0",
                    fontSize: 14,
                    color: "#0F172A",
                    background: "white",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>
            )}

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: 6,
                }}
              >
                Usuario o Email
              </label>
              <input
                name="email"
                type="text"
                placeholder="admin o doctor@clinica.com"
                required
                autoComplete="username"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #E2E8F0",
                  fontSize: 14,
                  color: "#0F172A",
                  background: "white",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: 6,
                }}
              >
                Contraseña
              </label>
              <div style={{ position: "relative" }}>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  minLength={8}
                  required
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  style={{
                    width: "100%",
                    padding: "10px 44px 10px 14px",
                    borderRadius: 10,
                    border: "1px solid #E2E8F0",
                    fontSize: 14,
                    color: "#0F172A",
                    background: "white",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  title={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  tabIndex={-1}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94A3B8",
                    display: "flex",
                    alignItems: "center",
                    padding: 0,
                  }}
                >
                  {showPassword ? (
                    <EyeOff size={16} strokeWidth={2} />
                  ) : (
                    <Eye size={16} strokeWidth={2} />
                  )}
                </button>
              </div>

              {/* Enlace contraseña olvidada — solo en login */}
              {mode === "login" && (
                <div style={{ textAlign: "right", marginTop: -8 }}>
                  <button
                    type="button"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#0D9488",
                      fontSize: 13,
                      cursor: "pointer",
                      padding: "8px 0 0",
                    }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "#DC2626",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>⚠</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 10,
                border: "none",
                background: loading
                  ? "#94A3B8"
                  : "linear-gradient(135deg, #10b981, #059669)",
                boxShadow: loading
                  ? "none"
                  : "0 1px 0 rgba(255,255,255,0.12) inset, 0 4px 14px rgba(16,185,129,0.3)",
                color: "white",
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 150ms cubic-bezier(0.23,1,0.32,1)",
              }}
              onMouseEnter={(e) => {
                if (!loading)
                  e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
              }}
              onMouseDown={(e) => {
                if (!loading) e.currentTarget.style.transform = "scale(0.97)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "";
              }}
            >
              {loading ? (
                <>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "white",
                      borderRadius: "50%",
                      animation: "spin 0.6s linear infinite",
                      display: "inline-block",
                    }}
                  />
                  Procesando...
                </>
              ) : mode === "login" ? (
                "Ingresar al Panel →"
              ) : (
                "Crear mi Cuenta →"
              )}
            </button>
          </form>

          <footer
            style={{
              marginTop: 32,
              textAlign: "center",
              fontSize: 12,
              color: "#94A3B8",
            }}
          >
            © 2026 DOCCO · Todos los derechos reservados
          </footer>
        </div>
      </main>
    </main>
  );
}

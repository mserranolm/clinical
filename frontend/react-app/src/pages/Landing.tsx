import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, ArrowRight, Send } from "lucide-react";
import { Logo } from "../components/ui/Logo";

const features = [
  {
    icon: "🗓",
    title: "Agenda inteligente",
    desc: "Gestión de citas en tiempo real con confirmación automática por email.",
  },
  {
    icon: "🦷",
    title: "Odontograma digital",
    desc: "Registro interactivo FDI de 32 dientes con historial completo por superficie.",
  },
  {
    icon: "📋",
    title: "Consentimientos legales",
    desc: "Plantillas personalizables con firma digital y trazabilidad completa.",
  },
  {
    icon: "💰",
    title: "Control financiero",
    desc: "Pagos, presupuestos y reportes de ingresos en un solo lugar.",
  },
  {
    icon: "🔔",
    title: "Notificaciones email",
    desc: "Recordatorios automáticos 24h antes y confirmación de citas vía link.",
  },
  {
    icon: "🤖",
    title: "Asistente IA Docco",
    desc: "Chat inteligente integrado para resolver dudas clínicas y administrativas.",
  },
];

const heroStats = [
  { value: "2.4K+", label: "Citas al mes" },
  { value: "1.1K+", label: "Pacientes activos" },
  { value: "99.9%", label: "Uptime garantizado" },
];

const mockAppointments = [
  {
    name: "María González",
    time: "09:00",
    status: "confirmed",
    bg: "#DCFCE7",
    tc: "#15803D",
    label: "Confirmada",
  },
  {
    name: "Carlos Ruiz",
    time: "10:30",
    status: "scheduled",
    bg: "#FEF3C7",
    tc: "#B45309",
    label: "No confirmada",
  },
  {
    name: "Ana Martínez",
    time: "11:00",
    status: "in_progress",
    bg: "#DBEAFE",
    tc: "#1D4ED8",
    label: "En consulta",
  },
];

export function Landing() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        background: "#FAFBFC",
        minHeight: "100vh",
        color: "#0F172A",
      }}
    >
      {/* ── Navbar ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: scrolled ? "rgba(255,255,255,0.92)" : "white",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled
            ? "1px solid #F1F5F9"
            : "1px solid transparent",
          transition: "background 0.2s, border-color 0.2s",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "0 24px",
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Logo style={{ height: 28, width: "auto" }} />
          <nav style={{ display: "flex", gap: 4 }}>
            {["Funcionalidades", "Seguridad", "Precios"].map((l) => (
              <button
                key={l}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 14,
                  color: "#64748B",
                  fontFamily: "inherit",
                  fontWeight: 500,
                }}
              >
                {l}
              </button>
            ))}
          </nav>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => navigate("/login")}
              style={{
                background: "none",
                border: "1px solid #E2E8F0",
                cursor: "pointer",
                padding: "8px 18px",
                borderRadius: 10,
                fontSize: 13,
                color: "#475569",
                fontFamily: "inherit",
                fontWeight: 500,
              }}
            >
              Acceso médicos
            </button>
            <button
              onClick={() => navigate("/login")}
              style={{
                background: "#0D9488",
                border: "none",
                cursor: "pointer",
                padding: "8px 18px",
                borderRadius: 10,
                fontSize: 13,
                color: "white",
                fontFamily: "inherit",
                fontWeight: 600,
              }}
            >
              Comenzar gratis
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "80px 24px 64px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 64,
          alignItems: "center",
        }}
      >
        {/* Left copy */}
        <div>
          {/* Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#F0FDFA",
              border: "1px solid #CCFBF1",
              borderRadius: 100,
              padding: "5px 14px",
              fontSize: 12,
              fontWeight: 600,
              color: "#0D9488",
              marginBottom: 28,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#0D9488",
                display: "inline-block",
              }}
            />
            Sistema clínico en producción · HIPAA Compliant
          </div>

          <h1
            style={{
              fontSize: "clamp(36px,4.5vw,54px)",
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              margin: "0 0 20px",
              color: "#0F172A",
            }}
          >
            La gestión clínica
            <br />
            <span style={{ color: "#0D9488" }}>más precisa</span>
            <br />
            del consultorio.
          </h1>

          <p
            style={{
              fontSize: 17,
              color: "#64748B",
              lineHeight: 1.65,
              margin: "0 0 28px",
              maxWidth: 460,
            }}
          >
            DOCCO centraliza pacientes, citas, odontogramas y consentimientos en
            una sola plataforma. Sin papeles, sin errores, sin estrés.
          </p>

          {/* CTA buttons */}
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 48,
            }}
          >
            <button
              onClick={() => navigate("/login")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#0D9488",
                color: "white",
                border: "none",
                cursor: "pointer",
                padding: "13px 24px",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "inherit",
                boxShadow: "0 4px 20px rgba(13,148,136,0.3)",
              }}
            >
              Ver el panel en vivo <ArrowRight size={16} />
            </button>
            <button
              onClick={() => navigate("/login")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "white",
                color: "#0F172A",
                border: "1px solid #E2E8F0",
                cursor: "pointer",
                padding: "13px 24px",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 500,
                fontFamily: "inherit",
              }}
            >
              Solicitar demo
            </button>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: 32,
              paddingTop: 24,
              borderTop: "1px solid #F1F5F9",
            }}
          >
            {heroStats.map((s) => (
              <div key={s.label}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#0F172A",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {s.value}
                </div>
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — product UI mockup */}
        <div style={{ position: "relative" }}>
          {/* Main card — browser mockup */}
          <div
            style={{
              background: "white",
              borderRadius: 20,
              border: "1px solid #E2E8F0",
              boxShadow: "0 24px 64px rgba(15,23,42,0.10)",
              overflow: "hidden",
            }}
          >
            {/* Topbar browser chrome */}
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid #F1F5F9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                {["#FF5F57", "#FFBD2E", "#28CA41"].map((c) => (
                  <div
                    key={c}
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: "50%",
                      background: c,
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>
                Panel Principal · Hoy
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#0D9488",
                  }}
                />
                <span
                  style={{ fontSize: 11, color: "#0D9488", fontWeight: 600 }}
                >
                  En vivo
                </span>
              </div>
            </div>

            {/* KPIs 3 columnas */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                borderBottom: "1px solid #F1F5F9",
              }}
            >
              {[
                {
                  label: "Citas hoy",
                  val: "8",
                  color: "#DBEAFE",
                  tc: "#1D4ED8",
                },
                {
                  label: "Confirmados",
                  val: "6",
                  color: "#DCFCE7",
                  tc: "#15803D",
                },
                {
                  label: "Cobrado",
                  val: "$1.2K",
                  color: "#F0FDFA",
                  tc: "#0D9488",
                },
              ].map((k, i) => (
                <div
                  key={i}
                  style={{
                    padding: "14px 16px",
                    borderRight: i < 2 ? "1px solid #F1F5F9" : "none",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: k.color,
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: k.tc,
                        opacity: 0.6,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: "#0F172A",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {k.val}
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
                    {k.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Mini bar chart */}
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid #F1F5F9",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#94A3B8",
                  marginBottom: 10,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Citas esta semana
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 4,
                  height: 40,
                }}
              >
                {[55, 72, 45, 88, 65, 80, 70].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: `${h * 0.4}px`,
                        borderRadius: 4,
                        background: i === 3 ? "#0D9488" : "#E2E8F0",
                      }}
                    />
                    <span style={{ fontSize: 9, color: "#CBD5E1" }}>
                      {"LMXJVSD"[i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3 citas */}
            <div style={{ padding: "10px 0" }}>
              {mockAppointments.map((a, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 16px",
                    borderBottom: i < 2 ? "1px solid #F8FAFC" : "none",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: "#F0FDFA",
                      color: "#0D9488",
                      fontSize: 10,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {a.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#0F172A",
                      }}
                    >
                      {a.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>
                      {a.time}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      background: a.bg,
                      color: a.tc,
                      padding: "3px 10px",
                      borderRadius: 100,
                    }}
                  >
                    {a.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Floating badge top-right */}
          <div
            style={{
              position: "absolute",
              top: -16,
              right: -16,
              background: "white",
              borderRadius: 12,
              padding: "10px 14px",
              boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
              border: "1px solid #F1F5F9",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "#DCFCE7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CheckCircle size={16} color="#15803D" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                99.9% uptime
              </div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>
                Serverless AWS
              </div>
            </div>
          </div>

          {/* Floating badge bottom-left */}
          <div
            style={{
              position: "absolute",
              bottom: -12,
              left: -20,
              background: "white",
              borderRadius: 12,
              padding: "10px 14px",
              boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
              border: "1px solid #F1F5F9",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "#FEF3C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Send size={16} color="#B45309" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                Recordatorio enviado
              </div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>
                Email a 3 pacientes · hace 2 min
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section
        style={{
          background: "white",
          borderTop: "1px solid #F1F5F9",
          borderBottom: "1px solid #F1F5F9",
        }}
      >
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#0D9488",
                marginBottom: 12,
              }}
            >
              Todo en un solo lugar
            </div>
            <h2
              style={{
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "#0F172A",
                margin: 0,
              }}
            >
              Cada funcionalidad que
              <br />
              tu consultorio necesita
            </h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 24,
            }}
          >
            {features.map((f, i) => (
              <div
                key={i}
                style={{
                  padding: "28px 24px",
                  borderRadius: 16,
                  border: "1px solid #F1F5F9",
                  background: "#FAFBFC",
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#0F172A",
                    margin: "0 0 8px",
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: "#64748B",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA dark ── */}
      <section
        style={{ maxWidth: 1180, margin: "0 auto", padding: "80px 24px" }}
      >
        <div
          style={{
            background: "#0F172A",
            borderRadius: 24,
            padding: "64px 56px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 40,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: "white",
                margin: "0 0 12px",
                letterSpacing: "-0.02em",
              }}
            >
              ¿Listo para digitalizarte?
            </h2>
            <p style={{ fontSize: 16, color: "#94A3B8", margin: 0 }}>
              Comienza hoy sin tarjeta de crédito. Configuración en menos de 10
              minutos.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
            <button
              onClick={() => navigate("/login")}
              style={{
                background: "#0D9488",
                color: "white",
                border: "none",
                cursor: "pointer",
                padding: "14px 28px",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Crear cuenta gratis <ArrowRight size={16} />
            </button>
            <button
              onClick={() => navigate("/login")}
              style={{
                background: "rgba(255,255,255,0.08)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.15)",
                cursor: "pointer",
                padding: "14px 28px",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 500,
                fontFamily: "inherit",
              }}
            >
              Hablar con ventas
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: "1px solid #F1F5F9",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>
          © 2026 DOCCO · Sistema Clínico Elite · Todos los derechos reservados
        </p>
      </footer>
    </div>
  );
}

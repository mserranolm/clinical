import { useNavigate } from "react-router-dom";
import {
  Calendar,
  FileText,
  BarChart3,
  Bell,
  Brain,
  Stethoscope,
  ArrowRight,
  Check,
  CheckCircle,
  Clock,
} from "lucide-react";
import { Logo } from "../components/ui/Logo";

const features = [
  {
    icon: <Calendar size={20} />,
    title: "Agenda inteligente",
    desc: "Gestión de citas en tiempo real con confirmación automática por email y SMS.",
  },
  {
    icon: <Stethoscope size={20} />,
    title: "Odontograma digital",
    desc: "Registro interactivo FDI de 32 dientes con historial completo por superficie.",
  },
  {
    icon: <FileText size={20} />,
    title: "Consentimientos legales",
    desc: "Plantillas personalizables con firma digital y trazabilidad completa.",
  },
  {
    icon: <BarChart3 size={20} />,
    title: "Control financiero",
    desc: "Pagos, presupuestos y reportes de ingresos en un solo lugar.",
  },
  {
    icon: <Bell size={20} />,
    title: "Notificaciones automáticas",
    desc: "Recordatorios 24h antes que reducen el ausentismo un 40%.",
  },
  {
    icon: <Brain size={20} />,
    title: "Asistente IA — Docco",
    desc: "Chat inteligente integrado para dudas clínicas y administrativas 24/7.",
  },
];

const heroStats = [
  { value: "2.4K+", label: "Citas al mes" },
  { value: "1.1K+", label: "Pacientes activos" },
  { value: "99.9%", label: "Uptime garantizado" },
];

const mockAppointments = [
  { name: "María González", time: "09:00", status: "confirmed" },
  { name: "Carlos Ruiz", time: "10:30", status: "scheduled" },
  { name: "Ana Martínez", time: "11:00", status: "in_progress" },
];

const statusBadge: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  confirmed: { label: "Confirmada", bg: "#DCFCE7", color: "#15803D" },
  in_progress: { label: "En consulta", bg: "#DBEAFE", color: "#1D4ED8" },
  completed: { label: "Finalizada", bg: "#F1F5F9", color: "#475569" },
  cancelled: { label: "Cancelada", bg: "#FEE2E2", color: "#DC2626" },
  scheduled: { label: "No confirmada", bg: "#FEF3C7", color: "#B45309" },
};

export function Landing() {
  const navigate = useNavigate();

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
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #F1F5F9",
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
            Sistema clínico en producción · AWS Serverless
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

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "0 0 36px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {[
              "Agenda inteligente sincronizada",
              "Consentimientos legales digitales",
              "Odontograma clínico de alta precisión",
              "Facturación integrada y reportes",
            ].map((c) => (
              <li
                key={c}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 14,
                  color: "#475569",
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "#F0FDFA",
                    border: "1px solid #CCFBF1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Check size={11} strokeWidth={3} color="#0D9488" />
                </span>
                {c}
              </li>
            ))}
          </ul>

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
          <div
            style={{
              background: "white",
              borderRadius: 20,
              border: "1px solid #E2E8F0",
              boxShadow: "0 24px 64px rgba(15,23,42,0.10)",
              overflow: "hidden",
            }}
          >
            {/* Topbar */}
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid #F1F5F9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "white",
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

            {/* KPIs */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 0,
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

            {/* Appointments */}
            <div style={{ padding: "10px 0" }}>
              {mockAppointments.map((a, i) => {
                const badge = statusBadge[a.status] || statusBadge.scheduled;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 16px",
                      borderBottom:
                        i < mockAppointments.length - 1
                          ? "1px solid #F8FAFC"
                          : "none",
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
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
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
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "3px 10px",
                        borderRadius: 100,
                        background: badge.bg,
                        color: badge.color,
                        fontSize: 11,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Floating badges */}
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
                color: "#15803D",
              }}
            >
              <CheckCircle size={16} strokeWidth={1.5} />
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
                color: "#B45309",
              }}
            >
              <Clock size={16} strokeWidth={1.5} />
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
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "#F0FDFA",
                    color: "#0D9488",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  {f.icon}
                </div>
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

      {/* ── Stats bar ── */}
      <section
        style={{ background: "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "40px 24px",
            display: "flex",
            justifyContent: "center",
            gap: 80,
          }}
        >
          {[
            { value: "500+", label: "Clínicas activas" },
            { value: "50K", label: "Citas al mes" },
            { value: "99.9%", label: "Uptime garantizado" },
            { value: "< 2s", label: "Tiempo de respuesta" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#0D9488",
                  letterSpacing: "-0.02em",
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#94A3B8",
                  marginTop: 4,
                  fontWeight: 500,
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
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
          background: "#0F172A",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <Logo style={{ height: 24, width: "auto" }} variant="light" />
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
            © 2026 DOCCO · Sistema Clínico Elite · Todos los derechos reservados
          </span>
        </div>
      </footer>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import {
  Check, ArrowRight, Stethoscope, Calendar,
  FileText, BarChart3, Bell, Shield, Zap, Users,
} from "lucide-react";

const quickStats = [
  { label: "Citas / mes", value: "2.4K+" },
  { label: "Pacientes activos", value: "1.1K+" },
  { label: "Satisfacción médica", value: "99.2%" },
];

const highlights = [
  "Agenda inteligente sincronizada",
  "Consentimientos legales digitales",
  "Odontograma clínico de alta precisión",
  "Analytics y KPIs en tiempo real",
];

const mockAppointments = [
  { name: "María González", time: "09:00", status: "confirmed", color: "#dcfce7", text: "#166534" },
  { name: "Carlos Ruiz",    time: "10:30", status: "pending",   color: "#fef3c7", text: "#92400e" },
  { name: "Ana Martínez",  time: "11:00", status: "confirmed", color: "#dcfce7", text: "#166534" },
];

const mockBars = [65, 80, 55, 90, 72, 88, 76];
const barDays  = ["L","M","X","J","V","S","D"];

export function Landing() {
  const navigate = useNavigate();

  return (
    <main className="lp-root">
      <div className="lp-bg-radial" />
      <div className="lp-bg-grid" />

      {/* ── Navbar ─────────────────────────────────────────── */}
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-nav-brand">
            <div className="lp-nav-logo">
              <Stethoscope size={16} strokeWidth={1.5} color="white" />
            </div>
            <span className="lp-nav-name">Clini<span>Sense</span></span>
          </div>
          <div className="lp-nav-actions">
            <button className="lp-btn-ghost" onClick={() => navigate("/login")}>
              Acceso Médicos
            </button>
            <button className="lp-btn-primary" onClick={() => navigate("/login")}>
              Comenzar ahora
              <ArrowRight size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-hero-inner">

          {/* ── Columna izquierda ─────────────────────────── */}
          <div className="lp-hero-copy">

            <div className="lp-badge lp-anim lp-anim-1">
              <span>✨</span>
              <span>Elite Medical Management Suite</span>
            </div>

            <h1 className="lp-h1 lp-anim lp-anim-2">
              La nueva era de la{" "}
              <span className="lp-h1-gradient">gestión clínica digital</span>
            </h1>

            <p className="lp-subtitle lp-anim lp-anim-3">
              CliniSense redefine la eficiencia administrativa para consultorios.
              Una plataforma diseñada para médicos que exigen precisión,
              trazabilidad y una experiencia de usuario excepcional.
            </p>

            <ul className="lp-checklist lp-anim lp-anim-4">
              {highlights.map((item) => (
                <li key={item} className="lp-check-item">
                  <span className="lp-check-icon">
                    <Check size={11} strokeWidth={2.5} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <div className="lp-ctas lp-anim lp-anim-5">
              <button className="lp-btn-cta-primary" onClick={() => navigate("/login")}>
                Iniciar sesión
                <ArrowRight size={15} strokeWidth={2} />
              </button>
              <button className="lp-btn-cta-secondary" onClick={() => navigate("/login")}>
                Solicitar demo
              </button>
            </div>

            <div className="lp-metrics lp-anim lp-anim-6">
              {quickStats.map((s, i) => (
                <div key={s.label} className="lp-metric-item">
                  {i > 0 && <div className="lp-metric-sep" />}
                  <strong className="lp-metric-value">{s.value}</strong>
                  <span className="lp-metric-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Columna derecha — Bento Box ───────────────── */}
          <div className="lp-bento-wrap lp-anim lp-anim-3">
            <div className="lp-bento">

              {/* Header */}
              <div className="lp-bento-header">
                <div className="lp-bento-dots">
                  <span className="lp-dot lp-dot-red" />
                  <span className="lp-dot lp-dot-yellow" />
                  <span className="lp-dot lp-dot-green" />
                </div>
                <span className="lp-bento-title">Panel Principal · Hoy</span>
                <div className="lp-bento-live">
                  <span className="lp-live-dot" />
                  <span>En vivo</span>
                </div>
              </div>

              {/* KPI mini-cards */}
              <div className="lp-bento-kpis">
                <div className="lp-bento-kpi">
                  <div className="lp-bento-kpi-icon" style={{ background: "#e0f2fe" }}>
                    <Calendar size={13} strokeWidth={1.5} color="#0369a1" />
                  </div>
                  <div>
                    <div className="lp-bento-kpi-val">8</div>
                    <div className="lp-bento-kpi-lbl">Citas hoy</div>
                  </div>
                </div>
                <div className="lp-bento-kpi">
                  <div className="lp-bento-kpi-icon" style={{ background: "#dcfce7" }}>
                    <Users size={13} strokeWidth={1.5} color="#166534" />
                  </div>
                  <div>
                    <div className="lp-bento-kpi-val">6</div>
                    <div className="lp-bento-kpi-lbl">Confirmados</div>
                  </div>
                </div>
                <div className="lp-bento-kpi">
                  <div className="lp-bento-kpi-icon" style={{ background: "#d1fae5" }}>
                    <BarChart3 size={13} strokeWidth={1.5} color="#065f46" />
                  </div>
                  <div>
                    <div className="lp-bento-kpi-val">$1.2K</div>
                    <div className="lp-bento-kpi-lbl">Cobrado</div>
                  </div>
                </div>
              </div>

              {/* Gráfico de barras */}
              <div className="lp-bento-chart-wrap">
                <div className="lp-bento-chart-label">
                  <BarChart3 size={11} strokeWidth={1.5} color="#0d9488" />
                  <span>Citas esta semana</span>
                </div>
                <div className="lp-bento-bars">
                  {mockBars.map((h, i) => (
                    <div key={i} className="lp-bar-col">
                      <div
                        className="lp-bar"
                        style={{
                          height: `${h}%`,
                          background: i === 3
                            ? "linear-gradient(180deg,#0d9488,#10b981)"
                            : "linear-gradient(180deg,#99f6e4,#ccfbf1)",
                          animationDelay: `${0.6 + i * 0.07}s`,
                        }}
                      />
                      <span className="lp-bar-day">{barDays[i]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lista de citas */}
              <div className="lp-bento-appts">
                <div className="lp-bento-section-label">
                  <Calendar size={11} strokeWidth={1.5} color="#64748b" />
                  <span>Próximas citas</span>
                </div>
                {mockAppointments.map((a) => (
                  <div key={a.name} className="lp-appt-row">
                    <div className="lp-appt-avatar">
                      {a.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                    <div className="lp-appt-info">
                      <span className="lp-appt-name">{a.name}</span>
                      <span className="lp-appt-time">{a.time}</span>
                    </div>
                    <span className="lp-appt-badge" style={{ background: a.color, color: a.text }}>
                      {a.status === "confirmed" ? "Confirmada" : "Pendiente"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Notificación */}
              <div className="lp-bento-notif">
                <div className="lp-notif-icon">
                  <Bell size={12} strokeWidth={1.5} color="#0d9488" />
                </div>
                <div className="lp-notif-text">
                  <strong>Recordatorio enviado</strong>
                  <span>SMS a 3 pacientes · hace 2 min</span>
                </div>
                <div className="lp-notif-dot" />
              </div>
            </div>

            {/* Tarjetas flotantes */}
            <div className="lp-float-card lp-float-card-1">
              <div className="lp-float-icon">
                <Zap size={14} strokeWidth={1.5} color="#0d9488" />
              </div>
              <div>
                <div className="lp-float-val">99.9%</div>
                <div className="lp-float-lbl">Uptime</div>
              </div>
            </div>

            <div className="lp-float-card lp-float-card-2">
              <div className="lp-float-icon" style={{ background: "#ede9fe" }}>
                <Shield size={14} strokeWidth={1.5} color="#7c3aed" />
              </div>
              <div>
                <div className="lp-float-val">HIPAA</div>
                <div className="lp-float-lbl">Compliant</div>
              </div>
            </div>

            <div className="lp-float-card lp-float-card-3">
              <div className="lp-float-icon" style={{ background: "#fef3c7" }}>
                <FileText size={14} strokeWidth={1.5} color="#92400e" />
              </div>
              <div>
                <div className="lp-float-val">Digital</div>
                <div className="lp-float-lbl">Consentimientos</div>
              </div>
            </div>
          </div>

        </div>
      </section>
    </main>
  );
}

import { useNavigate } from "react-router-dom";
import { Calendar, FileText, BarChart3, Bell, Brain, Stethoscope, Check, ArrowRight } from "lucide-react";
import { Logo } from "../components/ui/Logo";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { useTheme } from "../App";
import { useIsDark } from "../lib/use-is-dark";

const stats = [
  { value: "500+", label: "Clínicas activas" },
  { value: "50K", label: "Citas / mes" },
  { value: "99.9%", label: "Uptime garantizado" },
];

const features = [
  { icon: <Calendar size={22} />, title: "Agenda inteligente", desc: "Calendario sincronizado con recordatorios automáticos vía WhatsApp y SMS." },
  { icon: <Stethoscope size={22} />, title: "Odontograma 3D", desc: "Registro clínico visual de alta precisión sobre modelo dental interactivo." },
  { icon: <FileText size={22} />, title: "Consentimientos digitales", desc: "Generación y firma electrónica de consentimientos informados conformes a la ley." },
  { icon: <BarChart3 size={22} />, title: "Facturación y pagos", desc: "Control de ingresos, presupuestos y cobros integrados en un solo panel." },
  { icon: <Bell size={22} />, title: "Recordatorios automáticos", desc: "Notificaciones por WhatsApp y SMS que reducen el ausentismo un 40%." },
  { icon: <Brain size={22} />, title: "IA clínica — Docco", desc: "Asistente de inteligencia artificial que apoya el diagnóstico y la documentación." },
];

export function Landing() {
  const navigate = useNavigate();
  const isDark = useIsDark();
  const { theme, setTheme } = useTheme();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: isDark ? "rgba(15,23,42,0.94)" : "rgba(255,255,255,0.94)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div className="lp-nav-inner">
          <Logo style={{ height: '28px', width: 'auto' }} />
          <div style={{ flex: 1 }} />
          <ThemeToggle current={theme} onChange={setTheme} />
          <button className="lp-btn-ghost" onClick={() => navigate("/login")}>Iniciar sesión</button>
          <button className="lp-btn-primary" onClick={() => navigate("/login")}>Solicitar demo</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="lp-hero">
        <div className="lp-hero-inner lp-section-wrap">

          {/* Left */}
          <div className="lp-hero-copy">
            <span className="lp-badge">Plataforma clínica</span>
            <h1 className="lp-h1">
              La clínica moderna<br />
              <span style={{ color: "#0D9488" }}>empieza aquí</span>
            </h1>
            <p className="lp-lead">
              DOCCO centraliza agenda, expedientes clínicos, consentimientos y facturación en una sola plataforma diseñada para odontólogos y clínicas de LATAM.
            </p>
            <ul className="lp-checklist-simple">
              {["Agenda inteligente sincronizada", "Consentimientos legales digitales", "Odontograma clínico de alta precisión", "Facturación integrada y reportes"].map(c => (
                <li key={c}>
                  <span className="lp-check-icon"><Check size={11} strokeWidth={3} color="#0D9488" /></span>
                  {c}
                </li>
              ))}
            </ul>
            <div className="lp-cta-row">
              <button className="lp-btn-cta-primary" onClick={() => navigate("/login")}>
                Comenzar gratis <ArrowRight size={16} />
              </button>
              <button className="lp-btn-ghost" onClick={() => navigate("/login")}>Ver demo</button>
            </div>
          </div>

          {/* Right — mockup */}
          <div className="lp-bento-wrap">
            <div className="lp-bento">
              {/* KPI strip */}
              <div className="lp-bento-kpis">
                {[
                  { label: "Citas hoy", val: "8", color: "#DBEAFE", tc: "#1D4ED8" },
                  { label: "Confirmados", val: "6", color: "#DCFCE7", tc: "#15803D" },
                  { label: "Cobrado", val: "$1.2K", color: "#F0FDFA", tc: "#0D9488" },
                ].map((k, i) => (
                  <div key={i} className="lp-bento-kpi" style={{ borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: k.tc, lineHeight: 1 }}>{k.val}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 3, fontWeight: 500 }}>{k.label}</div>
                  </div>
                ))}
              </div>
              {/* Mini agenda */}
              <div style={{ padding: "14px 18px" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Agenda del día</div>
                {[
                  { time: "09:00", name: "Ana García", type: "Limpieza", sc: "#DCFCE7", tc: "#15803D", s: "Confirmado" },
                  { time: "10:30", name: "Carlos Ruiz", type: "Extracción", sc: "#DBEAFE", tc: "#1D4ED8", s: "Pendiente" },
                  { time: "12:00", name: "María López", type: "Ortodoncia", sc: "#DCFCE7", tc: "#15803D", s: "Confirmado" },
                ].map((row, i) => (
                  <div key={i} className="lp-agenda-row" style={{ borderBottom: i < 2 ? "1px solid var(--border)" : "none" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", width: 34, flexShrink: 0 }}>{row.time}</span>
                    <div className="lp-agenda-avatar">{row.name.split(" ").map(n => n[0]).join("")}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</div>
                      <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{row.type}</div>
                    </div>
                    <span style={{ padding: "2px 7px", borderRadius: 100, background: row.sc, color: row.tc, fontSize: "0.62rem", fontWeight: 700, flexShrink: 0 }}>{row.s}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Floating badge */}
            <div className="lp-float-card lp-float-card-1">
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", flexShrink: 0 }} />
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-primary)" }}>99.9% uptime</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <div className="lp-stats-bar">
        <div className="lp-metrics">
          {stats.map((s, i) => (
            <div key={i} className="lp-metric" style={{ borderRight: i < stats.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ fontSize: "1.9rem", fontWeight: 800, color: "#0D9488", letterSpacing: "-1px" }}>{s.value}</div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <section className="lp-features lp-section-wrap">
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 className="lp-h2">Todo lo que tu clínica necesita</h2>
          <p style={{ fontSize: "1rem", color: "var(--text-muted)", maxWidth: 460, margin: "12px auto 0" }}>
            Una plataforma completa para gestionar pacientes, citas, clínica y finanzas.
          </p>
        </div>
        <div className="lp-features-grid">
          {features.map((f, i) => (
            <div key={i} className="lp-feature-card">
              <div className="lp-feature-icon">{f.icon}</div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>{f.title}</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA dark ── */}
      <section style={{ background: "#0F172A", padding: "72px 24px" }}>
        <div style={{ maxWidth: 620, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "2rem", fontWeight: 800, color: "white", letterSpacing: "-0.8px", marginBottom: 14 }}>
            ¿Listo para modernizar tu clínica?
          </h2>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.65, marginBottom: 32 }}>
            Empieza hoy sin tarjeta de crédito. Configura tu clínica en menos de 10 minutos.
          </p>
          <div className="lp-cta-row" style={{ justifyContent: "center" }}>
            <button className="lp-btn-cta-primary" onClick={() => navigate("/login")}>
              Solicitar demo <ArrowRight size={16} />
            </button>
            <button className="lp-btn-cta-secondary" onClick={() => navigate("/login")}>
              Iniciar sesión
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: "#0F172A", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "20px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <Logo style={{ height: '24px', width: 'auto' }} variant="light" />
          <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.3)" }}>© 2026 DOCCO. Todos los derechos reservados.</span>
        </div>
      </footer>
    </div>
  );
}

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

const checks = [
  "Agenda inteligente sincronizada",
  "Consentimientos legales digitales",
  "Odontograma clínico de alta precisión",
  "Facturación integrada y reportes",
];

export function Landing() {
  const navigate = useNavigate();
  const isDark = useIsDark();
  const { theme, setTheme } = useTheme();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", gap: 32 }}>
          <Logo className="h-7 w-auto" />
          <div style={{ flex: 1 }} />
          <ThemeToggle current={theme} onChange={setTheme} />
          <button
            onClick={() => navigate("/login")}
            style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}
          >
            Iniciar sesión
          </button>
          <button
            onClick={() => navigate("/login")}
            style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "#0D9488", color: "white", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer" }}
          >
            Solicitar demo
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "80px 24px 64px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
        {/* Left */}
        <div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(13,148,136,0.10)", color: "#0D9488", fontSize: "0.78rem", fontWeight: 700, padding: "5px 12px", borderRadius: 100, marginBottom: 24, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Plataforma clínica
          </span>
          <h1 style={{ fontSize: "3.2rem", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-1.5px", color: "var(--text-primary)", marginBottom: 20 }}>
            La clínica moderna<br />
            <span style={{ color: "#0D9488" }}>empieza aquí</span>
          </h1>
          <p style={{ fontSize: "1.1rem", color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 32, maxWidth: 460 }}>
            DOCCO centraliza agenda, expedientes clínicos, consentimientos y facturación en una sola plataforma diseñada para odontólogos y clínicas de LATAM.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 36px", display: "flex", flexDirection: "column", gap: 12 }}>
            {checks.map(c => (
              <li key={c} style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-secondary)", fontSize: "0.95rem" }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(13,148,136,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Check size={12} color="#0D9488" strokeWidth={3} />
                </span>
                {c}
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => navigate("/login")}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 24px", borderRadius: 12, border: "none", background: "#0D9488", color: "white", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer" }}
            >
              Comenzar gratis <ArrowRight size={16} />
            </button>
            <button
              onClick={() => navigate("/login")}
              style={{ padding: "13px 24px", borderRadius: 12, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: "0.95rem", fontWeight: 600, cursor: "pointer" }}
            >
              Ver demo
            </button>
          </div>
        </div>

        {/* Right — Bento mockup */}
        <div style={{ position: "relative" }}>
          <div style={{
            background: "var(--surface)", borderRadius: 24, border: "1px solid var(--border)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.08)", overflow: "hidden",
          }}>
            {/* KPI strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderBottom: "1px solid var(--border)" }}>
              {[
                { label: "Citas hoy", val: "8", color: "#DBEAFE", tc: "#1D4ED8" },
                { label: "Confirmados", val: "6", color: "#DCFCE7", tc: "#15803D" },
                { label: "Cobrado", val: "$1.2K", color: "#F0FDFA", tc: "#0D9488" },
              ].map((k, i) => (
                <div key={i} style={{ padding: "16px 20px", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: k.tc, lineHeight: 1 }}>{k.val}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4, fontWeight: 500 }}>{k.label}</div>
                </div>
              ))}
            </div>
            {/* Mini agenda */}
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Agenda del día</div>
              {[
                { time: "09:00", name: "Ana García", type: "Limpieza", status: "Confirmado", sc: "#DCFCE7", tc: "#15803D" },
                { time: "10:30", name: "Carlos Ruiz", type: "Extracción", status: "Pendiente", sc: "#DBEAFE", tc: "#1D4ED8" },
                { time: "12:00", name: "María López", type: "Ortodoncia", status: "Confirmado", sc: "#DCFCE7", tc: "#15803D" },
              ].map((row, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: i < 2 ? "1px solid var(--border)" : "none" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", width: 36, flexShrink: 0 }}>{row.time}</span>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#CCFBF1,#99F6E4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 800, color: "#0D9488", flexShrink: 0 }}>
                    {row.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)" }}>{row.name}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{row.type}</div>
                  </div>
                  <span style={{ padding: "3px 8px", borderRadius: 100, background: row.sc, color: row.tc, fontSize: "0.65rem", fontWeight: 700 }}>{row.status}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Floating badge */}
          <div style={{
            position: "absolute", top: -16, right: -16,
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 14, padding: "10px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)" }}>99.9% uptime</span>
          </div>
        </div>
      </section>

      {/* ── Stats row ── */}
      <section style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px", display: "flex", justifyContent: "center", gap: 0 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ flex: 1, maxWidth: 260, textAlign: "center", padding: "0 32px", borderRight: i < stats.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0D9488", letterSpacing: "-1px" }}>{s.value}</div>
              <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", fontWeight: 500, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.8px", color: "var(--text-primary)", marginBottom: 12 }}>
            Todo lo que tu clínica necesita
          </h2>
          <p style={{ fontSize: "1rem", color: "var(--text-muted)", maxWidth: 480, margin: "0 auto" }}>
            Una plataforma completa para gestionar pacientes, citas, clínica y finanzas.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
          {features.map((f, i) => (
            <div key={i} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 20, padding: "28px 24px",
              transition: "box-shadow 0.2s",
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(13,148,136,0.10)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0D9488", marginBottom: 16 }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA dark ── */}
      <section style={{ background: "#0F172A", padding: "80px 24px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "2.4rem", fontWeight: 800, color: "white", letterSpacing: "-1px", marginBottom: 16 }}>
            ¿Listo para modernizar tu clínica?
          </h2>
          <p style={{ fontSize: "1.05rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.65, marginBottom: 36 }}>
            Empieza hoy sin tarjeta de crédito. Configura tu clínica en menos de 10 minutos.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={() => navigate("/login")}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 12, border: "none", background: "#0D9488", color: "white", fontSize: "1rem", fontWeight: 700, cursor: "pointer" }}
            >
              Solicitar demo <ArrowRight size={16} />
            </button>
            <button
              onClick={() => navigate("/login")}
              style={{ padding: "14px 28px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.7)", fontSize: "1rem", fontWeight: 600, cursor: "pointer" }}
            >
              Iniciar sesión
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "#0F172A", padding: "24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Logo className="h-6 w-auto" variant="light" />
          <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.3)" }}>© 2026 DOCCO. Todos los derechos reservados.</span>
        </div>
      </footer>

      <style>{`
        @media (max-width: 1024px) {
          .lp-hero-grid { grid-template-columns: 1fr !important; }
          .lp-features-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 640px) {
          .lp-features-grid { grid-template-columns: 1fr !important; }
          .lp-stats-row { flex-direction: column !important; gap: 24px !important; }
          .lp-cta-btns { flex-direction: column !important; }
        }
      `}</style>
    </div>
  );
}

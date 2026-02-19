import { useNavigate } from "react-router-dom";

export function Landing() {
  const navigate = useNavigate();
  const quickStats = [
    { label: "Citas gestionadas/mes", value: "2.4K+" },
    { label: "Pacientes activos", value: "1.1K+" },
    { label: "Satisfacción médica", value: "99.2%" }
  ];

  const highlights = [
    "Agenda inteligente sincronizada",
    "Consentimientos legales digitales",
    "Odontograma clínico de alta precisión",
    "Analytics y KPIs en tiempo real"
  ];

  return (
    <main className="landing-page">
      <div className="landing-glow landing-glow-a" />
      <div className="landing-glow landing-glow-b" />

      <header className="landing-top">
        <h1>Clini<span>Sense</span></h1>
        <div className="landing-nav">
          <button className="ghost" onClick={() => navigate("/login")}>Acceso Médicos</button>
          <button onClick={() => navigate("/login")}>Comenzar ahora</button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <small className="hero-kicker">Elite Medical Management Suite</small>
          <h2>
            La nueva era de la <span>gestión clínica digital</span>
          </h2>
          <p>
            CliniSense redefine la eficiencia administrativa para consultorios odontológicos. 
            Una plataforma diseñada para médicos que exigen precisión, trazabilidad y una experiencia de usuario excepcional.
          </p>

          <ul className="hero-highlights">
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="hero-actions">
            <button onClick={() => navigate("/login")}>Iniciar sesión</button>
            <button className="ghost" onClick={() => navigate("/login")}>Solicitar demostración</button>
          </div>

          <div className="hero-stats">
            {quickStats.map((stat) => (
              <article key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="hero-side">
          <article className="hero-panel elite-card">
            <div className="panel-badge">Operativo</div>
            <h3>Administración Integral</h3>
            <ul>
              <li>
                <span className="dot" />
                Control de agenda por especialista
              </li>
              <li>
                <span className="dot" />
                Flujos de consentimiento seguro
              </li>
              <li>
                <span className="dot" />
                Trazabilidad completa de pagos
              </li>
              <li>
                <span className="dot" />
                Service Tester API integrado
              </li>
            </ul>
          </article>

          <article className="hero-mini-card">
            <div className="mini-card-head">
              <small>Disponibilidad Cloud</small>
              <div className="pulse-dot" />
            </div>
            <h4>99.9%</h4>
            <p>Infraestructura serverless de alta resiliencia.</p>
          </article>
        </div>
      </section>
    </main>
  );
}

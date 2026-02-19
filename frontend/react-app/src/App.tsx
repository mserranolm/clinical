import { FormEvent, useMemo, useState } from "react";
import { clinicalApi } from "./api/clinical";
import { clearSession, getSession, saveSession } from "./lib/session";
import { ServiceTester } from "./modules/testing/ServiceTester";
import type { AuthSession } from "./types";

type DashboardPage =
  | "dashboard"
  | "patients"
  | "appointments"
  | "consents"
  | "odontogram"
  | "plans"
  | "testing";

type ActionState = {
  status: "idle" | "loading" | "success" | "error";
  title: string;
  payload?: unknown;
};

const initialSession = getSession();

function SectionResult({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;
  return (
    <div className={`section-result ${state.status}`}>
      <strong>{state.title}</strong>
      {state.payload ? <pre>{JSON.stringify(state.payload, null, 2)}</pre> : null}
    </div>
  );
}

function DashboardHome({ user }: { user: AuthSession }) {
  const cards = [
    { label: "Pacientes activos", value: "142", trend: "+12%" },
    { label: "Citas hoy", value: "38", trend: "+7%" },
    { label: "Consentimientos", value: "91%", trend: "Estable" },
    { label: "Estado operativo", value: "99.9%", trend: "Saludable" }
  ];

  return (
    <section className="page-section">
      <header className="page-header">
        <h2>Panel de administración</h2>
        <p>Bienvenido, {user.name || user.email}. Gestiona toda la operación clínica desde un solo lugar.</p>
      </header>
      <div className="stats-grid">
        {cards.map((card) => (
          <article key={card.label} className="stat-card">
            <small>{card.label}</small>
            <h3>{card.value}</h3>
            <span>{card.trend}</span>
          </article>
        ))}
      </div>
      <article className="chart-card">
        <h3>Rendimiento semanal</h3>
        <div className="bars">
          {[48, 36, 52, 64, 41, 58, 67].map((v, i) => (
            <div key={`bar-${i}`} className="bar-col">
              <div style={{ height: `${v}%` }} />
              <small>{["L", "M", "X", "J", "V", "S", "D"][i]}</small>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function PatientsPage({ token, doctorId }: { token: string; doctorId: string }) {
  const [state, setState] = useState<ActionState>({ status: "idle", title: "" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ status: "loading", title: "Creando paciente..." });
    try {
      const result = await clinicalApi.onboardPatient(
        {
          doctorId: String(fd.get("doctorId") || doctorId),
          specialty: String(fd.get("specialty") || "odontology"),
          firstName: String(fd.get("firstName") || ""),
          lastName: String(fd.get("lastName") || ""),
          phone: String(fd.get("phone") || ""),
          email: String(fd.get("email") || ""),
          birthDate: String(fd.get("birthDate") || ""),
          documentId: String(fd.get("documentId") || ""),
          medicalBackgrounds: [],
          imageKeys: []
        },
        token
      );
      setState({ status: "success", title: "Paciente creado", payload: result });
      e.currentTarget.reset();
    } catch (error) {
      setState({ status: "error", title: "Error creando paciente", payload: { error: String(error) } });
    }
  }

  return (
    <section className="page-section">
      <header className="page-header">
        <h2>Pacientes</h2>
        <p>Onboarding clínico para registrar nuevos pacientes.</p>
      </header>
      <form className="card-form" onSubmit={onSubmit}>
        <input name="doctorId" placeholder="Doctor ID (opcional)" />
        <input name="specialty" defaultValue="odontology" placeholder="Especialidad" />
        <input name="firstName" placeholder="Nombre" required />
        <input name="lastName" placeholder="Apellido" required />
        <input name="documentId" placeholder="Documento" />
        <input name="phone" placeholder="Teléfono" />
        <input name="email" type="email" placeholder="Email" />
        <input name="birthDate" placeholder="YYYY-MM-DD" />
        <button type="submit">Registrar paciente</button>
      </form>
      <SectionResult state={state} />
    </section>
  );
}

function AppointmentsPage({ token, doctorId }: { token: string; doctorId: string }) {
  const [state, setState] = useState<ActionState>({ status: "idle", title: "" });

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ status: "loading", title: "Creando cita..." });
    try {
      const result = await clinicalApi.createAppointment(
        {
          doctorId: String(fd.get("doctorId") || doctorId),
          patientId: String(fd.get("patientId") || ""),
          startAt: new Date(String(fd.get("startAt") || "")).toISOString(),
          endAt: new Date(String(fd.get("endAt") || "")).toISOString(),
          treatmentPlan: String(fd.get("treatmentPlan") || ""),
          paymentAmount: Number(fd.get("paymentAmount") || 0),
          paymentMethod: String(fd.get("paymentMethod") || "")
        },
        token
      );
      setState({ status: "success", title: "Cita creada", payload: result });
      e.currentTarget.reset();
    } catch (error) {
      setState({ status: "error", title: "Error creando cita", payload: { error: String(error) } });
    }
  }

  return (
    <section className="page-section">
      <header className="page-header">
        <h2>Citas</h2>
        <p>Gestiona agenda, horarios y pagos por atención.</p>
      </header>
      <form className="card-form" onSubmit={onCreate}>
        <input name="doctorId" placeholder="Doctor ID (opcional)" />
        <input name="patientId" placeholder="Patient ID" required />
        <input name="startAt" type="datetime-local" required />
        <input name="endAt" type="datetime-local" required />
        <input name="treatmentPlan" placeholder="Plan de tratamiento" />
        <input name="paymentAmount" type="number" step="0.01" placeholder="Monto" />
        <input name="paymentMethod" placeholder="Método de pago" />
        <button type="submit">Crear cita</button>
      </form>
      <SectionResult state={state} />
    </section>
  );
}

function ConsentsPage({ token, doctorId }: { token: string; doctorId: string }) {
  const [state, setState] = useState<ActionState>({ status: "idle", title: "" });

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ status: "loading", title: "Enviando consentimiento..." });
    try {
      const result = await clinicalApi.createConsent(
        {
          doctorId: String(fd.get("doctorId") || doctorId),
          patientId: String(fd.get("patientId") || ""),
          title: String(fd.get("title") || ""),
          content: String(fd.get("content") || ""),
          deliveryMethod: String(fd.get("deliveryMethod") || "email") as "email" | "sms"
        },
        token
      );
      setState({ status: "success", title: "Consentimiento enviado", payload: result });
      e.currentTarget.reset();
    } catch (error) {
      setState({ status: "error", title: "Error enviando consentimiento", payload: { error: String(error) } });
    }
  }

  return (
    <section className="page-section">
      <header className="page-header">
        <h2>Consentimientos</h2>
        <p>Genera y envía consentimientos por email o SMS.</p>
      </header>
      <form className="card-form" onSubmit={onCreate}>
        <input name="doctorId" placeholder="Doctor ID (opcional)" />
        <input name="patientId" placeholder="Patient ID" required />
        <input name="title" placeholder="Título" required />
        <select name="deliveryMethod" defaultValue="email">
          <option value="email">Email</option>
          <option value="sms">SMS</option>
        </select>
        <textarea name="content" placeholder="Texto del consentimiento" required />
        <button type="submit">Enviar consentimiento</button>
      </form>
      <SectionResult state={state} />
    </section>
  );
}

function OdontogramPage({ token, doctorId }: { token: string; doctorId: string }) {
  const [state, setState] = useState<ActionState>({ status: "idle", title: "" });

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ status: "loading", title: "Creando odontograma..." });
    try {
      const result = await clinicalApi.createOdontogram(
        {
          doctorId: String(fd.get("doctorId") || doctorId),
          patientId: String(fd.get("patientId") || "")
        },
        token
      );
      setState({ status: "success", title: "Odontograma creado", payload: result });
      e.currentTarget.reset();
    } catch (error) {
      setState({ status: "error", title: "Error creando odontograma", payload: { error: String(error) } });
    }
  }

  return (
    <section className="page-section">
      <header className="page-header">
        <h2>Odontograma</h2>
        <p>Crea odontogramas iniciales para tus pacientes.</p>
      </header>
      <form className="card-form" onSubmit={onCreate}>
        <input name="doctorId" placeholder="Doctor ID (opcional)" />
        <input name="patientId" placeholder="Patient ID" required />
        <button type="submit">Crear odontograma</button>
      </form>
      <SectionResult state={state} />
    </section>
  );
}

function PlansPage({ token, doctorId }: { token: string; doctorId: string }) {
  const [state, setState] = useState<ActionState>({ status: "idle", title: "" });

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ status: "loading", title: "Creando plan..." });
    try {
      const result = await clinicalApi.createTreatmentPlan(
        {
          doctorId: String(fd.get("doctorId") || doctorId),
          patientId: String(fd.get("patientId") || ""),
          odontogramId: String(fd.get("odontogramId") || ""),
          title: String(fd.get("title") || ""),
          description: String(fd.get("description") || "")
        },
        token
      );
      setState({ status: "success", title: "Plan creado", payload: result });
      e.currentTarget.reset();
    } catch (error) {
      setState({ status: "error", title: "Error creando plan", payload: { error: String(error) } });
    }
  }

  return (
    <section className="page-section">
      <header className="page-header">
        <h2>Planes de tratamiento</h2>
        <p>Administra propuestas de tratamientos clínicos.</p>
      </header>
      <form className="card-form" onSubmit={onCreate}>
        <input name="doctorId" placeholder="Doctor ID (opcional)" />
        <input name="patientId" placeholder="Patient ID" required />
        <input name="odontogramId" placeholder="Odontogram ID (si aplica)" />
        <input name="title" placeholder="Título" required />
        <textarea name="description" placeholder="Descripción" />
        <button type="submit">Crear plan</button>
      </form>
      <SectionResult state={state} />
    </section>
  );
}

function LoginView({
  onSuccess,
  onBack
}: {
  onSuccess: (session: AuthSession) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  async function onLogin(e: FormEvent<HTMLFormElement>) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  async function onRegister(e: FormEvent<HTMLFormElement>) {
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
      <article className="auth-card">
        <button className="link-btn" type="button" onClick={onBack}>
          ← Volver al landing
        </button>
        <h1>{mode === "login" ? "Inicia sesión" : "Registra tu cuenta"}</h1>
        <p>Panel administrativo CliniSense</p>

        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>Login</button>
          <button className={mode === "register" ? "active" : ""} type="button" onClick={() => setMode("register")}>Registro</button>
        </div>

        {mode === "login" ? (
          <form onSubmit={onLogin} className="card-form">
            <input name="email" type="email" placeholder="Email" required />
            <input name="password" type="password" placeholder="Contraseña" required />
            <button type="submit" disabled={loading}>{loading ? "Ingresando..." : "Entrar"}</button>
          </form>
        ) : (
          <form onSubmit={onRegister} className="card-form">
            <input name="name" placeholder="Nombre completo" required />
            <input name="email" type="email" placeholder="Email" required />
            <input name="password" type="password" placeholder="Contraseña (mínimo 8)" minLength={8} required />
            <button type="submit" disabled={loading}>{loading ? "Creando..." : "Registrar"}</button>
          </form>
        )}

        {error ? <small className="error-text">{error}</small> : null}
      </article>
    </main>
  );
}

function Landing({ onStart }: { onStart: () => void }) {
  return (
    <main className="landing-page">
      <header className="landing-top">
        <h1>CliniSense Admin Suite</h1>
        <button onClick={onStart}>Acceder</button>
      </header>
      <section className="hero">
        <div>
          <h2>Gestión clínica moderna para equipos odontológicos</h2>
          <p>
            Administra pacientes, citas, consentimientos, odontogramas y planes de tratamiento desde un dashboard
            visual, rápido y seguro.
          </p>
          <div className="hero-actions">
            <button onClick={onStart}>Iniciar sesión</button>
            <span>Backend Go serverless listo para producción</span>
          </div>
        </div>
        <article className="hero-panel">
          <h3>Vista ejecutiva</h3>
          <ul>
            <li>Agenda por doctor en tiempo real</li>
            <li>Flujos de consentimiento digital</li>
            <li>Seguimiento de tratamientos y pagos</li>
            <li>Módulo de testing API integrado</li>
          </ul>
        </article>
      </section>
    </main>
  );
}

export function App() {
  const [session, setSession] = useState<AuthSession | null>(initialSession);
  const [page, setPage] = useState<DashboardPage>("dashboard");
  const [authScreen, setAuthScreen] = useState<"landing" | "login">(initialSession ? "login" : "landing");

  function handleAuthSuccess(nextSession: AuthSession) {
    saveSession(nextSession);
    setSession(nextSession);
    setPage("dashboard");
  }

  function handleLogout() {
    clearSession();
    setSession(null);
    setAuthScreen("landing");
  }

  const menu = useMemo<Array<{ key: DashboardPage; label: string }>>(
    () => [
      { key: "dashboard", label: "Dashboard" },
      { key: "patients", label: "Pacientes" },
      { key: "appointments", label: "Citas" },
      { key: "consents", label: "Consentimientos" },
      { key: "odontogram", label: "Odontograma" },
      { key: "plans", label: "Planes" },
      { key: "testing", label: "Service Tester" }
    ],
    []
  );

  if (!session) {
    return authScreen === "landing" ? (
      <Landing onStart={() => setAuthScreen("login")} />
    ) : (
      <LoginView onSuccess={handleAuthSuccess} onBack={() => setAuthScreen("landing")} />
    );
  }

  return (
    <main className="admin-layout">
      <aside className="sidebar">
        <h2>CliniSense</h2>
        <small>Administrador</small>
        <nav>
          {menu.map((item) => (
            <button
              key={item.key}
              type="button"
              className={page === item.key ? "active" : ""}
              onClick={() => setPage(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="content-area">
        <header className="topbar">
          <div>
            <h1>{menu.find((m) => m.key === page)?.label}</h1>
            <p>{session.email}</p>
          </div>
          <button className="ghost" onClick={handleLogout}>Cerrar sesión</button>
        </header>

        {page === "dashboard" ? <DashboardHome user={session} /> : null}
        {page === "patients" ? <PatientsPage token={session.token} doctorId={session.userId} /> : null}
        {page === "appointments" ? <AppointmentsPage token={session.token} doctorId={session.userId} /> : null}
        {page === "consents" ? <ConsentsPage token={session.token} doctorId={session.userId} /> : null}
        {page === "odontogram" ? <OdontogramPage token={session.token} doctorId={session.userId} /> : null}
        {page === "plans" ? <PlansPage token={session.token} doctorId={session.userId} /> : null}
        {page === "testing" ? <ServiceTester session={session} onSessionChange={setSession} /> : null}
      </section>
    </main>
  );
}

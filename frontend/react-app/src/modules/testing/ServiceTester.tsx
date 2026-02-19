import { FormEvent, useMemo, useState } from "react";
import { clinicalApi } from "../../api/clinical";
import { clearApiBaseUrl, endpointCatalog, getApiConfig, setApiBaseUrl } from "../../lib/config";
import { clearSession } from "../../lib/session";
import type { AuthSession } from "../../types";

type LogItem = {
  at: string;
  title: string;
  payload: unknown;
};

export function ServiceTester({
  session,
  onSessionChange
}: {
  session: AuthSession;
  onSessionChange: (value: AuthSession | null) => void;
}) {
  const [doctorId, setDoctorId] = useState<string>(session.userId);
  const [apiInput, setApiInput] = useState<string>(getApiConfig().baseUrl);
  const [apiSource, setApiSource] = useState<string>(getApiConfig().source);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState<string>("");

  const endpointRows = useMemo<Array<[string, string]>>(
    () => [
      ["Health", endpointCatalog.health],
      ["Registro", endpointCatalog.register],
      ["Login", endpointCatalog.login],
      ["Forgot", endpointCatalog.forgotPassword],
      ["Reset", endpointCatalog.resetPassword],
      ["Onboard paciente", endpointCatalog.patientOnboard],
      ["Crear cita", endpointCatalog.createAppointment],
      ["Listar citas", endpointCatalog.listAppointments],
      ["Crear consentimiento", endpointCatalog.createConsent],
      ["Crear odontograma", endpointCatalog.createOdontogram],
      ["Crear plan", endpointCatalog.createTreatmentPlan]
    ],
    []
  );

  function pushLog(title: string, payload: unknown) {
    setLogs((prev: LogItem[]) => [{ at: new Date().toISOString(), title, payload }, ...prev].slice(0, 100));
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    try {
      setLoading(label);
      const result = await fn();
      pushLog(label, result);
    } catch (error) {
      pushLog(`${label} (error)`, { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading("");
    }
  }

  function updateApiConfig() {
    setApiBaseUrl(apiInput);
    const cfg = getApiConfig();
    setApiSource(cfg.source);
    pushLog("API base actualizada", cfg);
  }

  function resetApiConfig() {
    clearApiBaseUrl();
    const cfg = getApiConfig();
    setApiInput(cfg.baseUrl);
    setApiSource(cfg.source);
    pushLog("API base reseteada", cfg);
  }

  function logoutFromTester() {
    clearSession();
    onSessionChange(null);
  }

  async function onForgot(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await run("Forgot password", () => clinicalApi.forgotPassword({ email: String(fd.get("email") || "") }));
  }

  async function onReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await run("Reset password", () =>
      clinicalApi.resetPassword({
        token: String(fd.get("token") || ""),
        newPassword: String(fd.get("newPassword") || "")
      })
    );
  }

  async function onPatient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await run("Onboarding paciente", () =>
      clinicalApi.onboardPatient(
        {
          doctorId: String(fd.get("doctorId") || doctorId),
          specialty: String(fd.get("specialty") || "odontology"),
          firstName: String(fd.get("firstName") || ""),
          lastName: String(fd.get("lastName") || ""),
          documentId: String(fd.get("documentId") || ""),
          phone: String(fd.get("phone") || ""),
          email: String(fd.get("email") || ""),
          birthDate: String(fd.get("birthDate") || ""),
          medicalBackgrounds: [],
          imageKeys: []
        },
        session.token
      )
    );
  }

  async function onAppointment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await run("Crear cita", () =>
      clinicalApi.createAppointment(
        {
          doctorId: String(fd.get("doctorId") || doctorId),
          patientId: String(fd.get("patientId") || ""),
          startAt: new Date(String(fd.get("startAt") || "")).toISOString(),
          endAt: new Date(String(fd.get("endAt") || "")).toISOString(),
          treatmentPlan: String(fd.get("treatmentPlan") || ""),
          paymentAmount: Number(fd.get("paymentAmount") || 0),
          paymentMethod: String(fd.get("paymentMethod") || "")
        },
        session.token
      )
    );
  }

  async function onConsent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await run("Crear consentimiento", () =>
      clinicalApi.createConsent(
        {
          doctorId: String(fd.get("doctorId") || doctorId),
          patientId: String(fd.get("patientId") || ""),
          title: String(fd.get("title") || ""),
          content: String(fd.get("content") || ""),
          deliveryMethod: String(fd.get("deliveryMethod") || "email") as "email" | "sms"
        },
        session.token
      )
    );
  }

  async function onOdontogram(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await run("Crear odontograma", () =>
      clinicalApi.createOdontogram(
        {
          doctorId: String(fd.get("doctorId") || doctorId),
          patientId: String(fd.get("patientId") || "")
        },
        session.token
      )
    );
  }

  async function onTreatmentPlan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await run("Crear plan", () =>
      clinicalApi.createTreatmentPlan(
        {
          doctorId: String(fd.get("doctorId") || doctorId),
          patientId: String(fd.get("patientId") || ""),
          odontogramId: String(fd.get("odontogramId") || ""),
          title: String(fd.get("title") || ""),
          description: String(fd.get("description") || "")
        },
        session.token
      )
    );
  }

  return (
    <section className="page-section">
      <header className="page-header">
        <h2>Módulo de testing</h2>
        <p>Conserva y centraliza las pruebas de servicios backend sin afectar el flujo del dashboard.</p>
      </header>

      <div className="tester-grid">
        <article className="card-form glass">
          <h3>Configuración API</h3>
          <input value={apiInput} onChange={(e) => setApiInput(e.target.value)} placeholder="https://api-url" />
          <div className="inline-actions">
            <button type="button" onClick={updateApiConfig}>Guardar URL</button>
            <button type="button" className="ghost" onClick={resetApiConfig}>Reset</button>
            <button type="button" className="ghost" onClick={logoutFromTester}>Cerrar sesión</button>
          </div>
          <small>Origen: {apiSource}</small>
          <label>
            Doctor ID
            <input value={doctorId} onChange={(e) => setDoctorId(e.target.value)} placeholder="usr_*" />
          </label>
          <button type="button" onClick={() => run("Health check", clinicalApi.health)}>
            Test /health
          </button>
        </article>

        <form className="card-form glass" onSubmit={onForgot}>
          <h3>Forgot password</h3>
          <input name="email" type="email" placeholder="Email" required />
          <button type="submit">Generar token</button>
        </form>

        <form className="card-form glass" onSubmit={onReset}>
          <h3>Reset password</h3>
          <input name="token" placeholder="Token" required />
          <input name="newPassword" type="password" placeholder="Nueva password" required minLength={8} />
          <button type="submit">Actualizar password</button>
        </form>

        <form className="card-form glass" onSubmit={onPatient}>
          <h3>Onboarding paciente</h3>
          <input name="doctorId" placeholder="Doctor ID (opcional)" />
          <input name="specialty" defaultValue="odontology" placeholder="Especialidad" />
          <input name="firstName" placeholder="Nombre" required />
          <input name="lastName" placeholder="Apellido" required />
          <input name="documentId" placeholder="Documento" />
          <input name="phone" placeholder="Teléfono" />
          <input name="email" type="email" placeholder="Email" />
          <input name="birthDate" placeholder="YYYY-MM-DD" />
          <button type="submit">Crear paciente</button>
        </form>

        <form className="card-form glass" onSubmit={onAppointment}>
          <h3>Crear cita</h3>
          <input name="doctorId" placeholder="Doctor ID (opcional)" />
          <input name="patientId" placeholder="Patient ID" required />
          <input name="startAt" type="datetime-local" required />
          <input name="endAt" type="datetime-local" required />
          <input name="treatmentPlan" placeholder="Plan" />
          <input name="paymentAmount" type="number" step="0.01" placeholder="Monto" />
          <input name="paymentMethod" placeholder="Método pago" />
          <button type="submit">Crear cita</button>
        </form>

        <form className="card-form glass" onSubmit={onConsent}>
          <h3>Consentimiento</h3>
          <input name="doctorId" placeholder="Doctor ID (opcional)" />
          <input name="patientId" placeholder="Patient ID" required />
          <input name="title" placeholder="Título" required />
          <select name="deliveryMethod" defaultValue="email">
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
          <textarea name="content" placeholder="Contenido" required />
          <button type="submit">Enviar consentimiento</button>
        </form>

        <form className="card-form glass" onSubmit={onOdontogram}>
          <h3>Crear odontograma</h3>
          <input name="doctorId" placeholder="Doctor ID (opcional)" />
          <input name="patientId" placeholder="Patient ID" required />
          <button type="submit">Crear odontograma</button>
        </form>

        <form className="card-form glass" onSubmit={onTreatmentPlan}>
          <h3>Crear plan tratamiento</h3>
          <input name="doctorId" placeholder="Doctor ID (opcional)" />
          <input name="patientId" placeholder="Patient ID" required />
          <input name="odontogramId" placeholder="Odontogram ID" />
          <input name="title" placeholder="Título" required />
          <textarea name="description" placeholder="Descripción" />
          <button type="submit">Crear plan</button>
        </form>
      </div>

      <article className="card-form glass">
        <h3>Catálogo de endpoints</h3>
        <div className="endpoint-list">
          {endpointRows.map(([label, endpoint]) => (
            <div key={label} className="endpoint-row">
              <span>{label}</span>
              <code>{endpoint}</code>
            </div>
          ))}
        </div>
      </article>

      <article className="card-form glass">
        <h3>Actividad {loading ? `(ejecutando: ${loading})` : ""}</h3>
        <div className="log-list">
          {logs.map((item) => (
            <article key={`${item.at}-${item.title}`} className="log-item">
              <strong>{item.title}</strong>
              <small>{item.at}</small>
              <pre>{JSON.stringify(item.payload, null, 2)}</pre>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}

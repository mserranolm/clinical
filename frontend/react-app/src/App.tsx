import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { clinicalApi } from "./api/clinical";
import { clearSession, getSession, saveSession } from "./lib/session";
import { ServiceTester } from "./modules/testing/ServiceTester";
import type { AuthSession } from "./types";

type ActionState = {
  status: "idle" | "loading" | "success" | "error";
  title: string;
  payload?: unknown;
};

type AppointmentRow = {
  id: string;
  patientId: string;
  startAt: string;
  status: string;
  paymentAmount?: number;
};

const initialSession = getSession();

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

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
  const [date, setDate] = useState<string>(todayISO());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [rows, setRows] = useState<AppointmentRow[]>([]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const result = await clinicalApi.listAppointments(user.userId, date, user.token);
        if (!ignore) {
          setRows(
            result.items.map((item) => ({
              id: item.id,
              patientId: item.patientId,
              startAt: item.startAt,
              status: item.status,
              paymentAmount: item.paymentAmount
            }))
          );
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "No fue posible cargar citas");
          setRows([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [date, user.token, user.userId]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const confirmed = rows.filter((r) => r.status === "confirmed").length;
    const completed = rows.filter((r) => r.status === "completed").length;
    const revenue = rows.reduce((acc, row) => acc + Number(row.paymentAmount || 0), 0);
    return [
      { label: "Citas del día", value: String(total), trend: loading ? "Cargando..." : "Data real" },
      { label: "Confirmadas", value: String(confirmed), trend: "Estado" },
      { label: "Completadas", value: String(completed), trend: "Seguimiento" },
      { label: "Ingresos del día", value: `$ ${revenue.toFixed(2)}`, trend: "Facturación" }
    ];
  }, [loading, rows]);

  return (
    <section className="page-section">
      <header className="page-header">
        <h2>Panel de administración</h2>
        <p>Bienvenido, {user.name || user.email}. Gestiona toda la operación clínica desde un solo lugar.</p>
        <div className="inline-actions">
          <label>
            Fecha KPI
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
      </header>
      <div className="stats-grid">
        {kpis.map((card) => (
          <article key={card.label} className="stat-card">
            <small>{card.label}</small>
            <h3>{card.value}</h3>
            <span>{card.trend}</span>
          </article>
        ))}
      </div>
      <article className="chart-card">
        <h3>Citas del día (listado real)</h3>
        {error ? <small className="error-text">{error}</small> : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Paciente</th>
                <th>Inicio</th>
                <th>Estado</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.patientId}</td>
                  <td>{new Date(row.startAt).toLocaleString()}</td>
                  <td>{row.status}</td>
                  <td>{Number(row.paymentAmount || 0).toFixed(2)}</td>
                </tr>
              ))}
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5}>Sin datos para la fecha seleccionada</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function PatientsPage({ token, doctorId }: { token: string; doctorId: string }) {
  const [state, setState] = useState<ActionState>({ status: "idle", title: "" });
  const [searchId, setSearchId] = useState<string>("");
  const [rows, setRows] = useState<Array<{ id: string; name: string; email?: string; phone?: string }>>([]);

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
      setRows((prev) => [{ id: String(result.id), name: "Nuevo paciente" }, ...prev]);
    } catch (error) {
      setState({ status: "error", title: "Error creando paciente", payload: { error: String(error) } });
    }
  }

  async function onFindPatient() {
    if (!searchId.trim()) return;
    setState({ status: "loading", title: "Buscando paciente..." });
    try {
      const result = await clinicalApi.getPatient(searchId.trim(), token);
      setRows((prev) => [
        {
          id: result.id,
          name: `${result.firstName} ${result.lastName}`,
          email: result.email,
          phone: result.phone
        },
        ...prev.filter((item) => item.id !== result.id)
      ]);
      setState({ status: "success", title: "Paciente encontrado", payload: result });
    } catch (error) {
      setState({ status: "error", title: "Error buscando paciente", payload: { error: String(error) } });
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
      <article className="card-form">
        <h3>Buscar paciente por ID</h3>
        <div className="inline-actions">
          <input value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="pat_*" />
          <button type="button" onClick={onFindPatient}>Buscar</button>
        </div>
      </article>
      <article className="chart-card">
        <h3>Listado de pacientes consultados</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Email</th>
                <th>Teléfono</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.name}</td>
                  <td>{row.email || "-"}</td>
                  <td>{row.phone || "-"}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4}>Aún no hay pacientes en el listado</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
      <SectionResult state={state} />
    </section>
  );
}

function AppointmentsPage({ token, doctorId }: { token: string; doctorId: string }) {
  const [state, setState] = useState<ActionState>({ status: "idle", title: "" });
  const [date, setDate] = useState<string>(todayISO());
  const [rows, setRows] = useState<AppointmentRow[]>([]);

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
      await loadAppointments();
    } catch (error) {
      setState({ status: "error", title: "Error creando cita", payload: { error: String(error) } });
    }
  }

  async function loadAppointments() {
    setState({ status: "loading", title: "Cargando citas..." });
    try {
      const result = await clinicalApi.listAppointments(doctorId, date, token);
      setRows(
        result.items.map((item) => ({
          id: item.id,
          patientId: item.patientId,
          startAt: item.startAt,
          status: item.status,
          paymentAmount: item.paymentAmount
        }))
      );
      setState({ status: "success", title: "Listado actualizado", payload: { total: result.items.length } });
    } catch (error) {
      setState({ status: "error", title: "Error listando citas", payload: { error: String(error) } });
      setRows([]);
    }
  }

  async function onConfirm(id: string) {
    await clinicalApi.confirmAppointment(id, token);
    await loadAppointments();
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
      <article className="card-form">
        <h3>Listado de citas</h3>
        <div className="inline-actions">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button type="button" onClick={loadAppointments}>Refrescar</button>
        </div>
      </article>
      <article className="chart-card">
        <h3>Citas por doctor/día</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Paciente</th>
                <th>Inicio</th>
                <th>Estado</th>
                <th>Monto</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.patientId}</td>
                  <td>{new Date(row.startAt).toLocaleString()}</td>
                  <td>{row.status}</td>
                  <td>{Number(row.paymentAmount || 0).toFixed(2)}</td>
                  <td>
                    <button type="button" className="ghost" onClick={() => onConfirm(row.id)}>
                      Confirmar
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6}>Sin citas para mostrar</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
      <SectionResult state={state} />
    </section>
  );
}

function ConsentsPage({ token, doctorId }: { token: string; doctorId: string }) {
  const [state, setState] = useState<ActionState>({ status: "idle", title: "" });
  const [verifyId, setVerifyId] = useState<string>("");
  const [rows, setRows] = useState<Array<{ id: string; status: string; title?: string }>>([]);

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
      setRows((prev) => [{ id: result.id, status: result.status, title: result.title }, ...prev]);
      e.currentTarget.reset();
    } catch (error) {
      setState({ status: "error", title: "Error enviando consentimiento", payload: { error: String(error) } });
    }
  }

  async function onVerify() {
    if (!verifyId.trim()) return;
    setState({ status: "loading", title: "Verificando consentimiento..." });
    try {
      const result = await clinicalApi.verifyConsent(verifyId.trim());
      setRows((prev) => [{ id: result.id, status: result.status }, ...prev.filter((r) => r.id !== result.id)]);
      setState({ status: "success", title: "Consentimiento verificado", payload: result });
    } catch (error) {
      setState({ status: "error", title: "Error verificando consentimiento", payload: { error: String(error) } });
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
      <article className="card-form">
        <h3>Verificar consentimiento</h3>
        <div className="inline-actions">
          <input value={verifyId} onChange={(e) => setVerifyId(e.target.value)} placeholder="cns_*" />
          <button type="button" onClick={onVerify}>Verificar</button>
        </div>
      </article>
      <article className="chart-card">
        <h3>Listado de consentimientos</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Título</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.title || "-"}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3}>Sin consentimientos en memoria de vista</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
      <SectionResult state={state} />
    </section>
  );
}

function OdontogramPage({ token, doctorId }: { token: string; doctorId: string }) {
  const [state, setState] = useState<ActionState>({ status: "idle", title: "" });
  const [patientId, setPatientId] = useState<string>("");
  const [rows, setRows] = useState<Array<{ id: string; patientId: string; teeth: number }>>([]);

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
      setRows((prev) => [{ id: result.id, patientId: result.patientId, teeth: 32 }, ...prev]);
      e.currentTarget.reset();
    } catch (error) {
      setState({ status: "error", title: "Error creando odontograma", payload: { error: String(error) } });
    }
  }

  async function onFind() {
    if (!patientId.trim()) return;
    setState({ status: "loading", title: "Consultando odontograma..." });
    try {
      const result = await clinicalApi.getOdontogramByPatient(patientId.trim(), token);
      const teethCount = Array.isArray(result.teeth) ? result.teeth.length : 0;
      setRows((prev) => [
        { id: result.id, patientId: result.patientId, teeth: teethCount },
        ...prev.filter((r) => r.id !== result.id)
      ]);
      setState({ status: "success", title: "Odontograma encontrado", payload: result });
    } catch (error) {
      setState({ status: "error", title: "Error consultando odontograma", payload: { error: String(error) } });
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
      <article className="card-form">
        <h3>Consultar por paciente</h3>
        <div className="inline-actions">
          <input value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="pat_*" />
          <button type="button" onClick={onFind}>Consultar</button>
        </div>
      </article>
      <article className="chart-card">
        <h3>Listado odontogramas</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Paciente</th>
                <th>Dientes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.patientId}</td>
                  <td>{row.teeth}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3}>Sin odontogramas en el listado</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
      <SectionResult state={state} />
    </section>
  );
}

function PlansPage({ token, doctorId }: { token: string; doctorId: string }) {
  const [state, setState] = useState<ActionState>({ status: "idle", title: "" });
  const [planId, setPlanId] = useState<string>("");
  const [patientId, setPatientId] = useState<string>("");
  const [rows, setRows] = useState<Array<{ id: string; title: string; status?: string; patientId: string }>>([]);

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
      setRows((prev) => [
        { id: result.id, title: "Nuevo plan", status: result.status, patientId: result.patientId },
        ...prev
      ]);
      e.currentTarget.reset();
    } catch (error) {
      setState({ status: "error", title: "Error creando plan", payload: { error: String(error) } });
    }
  }

  async function onGetById() {
    if (!planId.trim()) return;
    setState({ status: "loading", title: "Consultando plan..." });
    try {
      const result = await clinicalApi.getTreatmentPlan(planId.trim(), token);
      setRows((prev) => [
        { id: result.id, title: result.title, status: result.status, patientId: result.patientId },
        ...prev.filter((p) => p.id !== result.id)
      ]);
      setState({ status: "success", title: "Plan consultado", payload: result });
    } catch (error) {
      setState({ status: "error", title: "Error consultando plan", payload: { error: String(error) } });
    }
  }

  async function onGetByPatient() {
    if (!patientId.trim()) return;
    setState({ status: "loading", title: "Consultando planes por paciente..." });
    try {
      const result = await clinicalApi.getTreatmentPlansByPatient(patientId.trim(), token);
      setRows(result.treatmentPlans.map((p) => ({ id: p.id, title: p.title, status: p.status, patientId: p.patientId })));
      setState({ status: "success", title: "Planes cargados", payload: { total: result.treatmentPlans.length } });
    } catch (error) {
      setState({ status: "error", title: "Error consultando planes", payload: { error: String(error) } });
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
      <article className="card-form">
        <h3>Consultas</h3>
        <div className="inline-actions">
          <input value={planId} onChange={(e) => setPlanId(e.target.value)} placeholder="planId" />
          <button type="button" onClick={onGetById}>Buscar por ID</button>
        </div>
        <div className="inline-actions">
          <input value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="patientId" />
          <button type="button" onClick={onGetByPatient}>Listar por paciente</button>
        </div>
      </article>
      <article className="chart-card">
        <h3>Listado de planes</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Paciente</th>
                <th>Título</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.patientId}</td>
                  <td>{row.title}</td>
                  <td>{row.status || "-"}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4}>Sin planes para mostrar</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
      <SectionResult state={state} />
    </section>
  );
}

function LoginView({
  onSuccess
}: {
  onSuccess: (session: AuthSession) => void;
}) {
  const navigate = useNavigate();
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
      navigate("/dashboard");
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
        <button className="link-btn" type="button" onClick={() => navigate("/")}>
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

function Landing() {
  const navigate = useNavigate();
  return (
    <main className="landing-page">
      <header className="landing-top">
        <h1>CliniSense Admin Suite</h1>
        <button onClick={() => navigate("/login")}>Acceder</button>
      </header>
      <section className="hero">
        <div>
          <h2>Gestión clínica moderna para equipos odontológicos</h2>
          <p>
            Administra pacientes, citas, consentimientos, odontogramas y planes de tratamiento desde un dashboard
            visual, rápido y seguro.
          </p>
          <div className="hero-actions">
            <button onClick={() => navigate("/login")}>Iniciar sesión</button>
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

function DashboardLayout({ session, onLogout }: { session: AuthSession; onLogout: () => void }) {
  const location = useLocation();

  const menu = useMemo<Array<{ to: string; label: string }>>(
    () => [
      { to: "/dashboard", label: "Dashboard" },
      { to: "/dashboard/pacientes", label: "Pacientes" },
      { to: "/dashboard/citas", label: "Citas" },
      { to: "/dashboard/consentimientos", label: "Consentimientos" },
      { to: "/dashboard/odontograma", label: "Odontograma" },
      { to: "/dashboard/planes", label: "Planes" },
      { to: "/dashboard/testing", label: "Service Tester" }
    ],
    []
  );

  const current = menu.find((item) => item.to === location.pathname)?.label || "Dashboard";

  return (
    <main className="admin-layout">
      <aside className="sidebar">
        <h2>CliniSense</h2>
        <small>Administrador</small>
        <nav>
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <section className="content-area">
        <header className="topbar">
          <div>
            <h1>{current}</h1>
            <p>{session.email}</p>
          </div>
          <button className="ghost" onClick={onLogout}>Cerrar sesión</button>
        </header>

        <Routes>
          <Route index element={<DashboardHome user={session} />} />
          <Route path="pacientes" element={<PatientsPage token={session.token} doctorId={session.userId} />} />
          <Route path="citas" element={<AppointmentsPage token={session.token} doctorId={session.userId} />} />
          <Route
            path="consentimientos"
            element={<ConsentsPage token={session.token} doctorId={session.userId} />}
          />
          <Route path="odontograma" element={<OdontogramPage token={session.token} doctorId={session.userId} />} />
          <Route path="planes" element={<PlansPage token={session.token} doctorId={session.userId} />} />
          <Route path="testing" element={<ServiceTester session={session} onSessionChange={() => onLogout()} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </section>
    </main>
  );
}

export function App() {
  const [session, setSession] = useState<AuthSession | null>(initialSession);

  function handleAuthSuccess(nextSession: AuthSession) {
    saveSession(nextSession);
    setSession(nextSession);
  }

  function handleLogout() {
    clearSession();
    setSession(null);
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <LoginView onSuccess={handleAuthSuccess} />} />
      <Route
        path="/dashboard/*"
        element={session ? <DashboardLayout session={session} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to={session ? "/dashboard" : "/"} replace />} />
    </Routes>
  );
}

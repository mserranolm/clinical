const API_BASE = window.localStorage.getItem("clinical_api") || "http://localhost:3000";

const logNode = document.getElementById("log");
const clearLogBtn = document.getElementById("clearLog");
const logoutBtn = document.getElementById("logoutBtn");
const topLoginBtn = document.getElementById("topLoginBtn");
const heroStartBtn = document.getElementById("heroStartBtn");

const landingSection = document.getElementById("landingSection");
const workspaceSection = document.getElementById("workspaceSection");
const authDock = document.getElementById("authDock");

const smsFlag = document.getElementById("smsFlag");
const emailFlag = document.getElementById("emailFlag");

const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const tabForgot = document.getElementById("tabForgot");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const forgotForm = document.getElementById("forgotForm");
const resetForm = document.getElementById("resetForm");

const forms = {
  patient: document.getElementById("patientForm"),
  appointment: document.getElementById("appointmentForm"),
  consent: document.getElementById("consentForm")
};

let session = {
  token: window.localStorage.getItem("clinical_token") || "",
  userId: window.localStorage.getItem("clinical_user_id") || ""
};

function appendLog(title, payload) {
  const line = `[${new Date().toISOString()}] ${title}\n${JSON.stringify(payload, null, 2)}\n\n`;
  logNode.textContent = line + logNode.textContent;
}

function openAuth(mode) {
  if (authDock) authDock.classList.remove("hidden");
  setAuthView(mode);
}

async function api(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {})
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

function toRFC3339(localDateTime) {
  return new Date(localDateTime).toISOString();
}

function setAuthView(mode) {
  const formsMap = {
    login: loginForm,
    register: registerForm,
    forgot: forgotForm,
    reset: resetForm
  };
  [loginForm, registerForm, forgotForm, resetForm].forEach((form) => form.classList.add("hidden"));
  formsMap[mode].classList.remove("hidden");

  [tabLogin, tabRegister, tabForgot].forEach((tab) => tab.classList.remove("active"));
  if (mode === "login") tabLogin.classList.add("active");
  if (mode === "register") tabRegister.classList.add("active");
  if (mode === "forgot" || mode === "reset") tabForgot.classList.add("active");
}

function setLoggedState(isLogged) {
  landingSection.classList.toggle("hidden", isLogged);
  workspaceSection.classList.toggle("hidden", !isLogged);
  logoutBtn.classList.toggle("hidden", !isLogged);
  if (topLoginBtn) topLoginBtn.classList.toggle("hidden", isLogged);
}

tabLogin.addEventListener("click", () => openAuth("login"));
tabRegister.addEventListener("click", () => openAuth("register"));
tabForgot.addEventListener("click", () => openAuth("forgot"));

if (topLoginBtn) {
  topLoginBtn.addEventListener("click", () => {
    window.location.href = "./login.html";
  });
}

if (heroStartBtn) {
  heroStartBtn.addEventListener("click", () => {
    window.location.href = "./login.html?mode=register";
  });
}

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(registerForm).entries());
  try {
    const data = await api("/auth/register", payload);
    appendLog("Usuario registrado", data);
    setAuthView("login");
  } catch (error) {
    appendLog("Error registro", error);
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(loginForm).entries());
  try {
    const data = await api("/auth/login", payload);
    session.token = data.accessToken;
    session.userId = data.userId;
    window.localStorage.setItem("clinical_token", session.token);
    window.localStorage.setItem("clinical_user_id", session.userId);
    setLoggedState(true);
    if (authDock) authDock.classList.add("hidden");
    appendLog("Login exitoso", data);
  } catch (error) {
    appendLog("Error login", error);
  }
});

forgotForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(forgotForm).entries());
  try {
    const data = await api("/auth/forgot-password", payload);
    appendLog("Token de recuperación generado", data);
    setAuthView("reset");
  } catch (error) {
    appendLog("Error recuperación", error);
  }
});

resetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(resetForm).entries());
  try {
    const data = await api("/auth/reset-password", payload);
    appendLog("Contraseña actualizada", data);
    setAuthView("login");
  } catch (error) {
    appendLog("Error reset", error);
  }
});

logoutBtn.addEventListener("click", () => {
  session = { token: "", userId: "" };
  window.localStorage.removeItem("clinical_token");
  window.localStorage.removeItem("clinical_user_id");
  setLoggedState(false);
  setAuthView("login");
  appendLog("Sesión cerrada", { ok: true });
});

forms.patient.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(forms.patient);
  const payload = Object.fromEntries(fd.entries());
  payload.medicalBackgrounds = payload.medicalNotes
    ? [{ type: "notes", description: payload.medicalNotes }]
    : [];
  delete payload.medicalNotes;
  payload.imageKeys = [];

  try {
    const data = await api("/patients/onboard", payload);
    appendLog("Paciente registrado", data);
  } catch (error) {
    appendLog("Error onboarding", error);
  }
});

forms.appointment.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(forms.appointment);
  const payload = Object.fromEntries(fd.entries());
  payload.startAt = toRFC3339(payload.startAt);
  payload.endAt = toRFC3339(payload.endAt);
  payload.paymentAmount = Number(payload.paymentAmount || 0);

  try {
    const data = await api("/appointments", payload);
    appendLog("Cita creada", data);

    const channel = smsFlag.checked ? "sms" : emailFlag.checked ? "email" : null;
    if (channel) {
      const reminder = await api(`/appointments/${data.id}/send-reminder`, { channel });
      appendLog("Recordatorio 24h solicitado", reminder);
    }
  } catch (error) {
    appendLog("Error cita", error);
  }
});

forms.consent.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(forms.consent);
  const payload = Object.fromEntries(fd.entries());

  if (payload.deliveryMethod === "sms" && !smsFlag.checked) {
    appendLog("Consentimiento", { error: "SMS deshabilitado por flag" });
    return;
  }
  if (payload.deliveryMethod === "email" && !emailFlag.checked) {
    appendLog("Consentimiento", { error: "Email deshabilitado por flag" });
    return;
  }

  try {
    const data = await api("/consents", payload);
    appendLog("Consentimiento enviado", data);
  } catch (error) {
    appendLog("Error consentimiento", error);
  }
});

clearLogBtn.addEventListener("click", () => {
  logNode.textContent = "";
});

appendLog("API configurada", { API_BASE });
setLoggedState(Boolean(session.token));
setAuthView("login");
if (!session.token && authDock) authDock.classList.add("hidden");

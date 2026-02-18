const API_BASE = window.localStorage.getItem("clinical_api") || "http://localhost:3000";

const pageLoginForm = document.getElementById("pageLoginForm");
const pageRegisterForm = document.getElementById("pageRegisterForm");
const pageForgotForm = document.getElementById("pageForgotForm");
const pageResetForm = document.getElementById("pageResetForm");
const showForgot = document.getElementById("showForgot");
const showRegister = document.getElementById("showRegister");
const backToLogin = document.getElementById("backToLogin");
const backToLoginWrap = document.getElementById("backToLoginWrap");
const pageLog = document.getElementById("pageLog");

function log(title, payload) {
  pageLog.textContent = `[${new Date().toISOString()}] ${title}\n${JSON.stringify(payload, null, 2)}`;
}

async function api(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

function showMode(mode) {
  [pageLoginForm, pageRegisterForm, pageForgotForm, pageResetForm].forEach((form) => form.classList.add("hidden"));

  if (mode === "register") pageRegisterForm.classList.remove("hidden");
  else if (mode === "forgot") pageForgotForm.classList.remove("hidden");
  else if (mode === "reset") pageResetForm.classList.remove("hidden");
  else pageLoginForm.classList.remove("hidden");

  backToLoginWrap.classList.toggle("hidden", mode === "login");
}

pageLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(pageLoginForm).entries());
  try {
    const data = await api("/auth/login", payload);
    window.localStorage.setItem("clinical_token", data.accessToken);
    window.localStorage.setItem("clinical_user_id", data.userId);
    log("Login exitoso", data);
    window.location.href = "./index.html";
  } catch (error) {
    log("Error login", error);
  }
});

pageRegisterForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(pageRegisterForm).entries());
  try {
    const data = await api("/auth/register", payload);
    log("Usuario registrado", data);
    showMode("login");
  } catch (error) {
    log("Error registro", error);
  }
});

pageForgotForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(pageForgotForm).entries());
  try {
    const data = await api("/auth/forgot-password", payload);
    log("Token generado", data);
    showMode("reset");
  } catch (error) {
    log("Error recuperación", error);
  }
});

pageResetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(pageResetForm).entries());
  try {
    const data = await api("/auth/reset-password", payload);
    log("Contraseña actualizada", data);
    showMode("login");
  } catch (error) {
    log("Error reset", error);
  }
});

showForgot.addEventListener("click", () => showMode("forgot"));
showRegister.addEventListener("click", () => showMode("register"));
backToLogin.addEventListener("click", () => showMode("login"));

const mode = new URLSearchParams(window.location.search).get("mode");
if (mode === "register") showMode("register");
else showMode("login");

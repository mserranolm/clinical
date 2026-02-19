const DEFAULT_LOCAL = "http://localhost:3000";
const DEFAULT_PROD = "https://egsnzyxipf.execute-api.us-east-1.amazonaws.com/prod";

const STORAGE_KEY = "clinical_api_base_url";

export const endpointCatalog = {
  health: "/health",
  register: "/auth/register",
  login: "/auth/login",
  forgotPassword: "/auth/forgot-password",
  resetPassword: "/auth/reset-password",
  patientOnboard: "/patients/onboard",
  listPatients: "/patients",
  searchPatients: "/patients/search",
  getPatient: (patientId: string) => `/patients/${patientId}`,
  createAppointment: "/appointments",
  listAppointments: "/appointments",
  confirmAppointment: (appointmentId: string) => `/appointments/${appointmentId}/confirm`,
  closeAppointmentDay: (appointmentId: string) => `/appointments/${appointmentId}/close-day`,
  createConsent: "/consents",
  verifyConsent: (consentId: string) => `/consents/verify/${consentId}`,
  createOdontogram: "/odontograms",
  getOdontogramByPatient: (patientId: string) => `/odontograms/patient/${patientId}`,
  updateOdontogram: "/odontograms",
  createTreatmentPlan: "/treatment-plans",
  getTreatmentPlan: (planId: string) => `/treatment-plans/${planId}`,
  getTreatmentPlansByPatient: (patientId: string) => `/treatment-plans/patient/${patientId}`,
  updateTreatmentPlan: "/treatment-plans"
};

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, "");
}

export function getApiBaseUrl(): string {
  const envValue = import.meta.env.VITE_API_BASE_URL;
  if (envValue && typeof envValue === "string") {
    return normalizeUrl(envValue);
  }

  const runtime = window.localStorage.getItem(STORAGE_KEY);
  if (runtime) {
    return normalizeUrl(runtime);
  }

  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return DEFAULT_PROD;
  }

  return DEFAULT_LOCAL;
}

export function setApiBaseUrl(url: string): void {
  const normalized = normalizeUrl(url.trim());
  window.localStorage.setItem(STORAGE_KEY, normalized);
}

export function clearApiBaseUrl(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function getApiConfig() {
  const envValue = import.meta.env.VITE_API_BASE_URL;
  const runtime = window.localStorage.getItem(STORAGE_KEY);

  return {
    baseUrl: getApiBaseUrl(),
    source: envValue ? "env" : runtime ? "localStorage" : "default"
  };
}

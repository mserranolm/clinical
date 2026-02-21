import type { AuthSession } from "../types";

type Role = "platform_admin" | "admin" | "doctor" | "assistant" | string;

function role(session: AuthSession | null | undefined): Role {
  return String(session?.role || "").toLowerCase();
}

export function isPlatformAdmin(session: AuthSession | null | undefined): boolean {
  return role(session) === "platform_admin";
}

export function isOrgAdmin(session: AuthSession | null | undefined): boolean {
  return role(session) === "admin";
}

export function isDoctor(session: AuthSession | null | undefined): boolean {
  return role(session) === "doctor";
}

export function isAssistant(session: AuthSession | null | undefined): boolean {
  return role(session) === "assistant";
}

// Patients
export function canViewPatients(session: AuthSession | null | undefined): boolean {
  const r = role(session);
  return r === "platform_admin" || r === "admin" || r === "doctor" || r === "assistant";
}

export function canWritePatients(session: AuthSession | null | undefined): boolean {
  const r = role(session);
  return r === "platform_admin" || r === "admin" || r === "doctor";
}

export function canDeletePatients(session: AuthSession | null | undefined): boolean {
  const r = role(session);
  return r === "platform_admin" || r === "admin";
}

// Appointments
export function canWriteAppointments(session: AuthSession | null | undefined): boolean {
  const r = role(session);
  return r === "admin" || r === "doctor" || r === "assistant";
}

// Crear cita: platform_admin NO puede crear citas (no pertenece a una org)
export function canCreateAppointments(session: AuthSession | null | undefined): boolean {
  const r = role(session);
  return r === "admin" || r === "doctor" || r === "assistant";
}

export function canDeleteAppointments(session: AuthSession | null | undefined): boolean {
  const r = role(session);
  return r === "admin";
}

// Users management (invite, edit org users)
export function canManageUsers(session: AuthSession | null | undefined): boolean {
  const r = role(session);
  return r === "platform_admin" || r === "admin";
}

// Atender consulta (iniciar tratamiento) — admin org y doctor
export function canManageTreatments(session: AuthSession | null | undefined): boolean {
  const r = role(session);
  return r === "admin" || r === "doctor";
}

// Ver Documentos / Odontograma / Tratamientos en sidebar — solo admin org
export function canViewClinicalTools(session: AuthSession | null | undefined): boolean {
  const r = role(session);
  return r === "admin";
}

// Admin org puede actuar como doctor (asignarse citas a sí mismo)
export function canActAsDoctor(session: AuthSession | null | undefined): boolean {
  const r = role(session);
  return r === "admin" || r === "doctor";
}

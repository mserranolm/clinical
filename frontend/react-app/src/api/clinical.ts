import { endpointCatalog } from "../lib/config";
import { request } from "../lib/http";
import {
  type CreateAppointmentInput,
  type CreateConsentInput,
  type CreateOdontogramInput,
  type CreatePatientInput,
  type CreateTreatmentPlanInput,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput
} from "../types";

export type AppointmentDTO = {
  id: string;
  doctorId: string;
  patientId: string;
  startAt: string;
  endAt: string;
  status: string;
  paymentAmount?: number;
  paymentMethod?: string;
};

export const clinicalApi = {
  health: () => request<{ status: string; message: string }>(endpointCatalog.health),

  register: (input: RegisterInput) =>
    request<{ userId: string; name: string; email: string; createdAt: string }>(endpointCatalog.register, {
      method: "POST",
      body: input
    }),

  login: (input: LoginInput) =>
    request<{ accessToken: string; userId: string; name: string; email: string }>(endpointCatalog.login, {
      method: "POST",
      body: input
    }),

  forgotPassword: (input: ForgotPasswordInput) =>
    request<{ resetToken: string; expiresAt: string }>(endpointCatalog.forgotPassword, {
      method: "POST",
      body: input
    }),

  resetPassword: (input: ResetPasswordInput) =>
    request<{ status: string }>(endpointCatalog.resetPassword, {
      method: "POST",
      body: input
    }),

  onboardPatient: (input: CreatePatientInput, token?: string) =>
    request<{ id: string }>(endpointCatalog.patientOnboard, {
      method: "POST",
      body: input,
      token
    }),

  getPatient: (patientId: string, token?: string) =>
    request<{ id: string; firstName: string; lastName: string; email?: string; phone?: string; doctorId: string }>(
      endpointCatalog.getPatient(patientId),
      {
        method: "GET",
        token
      }
    ),

  createAppointment: (input: CreateAppointmentInput, token?: string) =>
    request<{ id: string }>(endpointCatalog.createAppointment, {
      method: "POST",
      body: input,
      token
    }),

  listAppointments: (doctorId: string, date: string, token?: string) =>
    request<{ items: AppointmentDTO[] }>(
      `${endpointCatalog.listAppointments}?doctorId=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(date)}`,
      {
        method: "GET",
        token
      }
    ),

  confirmAppointment: (appointmentId: string, token?: string) =>
    request<AppointmentDTO>(endpointCatalog.confirmAppointment(appointmentId), {
      method: "POST",
      token
    }),

  closeAppointmentDay: (
    appointmentId: string,
    payload: { evolutionNotes: string; paymentAmount: number; paymentMethod: string },
    token?: string
  ) =>
    request<AppointmentDTO>(endpointCatalog.closeAppointmentDay(appointmentId), {
      method: "POST",
      body: payload,
      token
    }),

  createConsent: (input: CreateConsentInput, token?: string) =>
    request<{ id: string; status: string; title: string; patientId: string }>(endpointCatalog.createConsent, {
      method: "POST",
      body: input,
      token
    }),

  verifyConsent: (consentId: string) =>
    request<{ id: string; status: string; acceptedAt?: string }>(endpointCatalog.verifyConsent(consentId), {
      method: "GET"
    }),

  createOdontogram: (input: CreateOdontogramInput, token?: string) =>
    request<{ id: string; patientId: string; doctorId: string }>(endpointCatalog.createOdontogram, {
      method: "POST",
      body: input,
      token
    }),

  getOdontogramByPatient: (patientId: string, token?: string) =>
    request<{ id: string; patientId: string; doctorId: string; teeth?: unknown[] }>(
      endpointCatalog.getOdontogramByPatient(patientId),
      {
        method: "GET",
        token
      }
    ),

  createTreatmentPlan: (input: CreateTreatmentPlanInput, token?: string) =>
    request<{ id: string; patientId: string; doctorId: string; status?: string }>(endpointCatalog.createTreatmentPlan, {
      method: "POST",
      body: input,
      token
    }),

  getTreatmentPlan: (planId: string, token?: string) =>
    request<{ id: string; patientId: string; doctorId: string; title: string; status?: string }>(
      endpointCatalog.getTreatmentPlan(planId),
      {
        method: "GET",
        token
      }
    ),

  getTreatmentPlansByPatient: (patientId: string, token?: string) =>
    request<{ treatmentPlans: Array<{ id: string; title: string; status?: string; patientId: string }> }>(
      endpointCatalog.getTreatmentPlansByPatient(patientId),
      {
        method: "GET",
        token
      }
    ),

  // legacy section (kept for backwards compatibility with earlier imports)
  _legacyGetPatient: (patientId: string, token?: string) =>
    request(endpointCatalog.getPatient(patientId), {
      method: "GET",
      token
    }),
};

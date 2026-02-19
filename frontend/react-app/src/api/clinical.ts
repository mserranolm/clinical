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
import { endpointCatalog } from "../lib/config";
import { request } from "../lib/http";

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
    request(endpointCatalog.getPatient(patientId), {
      method: "GET",
      token
    }),

  createAppointment: (input: CreateAppointmentInput, token?: string) =>
    request<{ id: string }>(endpointCatalog.createAppointment, {
      method: "POST",
      body: input,
      token
    }),

  listAppointments: (doctorId: string, date: string, token?: string) =>
    request(
      `${endpointCatalog.listAppointments}?doctorId=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(date)}`,
      {
        method: "GET",
        token
      }
    ),

  confirmAppointment: (appointmentId: string, token?: string) =>
    request(endpointCatalog.confirmAppointment(appointmentId), {
      method: "POST",
      token
    }),

  closeAppointmentDay: (
    appointmentId: string,
    payload: { evolutionNotes: string; paymentAmount: number; paymentMethod: string },
    token?: string
  ) =>
    request(endpointCatalog.closeAppointmentDay(appointmentId), {
      method: "POST",
      body: payload,
      token
    }),

  createConsent: (input: CreateConsentInput, token?: string) =>
    request(endpointCatalog.createConsent, {
      method: "POST",
      body: input,
      token
    }),

  verifyConsent: (consentId: string) =>
    request(endpointCatalog.verifyConsent(consentId), {
      method: "GET"
    }),

  createOdontogram: (input: CreateOdontogramInput, token?: string) =>
    request(endpointCatalog.createOdontogram, {
      method: "POST",
      body: input,
      token
    }),

  getOdontogramByPatient: (patientId: string, token?: string) =>
    request(endpointCatalog.getOdontogramByPatient(patientId), {
      method: "GET",
      token
    }),

  createTreatmentPlan: (input: CreateTreatmentPlanInput, token?: string) =>
    request(endpointCatalog.createTreatmentPlan, {
      method: "POST",
      body: input,
      token
    })
};

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
    request<{ accessToken: string; userId: string; orgId: string; name: string; email: string; role: string }>(endpointCatalog.login, {
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

  listPatients: (doctorId: string, token?: string) =>
    request<{ items: Array<{ id: string; firstName: string; lastName: string; email?: string; phone?: string; documentId?: string; doctorId: string }>; total: number }>(
      `${endpointCatalog.listPatients}?doctorId=${encodeURIComponent(doctorId)}`,
      { method: "GET", token }
    ),

  searchPatients: (query: string, doctorId: string, token?: string) =>
    request<{ items: Array<{ id: string; firstName: string; lastName: string; email?: string; phone?: string; documentId?: string; doctorId: string }>; total: number }>(
      `${endpointCatalog.searchPatients}?q=${encodeURIComponent(query)}&doctorId=${encodeURIComponent(doctorId)}`,
      { method: "GET", token }
    ),

  getPatient: (patientId: string, token?: string) =>
    request<{ id: string; firstName: string; lastName: string; email?: string; phone?: string; doctorId: string; documentId?: string }>(
      endpointCatalog.getPatient(patientId),
      {
        method: "GET",
        token
      }
    ),

  updatePatient: (patientId: string, data: Partial<CreatePatientInput>, token?: string) =>
    request<{ id: string }>(endpointCatalog.updatePatient(patientId), {
      method: "PUT",
      body: data,
      token
    }),

  deletePatient: (patientId: string, token?: string) =>
    request<{ status: string }>(endpointCatalog.deletePatient(patientId), {
      method: "DELETE",
      token
    }),

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

  resendAppointmentConfirmation: (appointmentId: string, token?: string) =>
    request<{ status: string }>(endpointCatalog.resendAppointmentConfirmation(appointmentId), {
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

  // Platform admin endpoints
  listOrgs: (token: string) =>
    request<{ items: Array<{ id: string; name: string; createdAt: string }> }>("/platform/orgs", { token }),

  createOrg: (name: string, token: string) =>
    request<{ id: string; name: string; createdAt: string }>("/platform/orgs", { method: "POST", body: { name }, token }),

  createOrgAdmin: (orgId: string, data: { name: string; email: string; password: string }, token: string) =>
    request<{ userId: string; email: string; role: string }>(`/platform/orgs/${orgId}/admins`, { method: "POST", body: data, token }),

  // Org user management endpoints
  listOrgUsers: (orgId: string, token: string) =>
    request<{ items: Array<{ id: string; name: string; email: string; role: string; status: string; createdAt: string }> }>(
      `/orgs/${orgId}/users`, { token }
    ),

  updateOrgUser: (orgId: string, userId: string, data: { role?: string; status?: string }, token: string) =>
    request<{ id: string; name: string; email: string; role: string; status: string }>(
      `/orgs/${orgId}/users/${userId}`, { method: "PATCH", body: data, token }
    ),

  inviteUser: (orgId: string, data: { email: string; role: string }, token: string) =>
    request<{ token: string; email: string; role: string; expiresAt: string }>(
      `/orgs/${orgId}/invitations`, { method: "POST", body: data, token }
    ),

  acceptInvitation: (invToken: string, data: { name: string; password: string }) =>
    request<{ accessToken: string; userId: string; orgId: string; name: string; email: string; role: string }>(
      "/auth/accept-invitation", { method: "POST", body: { token: invToken, ...data } }
    ),
};

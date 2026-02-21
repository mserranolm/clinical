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

export type ConsentSummary = {
  total: number;
  accepted: number;
};

export type AppointmentDTO = {
  id: string;
  doctorId: string;
  patientId: string;
  startAt: string;
  endAt: string;
  durationMinutes?: number;
  status: string;
  paymentAmount?: number;
  paymentMethod?: string;
  paymentPaid?: boolean;
  consentSummary?: ConsentSummary;
};

export const clinicalApi = {
  health: () => request<{ status: string; message: string }>(endpointCatalog.health),

  register: (input: RegisterInput) =>
    request<{ userId: string; name: string; email: string; createdAt: string }>(endpointCatalog.register, {
      method: "POST",
      body: input
    }),

  login: (input: LoginInput) =>
    request<{ accessToken: string; userId: string; orgId: string; name: string; email: string; role: string; mustChangePassword: boolean }>(endpointCatalog.login, {
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

  getAppointment: (appointmentId: string, token?: string) =>
    request<AppointmentDTO>(endpointCatalog.getAppointment(appointmentId), {
      method: "GET",
      token
    }),

  listAppointmentsByPatient: (patientId: string, token?: string) =>
    request<{ items: AppointmentDTO[] }>(
      `${endpointCatalog.listAppointments}?patientId=${encodeURIComponent(patientId)}`,
      { method: "GET", token }
    ),

  confirmAppointment: (appointmentId: string, token?: string) =>
    request<AppointmentDTO>(endpointCatalog.confirmAppointment(appointmentId), {
      method: "POST",
      token
    }),

  updateAppointment: (appointmentId: string, data: Partial<{ doctorId: string; patientId: string; startAt: string; endAt: string; status: string; treatmentPlan: string; paymentAmount: number; paymentMethod: string; imageKeys: string[] }>, token?: string) =>
    request<AppointmentDTO>(endpointCatalog.updateAppointment(appointmentId), {
      method: "PUT",
      body: data,
      token
    }),

  deleteAppointment: (appointmentId: string, token?: string) =>
    request<{ status: string }>(endpointCatalog.deleteAppointment(appointmentId), {
      method: "DELETE",
      token
    }),

  resendAppointmentConfirmation: (appointmentId: string, token?: string) =>
    request<{ status: string }>(endpointCatalog.resendAppointmentConfirmation(appointmentId), {
      method: "POST",
      token
    }),

  registerPayment: (appointmentId: string, payload: { paid: boolean; paymentMethod: string; paymentAmount: number }, token?: string) =>
    request<{ id: string; paymentPaid: boolean; paymentMethod: string; paymentAmount: number }>(
      `/appointments/${encodeURIComponent(appointmentId)}/payment`,
      { method: "PATCH", body: payload, token }
    ),

  closeAppointmentDay: (
    appointmentId: string,
    payload: { evolutionNotes: string; paymentAmount: number; paymentMethod: string; treatmentPlan?: string },
    token?: string
  ) =>
    request<AppointmentDTO>(endpointCatalog.closeAppointmentDay(appointmentId), {
      method: "POST",
      body: payload,
      token
    }),

  getAppointmentUploadUrl: (appointmentId: string, filename: string, contentType: string, token?: string) =>
    request<{ uploadUrl: string; key: string; imageUrl: string }>(
      `${endpointCatalog.appointmentUploadUrl(appointmentId)}?filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(contentType)}`,
      { method: "POST", token }
    ),

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

  updateOdontogramTeeth: (
    odontogramId: string,
    toothStates: Record<number, unknown>,
    token?: string,
    serializer?: (toothNum: number, state: unknown) => { toothNumber: number; isPresent: boolean; surfaces: unknown[]; generalNotes?: string },
  ) => {
    let teeth: unknown[];

    if (serializer) {
      // Nuevo formato con serializer (ToothState)
      teeth = Object.entries(toothStates).map(([num, state]) =>
        serializer(Number(num), state)
      );
    } else {
      // Formato legacy (Record<Surface, string>)
      teeth = Object.entries(toothStates).map(([num, surfaces]) => ({
        toothNumber: Number(num),
        isPresent: true,
        surfaces: Object.entries(surfaces as Record<string, string>)
          .filter(([, cond]) => cond !== "none")
          .map(([surf, cond]) => ({
            surface: surf === "O" ? "oclusal" : surf === "V" ? "vestibular" : surf === "L" ? "lingual" : surf === "M" ? "mesial" : "distal",
            condition: cond === "caries" ? "caries" : cond === "restored" ? "filled" : cond === "completed" ? "filled" : "healthy",
            severity: 1,
            notes: "",
          })),
      }));
    }

    return request<{ id: string }>(endpointCatalog.updateOdontogram(odontogramId), {
      method: "PUT",
      body: { teeth },
      token,
    });
  },

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
    request<{ items: Array<{ id: string; name: string; businessName: string; taxId: string; address: string; email: string; phone: string; status: string; paymentStatus: string; limits: { maxDoctors: number; maxAssistants: number; maxPatients: number }; createdAt: string }> }>("/platform/orgs", { token }),

  createOrg: (data: { name: string; businessName?: string; taxId?: string; address?: string; email?: string; phone?: string }, token: string) =>
    request<{ id: string; name: string; businessName: string; taxId: string; address: string; email: string; phone: string; status: string; paymentStatus: string; limits: { maxDoctors: number; maxAssistants: number; maxPatients: number }; createdAt: string }>("/platform/orgs", { method: "POST", body: data, token }),

  createOrgAdmin: (orgId: string, data: { name: string; email: string; password?: string }, token: string) =>
    request<{ userId: string; email: string; role: string }>(`/platform/orgs/${orgId}/admins`, { method: "POST", body: data, token }),

  // Org user management endpoints
  listOrgUsers: (orgId: string, token: string) =>
    request<{ items: Array<{ id: string; name: string; email: string; role: string; status: string; createdAt: string }> }>(
      `/orgs/${orgId}/users`, { token }
    ),

  updateOrgUser: (orgId: string, userId: string, data: { role?: string; status?: string; name?: string; email?: string; phone?: string; address?: string }, token: string) =>
    request<{ id: string; name: string; email: string; phone: string; address: string; role: string; status: string }>(
      `/orgs/${orgId}/users/${userId}`, { method: "PATCH", body: data, token }
    ),

  deleteOrgUser: (orgId: string, userId: string, token: string) =>
    request<{ deleted: string }>(
      `/orgs/${orgId}/users/${userId}`, { method: "DELETE", token }
    ),

  changePassword: (data: { oldPassword: string; newPassword: string }, token: string) =>
    request<{ ok: string }>(
      `/users/me/change-password`, { method: "POST", body: data, token }
    ),

  createOrgUser: (orgId: string, data: { name: string; email: string; phone?: string; address?: string; role: string; password?: string }, token: string) =>
    request<{ id: string; name: string; email: string; phone: string; address: string; role: string; status: string }>(
      `/orgs/${orgId}/users`, { method: "POST", body: data, token }
    ),

  inviteUser: (orgId: string, data: { email: string; role: string }, token: string) =>
    request<{ token: string; email: string; role: string; expiresAt: string }>(
      `/orgs/${orgId}/invitations`, { method: "POST", body: data, token }
    ),

  acceptInvitation: (invToken: string, data: { name: string; phone?: string; address?: string; password: string }) =>
    request<{ accessToken: string; userId: string; orgId: string; name: string; email: string; role: string; mustChangePassword: boolean }>(
      "/auth/accept-invitation", { method: "POST", body: { token: invToken, ...data } }
    ),

  getUserProfile: (token: string) =>
    request<{ id: string; orgId: string; name: string; email: string; role: string; status: string; orgName: string; orgLimits: { maxDoctors: number; maxAssistants: number; maxPatients: number } }>(
      "/users/me", { token }
    ),

  getPlatformStats: (token: string) =>
    request<{ totalOrgs: number; activeOrgs: number; totalUsers: number; totalAdmins: number; totalDoctors: number; totalAssistants: number; totalPatients: number; totalConsultations: number; totalRevenue: number }>(
      "/platform/stats", { token }
    ),

  getOrgStats: (token: string) =>
    request<{ totalDoctors: number; totalAssistants: number; totalAdmins: number; totalUsers: number; totalPatients: number; maxDoctors: number; maxAssistants: number; maxPatients: number; totalConsultations: number; totalRevenue: number; pendingRevenue: number }>(
      "/org/stats", { token }
    ),

  getOrg: (orgId: string, token: string) =>
    request<{ id: string; name: string; businessName: string; taxId: string; address: string; email: string; phone: string; status: string; paymentStatus: string; limits: { maxDoctors: number; maxAssistants: number; maxPatients: number }; createdAt: string }>(
      `/platform/orgs/${orgId}`, { token }
    ),

  updateOrg: (orgId: string, data: Record<string, unknown>, token: string) =>
    request<{ id: string; name: string; businessName: string; taxId: string; address: string; email: string; phone: string; status: string; paymentStatus: string; limits: { maxDoctors: number; maxAssistants: number; maxPatients: number } }>(
      `/platform/orgs/${orgId}`, { method: "PUT", body: data, token }
    ),

  deleteOrg: (orgId: string, token: string) =>
    request<{ status: string }>(`/platform/orgs/${orgId}`, { method: "DELETE", token }),
};

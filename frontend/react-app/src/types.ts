export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export type ApiError = {
  error?: string;
  message?: string;
};

export type AuthSession = {
  token: string;
  userId: string;
  orgId?: string;
  name?: string;
  email?: string;
  role?: string;
};

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type ForgotPasswordInput = {
  email: string;
};

export type ResetPasswordInput = {
  token: string;
  newPassword: string;
};

export type CreatePatientInput = {
  doctorId: string;
  specialty?: string;
  firstName: string;
  lastName: string;
  documentId?: string;
  phone?: string;
  email?: string;
  birthDate?: string;
  medicalBackgrounds: { type: string; description: string }[];
  imageKeys: string[];
};

export type CreateAppointmentInput = {
  doctorId: string;
  patientId: string;
  startAt: string;
  endAt: string;
  treatmentPlan?: string;
  paymentAmount?: number;
  paymentMethod?: string;
};

export type CreateConsentInput = {
  doctorId: string;
  patientId: string;
  title: string;
  content: string;
  deliveryMethod: "email" | "sms";
};

export type CreateOdontogramInput = {
  patientId: string;
  doctorId: string;
};

export type CreateTreatmentPlanInput = {
  patientId: string;
  doctorId: string;
  odontogramId?: string;
  title: string;
  description?: string;
};

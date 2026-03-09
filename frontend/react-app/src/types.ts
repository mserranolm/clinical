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
  orgName?: string;
  mustChangePassword?: boolean;
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
  // Extended fields (Feature 3)
  documentType?: string;
  secondName?: string;
  secondLastName?: string;
  occupation?: string;
  insurance?: string;
  homePhone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  birthCountry?: string;
  residenceCountry?: string;
  residenceAddress?: string;
  gender?: string;
  civilStatus?: string;
  heightCm?: number;
  weightKg?: number;
  bloodType?: string;
  patientNotes?: string;
  hasRepresentative?: boolean;
  representativeRelation?: string;
  representativeName?: string;
  representativeDocType?: string;
  representativeDocId?: string;
  representativePhone?: string;
};

export type CreateAppointmentInput = {
  doctorId: string;
  patientId: string;
  startAt: string;
  endAt?: string;
  durationMinutes?: number;
  treatmentPlan?: string;
  paymentAmount?: number;
  paymentMethod?: string;
  reason?: string;
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

export type PaymentRecord = {
  id: string;
  orgId: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  amount: number;
  paymentType: string;
  paymentMethod: string;
  currency: string;
  notes: string;
  createdAt: string;
};

export type BudgetItem = {
  id: string;
  description: string;
  tooth?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  status: string;
};

export type Budget = {
  id: string;
  orgId: string;
  patientId: string;
  doctorId: string;
  title: string;
  items: BudgetItem[];
  totalAmount: number;
  currency: string;
  status: string;
  notes: string;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
};

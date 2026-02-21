# Contexto del Proyecto — CliniSense / Clinical Management System

> Documento de referencia para desarrolladores y asistentes. Generado a partir del análisis del repositorio (febrero 2026).

---

## 1. Resumen ejecutivo

- **Nombre**: CliniSense / Clinical Management System  
- **Tipo**: Sistema de gestión clínica serverless para consultorios odontológicos (adaptable a otras especialidades).  
- **Entorno productivo**: `https://clinisense.aski-tech.net`  
- **API producción**: `https://egsnzyxipf.execute-api.us-east-1.amazonaws.com/prod`  
- **Stack**: Backend Go 1.23 (Lambda) + Frontend React 18 + Vite + TypeScript; DynamoDB, S3, SES, EventBridge.

---

## 2. Estructura del repositorio

```
clinical/
├── backend/                    # API serverless (Go)
│   ├── cmd/api/                 # Entry point Lambda + servidor HTTP local
│   ├── internal/
│   │   ├── api/                 # Router, handlers HTTP, odontogram, images
│   │   ├── config/              # Configuración (env, tablas)
│   │   ├── domain/              # Modelos de dominio (Patient, Appointment, etc.)
│   │   ├── notifications/      # Notificador (SES, etc.)
│   │   ├── scheduler/           # Jobs EventBridge (recordatorios, cierre día)
│   │   ├── service/             # Lógica de negocio (auth, patients, appointments, consent, odontogram)
│   │   └── store/               # Repositorios DynamoDB + tenant_context
│   ├── scripts/                 # setup-local-dev, run-local, run-tests, deploy-pipeline
│   ├── template.yaml            # SAM (Lambda, API Gateway REST, DynamoDB, S3, EventBridge)
│   ├── buildspec.yml            # CodeBuild
│   ├── samconfig.toml           # Config deploy SAM
│   └── go.mod / go.sum
├── frontend/
│   ├── react-app/               # SPA principal (React + Vite + TS)
│   │   ├── src/
│   │   │   ├── api/             # clinical.ts (cliente API)
│   │   │   ├── components/      # layout (DashboardLayout, Sidebar, Topbar), ui (DatePicker, Modal, etc.), users
│   │   │   ├── lib/             # config, http, notify, rbac, session, datetime, hooks
│   │   │   ├── modules/        # appointments (DoctorSearch, PatientSearch), treatment, testing
│   │   │   ├── pages/           # Landing, LoginView, PatientsPage, AppointmentsPage, OdontogramPage, etc.
│   │   │   ├── types.ts
│   │   │   ├── App.tsx, main.tsx, styles.css
│   │   │   └── index.html
│   │   ├── vite.config.ts, tsconfig.json, package.json
│   │   ├── .env, .env.example
│   │   └── netlify.toml
│   └── (legacy: src/, login.html, etc.)
├── infrastructure/              # Pipelines CI/CD
│   ├── pipeline.yaml
│   ├── backend-pipeline.yaml
│   └── frontend-pipeline.yaml
├── scripts/                     # fix-apigw-after-deploy, deploy-*-pipeline, reset_db
└── Doc/                         # Documentación
    ├── README.md                # Descripción general, API, despliegue
    ├── FUNCIONALIDADES_SISTEMA_CLINICO.md  # Especificación funcional detallada
    ├── API_TESTING_RESULTS.md
    ├── DEPLOYMENT.md
    ├── PIPELINES.md
    └── CONTEXTO_PROYECTO.md     # Este archivo
```

---

## 3. Backend (Go)

### 3.1 Tecnologías y dependencias

- **Go**: 1.23  
- **Runtime**: `provided.al2023` (Lambda), arm64, 512 MB, 30 s timeout.  
- **Principales**: `aws-lambda-go`, `aws-sdk-go-v2` (DynamoDB, S3, SES), `google/uuid`.

### 3.2 Arquitectura de paquetes

| Paquete | Responsabilidad |
|--------|------------------|
| `cmd/api` | `main.go` (Lambda handler + local HTTP), `local_http.go` |
| `internal/api` | `router.go` (ruteo, RBAC, handlers), `odontogram.go`, `images.go` |
| `internal/config` | Variables de entorno, nombres de tablas |
| `internal/domain` | `models.go`: Patient, Appointment, Consent, ConsentTemplate, Odontogram, ToothNumber/Condition/Surface, TreatmentPlan, User, Org |
| `internal/service` | AuthService, PatientService, AppointmentService, ConsentService, odontogram, helpers, common |
| `internal/store` | Repositorios DynamoDB (repositories.go, dynamodb.go, dynamodb_odontogram.go), tenant_context (OrgID en context) |
| `internal/notifications` | Envío email (SES) |
| `internal/scheduler` | Jobs (recordatorio 24h, cierre día) |

### 3.3 Autenticación y autorización

- **JWT** en header `Authorization: Bearer <token>`.
- **API Key** en header `x-api-key` (API Gateway; todas las llamadas la requieren salvo endpoints públicos).
- **RBAC** por rol:
  - `platform_admin`: todo (platform.manage, orgs, usuarios, etc.).
  - `admin`: users.manage, patients (view+write+delete), appointments (write+delete), treatments.manage.
  - `doctor`: patients (view+write), appointments (write), treatments.manage.
  - `assistant`: patients (view), appointments (write).
- **Endpoints públicos** (sin JWT):  
  `GET /health`, `POST /auth/*`, `POST /platform/bootstrap`,  
  `POST /public/consents/{token}/accept`, `POST /public/appointments/{token}/confirm`.

### 3.4 Tablas DynamoDB (SAM)

- `clinical-patients`
- `clinical-appointments`
- `clinical-consents`
- `clinical-consent-templates`
- `clinical-odontograms`
- `clinical-treatment-plans`
- `clinical-users` (y tablas de orgs/invitations según template)

### 3.5 Endpoints principales (resumen)

- **Platform**: bootstrap, orgs CRUD, org stats, org users, invitations.  
- **Auth**: register, login, forgot-password, reset-password, accept-invitation; users/me, users/me/change-password.  
- **Patients**: onboard, list (doctorId), search (q, doctorId), get/update/delete por id.  
- **Appointments**: create, list (doctorId+date o patientId), get/update/delete, confirm, close-day, resend-confirmation, upload-url, payment (PATCH).  
- **Consents**: create; verify (legacy); public accept por token.  
- **Consent templates**: list, create, get, update (por org).  
- **Odontograms**: create, get by patient, update, update tooth-condition.  
- **Treatment plans**: create, get, update.

---

## 4. Frontend (React + Vite + TypeScript)

### 4.1 Dependencias

- **React** 18, **React Router** 6, **Vite** 5.  
- **date-fns**, **react-day-picker** 9 (DatePicker con portal/dropdown mes-año).  
- **lucide-react** (iconos), **sileo** (utilidades).  
- Sin react-hot-toast en package.json actual; si se usa, está en código (notify).

### 4.2 Configuración API

- **Base URL**: `VITE_API_BASE_URL` o `localStorage` key `clinical_api_base_url`; por defecto local `http://localhost:3000`, en producción `https://egsnzyxipf.execute-api.us-east-1.amazonaws.com/prod`.  
- **API Key**: `VITE_API_KEY` (header `x-api-key`).  
- Cliente: `src/lib/http.ts` (`request()` con method, body, token); `src/api/clinical.ts` usa `endpointCatalog` y `request`.

### 4.3 Rutas (App.tsx)

- `/` → Landing.  
- `/login` → LoginView (redirige a /dashboard si hay sesión).  
- `/dashboard/*` → DashboardLayout (protegido; requiere sesión).  
- `/admin/*` → AdminConsoleLayout (solo `platform_admin`).  
- `/accept-invitation` → AcceptInvitationPage.  
- `/consent` → ConsentAcceptPage (pública, token por query).  
- `/confirm-appointment` → ConfirmAppointmentPage (pública).  
- `/change-password` → ChangePasswordPage (protegido).  
- Catch-all → redirige a `/` o `/dashboard` o `/change-password` según sesión y `mustChangePassword`.

### 4.4 Rutas internas del dashboard

- `/dashboard` → Panel principal (DashboardHome).  
- `/dashboard/nuevo-tratamiento` → TreatmentWizard.  
- `/dashboard/pacientes` → PatientsPage.  
- `/dashboard/citas` → AppointmentsPage.  
- `/dashboard/consentimientos` → ConsentsPage.  
- `/dashboard/plantillas-consentimiento` → ConsentTemplatesPage.  
- `/dashboard/odontograma` → OdontogramPage.  
- `/dashboard/planes` → PlansPage.  
- `/dashboard/testing` → ServiceTester.

### 4.5 Sesión y RBAC

- **Sesión**: `AuthSession` en `types.ts` (token, userId, orgId, name, email, role, orgName, mustChangePassword).  
- Persistencia: `lib/session.ts` (getSession, saveSession, clearSession).  
- **RBAC**: `lib/rbac.ts` (ej. `isPlatformAdmin(session)`).  
- Admin ve toda la org; doctor restringido por `session.userId` (scopedDoctorId).

---

## 5. Dominio de negocio (resumen)

- **Pacientes**: onboarding, CRUD, búsqueda, historial, exportación CSV/PDF, imágenes S3.  
- **Citas**: estados (scheduled, confirmed, in_progress, completed, cancelled), confirmación por token (email), recordatorio 24h, cierre de día, pagos, imágenes.  
- **Consentimientos**: plantillas por org (activa/inactiva), consentimientos por cita con token de aceptación; firma pública por link.  
- **Odontograma**: modelo FDI (32 dientes), superficies, condiciones, códigos de tratamiento, historial por diente.  
- **Planes de tratamiento**: estados (draft, proposed, approved, in_progress, completed, cancelled), prioridades, vinculación a odontograma.  
- **Usuarios y organizaciones**: multi-tenant por OrgID; invitaciones; roles admin/doctor/assistant/platform_admin.

---

## 6. Despliegue y desarrollo local

- **Backend local**: `cd backend && ./scripts/run-local.sh` (usa `.env.local`, DynamoDB o in-memory).  
- **Frontend local**: `cd frontend/react-app && npm run dev`.  
- **Deploy backend**: SAM (`sam build`, `sam deploy`); pipeline CodePipeline (infrastructure/backend-pipeline.yaml).  
- **Deploy frontend**: S3 + CloudFront (infrastructure/frontend-pipeline.yaml); Netlify (netlify.toml) opcional.  
- **Tests backend**: `./scripts/run-tests.sh` (unit, integration, endpoint, coverage).

---

## 7. Documentos de referencia

- **Funcionalidades y estado**: `Doc/FUNCIONALIDADES_SISTEMA_CLINICO.md`.  
- **API y despliegue**: `Doc/README.md`, `Doc/DEPLOYMENT.md`, `Doc/API_TESTING_RESULTS.md`.  
- **Pipelines**: `Doc/PIPELINES.md`.

---

## 8. Convenciones útiles

- **Idioma**: documentación y mensajes al usuario en español.  
- **API**: JSON, códigos HTTP estándar; errores con `error` o `message` en body.  
- **Fechas**: ISO 8601; backend con `CLINIC_TZ` (ej. America/Caracas).  
- **Tenant**: `store.ContextWithOrgID(ctx, orgID)` y `store.OrgIDFromContext(ctx)` en backend; frontend filtra por org y por doctor cuando aplica.

Este documento se puede actualizar cuando cambie la estructura o el stack del proyecto.

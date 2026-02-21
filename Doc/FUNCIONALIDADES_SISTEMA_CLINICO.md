# 🏥 CliniSense — Especificación de Funcionalidades del Sistema

> **Última actualización**: Febrero 2026  
> **Stack**: AWS Lambda + Go (backend) · React + Vite (frontend) · DynamoDB + S3 · SES · EventBridge  
> **Entorno productivo**: `https://clinisense.aski-tech.net`  
> **API**: `https://egsnzyxipf.execute-api.us-east-1.amazonaws.com/prod`

---

## ✅ Estado General del Sistema

| Módulo | Estado | Notas |
|---|---|---|
| Autenticación y Roles | ✅ Producción | JWT + RBAC (admin, doctor) |
| Gestión de Pacientes | ✅ Producción | CRUD completo + historial |
| Agenda y Citas | ✅ Producción | Con confirmación y recordatorios |
| Consentimientos Digitales | ✅ Producción | Plantillas + firma digital |
| Odontograma Digital | ✅ Producción | Modelo FDI completo |
| Planes de Tratamiento | ✅ Producción | Con estados y prioridades |
| Notificaciones Email | ✅ Producción | SES con links de confirmación |
| CI/CD Pipeline | ✅ Producción | CodePipeline frontend + backend |
| Portal Público Paciente | ✅ Producción | Confirmar cita + firmar consentimiento |
| Gestión de Usuarios | ✅ Producción | Invitaciones + cambio de contraseña |

---

## 🔐 1. Autenticación y Control de Acceso

### Implementado ✅
- Login con email/contraseña (JWT)
- Roles: `admin`, `doctor`, `platform_admin`
- RBAC en frontend y backend:
  - Admin: acceso total a la organización
  - Doctor: acceso solo a sus propios pacientes/citas
- Invitación de nuevos usuarios por email (`/accept-invitation`)
- Cambio de contraseña autenticado
- Sesión persistente con token en localStorage
- Protección de rutas en frontend
- API Key requerida en todas las llamadas (`x-api-key`)
- Endpoints públicos sin autenticación: `/public/consents/{token}/accept`, `/public/appointments/{token}/confirm`

### Pendiente 🔄
- Recuperación de contraseña por email (forgot password)
- 2FA / MFA
- Expiración y renovación automática de tokens

---

## 👥 2. Gestión de Pacientes

### Implementado ✅
- Registro de paciente (onboarding) con:
  - Nombre, apellido, cédula/documento
  - Email, teléfono, fecha de nacimiento
  - Antecedentes médicos (alergias, condiciones previas)
  - Imágenes clínicas (S3)
- Edición de datos del paciente
- Eliminación de paciente
- Búsqueda por nombre, apellido, cédula, email, teléfono
- Vista de historial de consultas por paciente
- Exportación de historial a CSV y PDF
- Filtrado por doctor (admin ve todos, doctor ve los suyos)
- DatePicker con navegación rápida por mes/año (dropdown), fechas futuras deshabilitadas

### Pendiente 🔄
- Foto de perfil del paciente
- Gestión familiar (vínculos entre pacientes)
- Alertas médicas automáticas
- Recordatorios de seguimiento post-tratamiento

---

## 📅 3. Agenda y Citas

### Implementado ✅
- Creación de citas con:
  - Doctor, paciente, fecha/hora inicio y fin
  - Tipo, notas, duración calculada
- Estados de cita: `scheduled`, `confirmed`, `in_progress`, `completed`, `cancelled`
- Confirmación de cita por el paciente vía link en email (`/confirm-appointment?token=...`)
- Inicio y cierre de consulta (in_progress → completed)
- Notas de evolución y plan de tratamiento por cita
- Registro de pago por cita (monto, método, pagado/pendiente)
- Imágenes clínicas adjuntas a la cita (S3)
- Recordatorio manual "Reenviar" con:
  - Rate limit: máximo 1 reenvío cada 3 minutos
  - Incluye link de confirmación + link de consentimiento
  - Genera `ConfirmToken` si la cita no tenía uno
- Botón "Reenviar" oculto para citas `in_progress` y `cancelled`
- Vista de agenda por día con DatePicker
- Filtrado por doctor

### Recordatorios Automáticos ✅
- Recordatorio 24h antes de la cita (EventBridge Scheduler)
- Cierre automático del día (scheduler diario)

### Pendiente 🔄
- Reagendamiento de citas
- Vista de calendario semanal/mensual
- Bloqueo de horarios del doctor
- Lista de espera
- Citas recurrentes

---

## 📋 4. Consentimientos Informados

### Implementado ✅
- **Plantillas de Consentimiento**:
  - CRUD completo de plantillas por organización
  - Activar/desactivar plantillas
  - Plantilla activa usada automáticamente al crear citas
  - Plantilla de ejemplo pre-cargada (odontología general)
- **Consentimientos por Cita**:
  - Generación automática al crear cita (si hay plantilla activa)
  - Token único de aceptación (`AcceptToken`)
  - Link de firma enviado por email junto con la confirmación de cita
  - Página pública de firma: `/consent?token=...`
  - Estado: `pending` → `accepted`
  - Registro de fecha/hora de aceptación
- **Vista de Documentos**:
  - Lista de consentimientos por paciente/doctor
  - Estado visual (pendiente/aceptado)
  - Fecha de aceptación

### Pendiente 🔄
- Firma digital certificada (con valor legal)
- Versionado de plantillas
- Consentimientos por tipo de procedimiento específico
- Descarga de consentimiento firmado en PDF
- Múltiples plantillas activas por especialidad

---

## 🦷 5. Odontograma Digital

### Implementado ✅
- Modelo dental completo FDI (32 dientes, cuadrantes 1-4)
- Superficies por diente: oclusal, vestibular, lingual, mesial, distal
- Condiciones: sano, caries, obturado, corona, extraído, implante, endodoncia, fractura, ausente
- Códigos de tratamiento estándar (D1110–D9972)
- Historial de tratamientos por diente
- Notas generales y por diente
- Registro de doctor que modificó y fecha
- Fotos y radiografías por tratamiento (S3)
- Página frontend `OdontogramPage` con visualización interactiva

### Pendiente 🔄
- Exportación del odontograma a PDF/imagen
- Comparativa temporal (odontograma en fechas distintas)
- Integración directa con creación de cita

---

## 💊 6. Planes de Tratamiento

### Implementado ✅
- Creación de planes de tratamiento con:
  - Título, descripción, prioridad
  - Lista de tratamientos planificados por diente/superficie
  - Costo estimado total y por tratamiento
  - Tiempo estimado
  - Prerrequisitos entre tratamientos
- Estados del plan: `draft`, `proposed`, `approved`, `in_progress`, `completed`, `cancelled`
- Estados por tratamiento: `pending`, `scheduled`, `completed`, `skipped`
- Prioridades: `urgent`, `high`, `medium`, `low`, `elective`
- Vinculación con odontograma
- Página frontend `PlansPage` y wizard `TreatmentWizard`

### Pendiente 🔄
- Aprobación del plan por el paciente (firma digital)
- Cotización automática con precios configurables
- Seguimiento de progreso visual
- Integración con agenda (crear citas desde el plan)

---

## 💰 7. Gestión Financiera

### Implementado ✅
- Registro de pago por cita:
  - Monto, método de pago, estado (pagado/pendiente)
- Visualización del estado de pago en la lista de citas

### Pendiente 🔄
- Dashboard financiero con totales por período
- Reportes de ingresos por doctor
- Planes de pago a plazos
- Facturación electrónica
- Integración con pasarelas de pago
- Descuentos y promociones

---

## 🔔 8. Notificaciones y Comunicaciones

### Implementado ✅
- **Email de creación de cita** (SES):
  - Datos de la cita (fecha, hora)
  - Link de confirmación: `https://clinisense.aski-tech.net/confirm-appointment?token=...`
  - Link de firma de consentimiento: `https://clinisense.aski-tech.net/consent?token=...` (si hay plantilla activa)
- **Email de recordatorio 24h** (EventBridge):
  - Mismo formato que el de creación
- **Email de reenvío manual** ("Reenviar"):
  - Incluye confirmación + consentimiento
  - Rate limit: 1 cada 3 minutos por cita
- **Notificaciones in-app** (toast):
  - Éxito, error, carga con `react-hot-toast`

### Pendiente 🔄
- WhatsApp Business API
- SMS
- Push notifications móvil
- Configuración de preferencias de notificación por paciente
- Email de recordatorio post-consulta

---

## 👨‍💼 9. Administración de Usuarios

### Implementado ✅
- Lista de usuarios de la organización
- Invitación de nuevos usuarios por email
- Roles: admin, doctor
- Cambio de contraseña
- Página `UsersAdminPage` (solo admin)

### Pendiente 🔄
- Desactivación de usuarios
- Perfiles de usuario con foto
- Horarios de atención por doctor
- Especialidades por doctor

---

## 🌐 10. Portal Público del Paciente

### Implementado ✅
- **Confirmar cita** (`/confirm-appointment?token=...`):
  - Página pública sin login
  - Muestra datos de la cita
  - Botón de confirmación
  - Actualiza estado a `confirmed` en backend
- **Firmar consentimiento** (`/consent?token=...`):
  - Página pública sin login
  - Muestra contenido del consentimiento
  - Botón de aceptación
  - Registra fecha/hora de aceptación

### Pendiente 🔄
- Portal completo del paciente con login propio
- Historial de citas del paciente
- Reagendamiento online
- Descarga de documentos

---

## 🏗️ 11. Arquitectura Técnica

### Backend ✅
```
AWS Lambda (Go 1.21)
  ├── API Gateway REST (x-api-key + JWT)
  ├── DynamoDB
  │   ├── clinical-users
  │   ├── clinical-appointments
  │   ├── clinical-patients
  │   ├── clinical-consents
  │   ├── clinical-consent-templates   ← añadida Feb 2026
  │   └── clinical-odontograms
  ├── S3 (imágenes clínicas)
  ├── SES (emails transaccionales)
  └── EventBridge Schedulers
      ├── Recordatorio 24h antes de cita
      └── Cierre diario automático
```

### Frontend ✅
```
React 18 + Vite + TypeScript
  ├── React Router v6 (SPA)
  ├── react-day-picker v9 (DatePicker con portal + dropdown mes/año)
  ├── react-hot-toast (notificaciones)
  ├── lucide-react (iconos)
  └── CSS custom (design system CliniSense Air)

Páginas:
  ├── /                          Landing
  ├── /login                     Login
  ├── /accept-invitation         Aceptar invitación
  ├── /confirm-appointment       Confirmar cita (pública)
  ├── /consent                   Firmar consentimiento (pública)
  └── /dashboard/*
      ├── Panel Principal        KPIs + agenda del día
      ├── Pacientes              CRUD + historial + exportación
      ├── Agenda Médica          Citas + confirmación + pagos
      ├── Documentos             Consentimientos firmados
      ├── Plantillas Consentimiento  CRUD plantillas
      ├── Odontograma            Visualización interactiva
      ├── Tratamientos           Planes de tratamiento
      └── Usuarios               Admin de usuarios (solo admin)
```

### CI/CD ✅
```
GitHub → AWS CodePipeline
  ├── clinical-backend-pipeline  (SAM deploy automático)
  └── clinical-frontend-pipeline (S3 + CloudFront)
```

---

## 🚀 Roadmap

### Fase 1 — MVP ✅ COMPLETADO
- [x] Autenticación JWT + RBAC
- [x] Gestión de pacientes
- [x] Agenda y citas con recordatorios
- [x] Consentimientos digitales con firma
- [x] Odontograma digital FDI
- [x] Planes de tratamiento
- [x] Portal público del paciente (confirmar cita + firmar)
- [x] CI/CD Pipeline completo
- [x] Notificaciones email con links de confirmación y consentimiento

### Fase 2 — Expansión Core (PRÓXIMO)
- [ ] Recuperación de contraseña
- [ ] Dashboard financiero con reportes
- [ ] Exportación odontograma a PDF
- [ ] Integración agenda ↔ planes de tratamiento
- [ ] Aprobación de planes por el paciente
- [ ] Reagendamiento de citas online
- [ ] Vista de calendario semanal/mensual

### Fase 3 — Comunicaciones Avanzadas
- [ ] WhatsApp Business API
- [ ] SMS recordatorios
- [ ] Email post-consulta con instrucciones
- [ ] Portal completo del paciente con login

### Fase 4 — Inteligencia y Escala
- [ ] Analytics y KPIs avanzados
- [ ] Multi-sede / multi-organización
- [ ] App móvil (React Native)
- [ ] IA para predicción de no-shows
- [ ] Integración con laboratorios
- [ ] Telemedicina

---

## 🐛 Bugs Conocidos / Issues Activos

| # | Descripción | Estado |
|---|---|---|
| 1 | DatePicker cortado en modales | ✅ Resuelto (createPortal Feb 2026) |
| 2 | Error `doctorId required` al crear paciente como admin | ✅ Resuelto (Feb 2026) |
| 3 | Dropdown de año en DatePicker no responde al click | 🔴 Pendiente investigación |
| 4 | Botón "Reenviar" visible en citas `in_progress` | ✅ Resuelto (Feb 2026) |
| 5 | Pipeline backend fallaba por `profile = "aski"` en samconfig | ✅ Resuelto (Feb 2026) |

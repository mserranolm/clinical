# Diseño: Mejoras UX de Citas — 2026-05-02

## Alcance

Tres mejoras independientes al sistema clínico DOCCO:

1. Página de gestión de cita desde email (confirmar / cancelar / reprogramar)
2. Timer de consulta hacia adelante (tiempo transcurrido, no cuenta regresiva)
3. Logo del doctor en presupuesto PDF

---

## Feature 1 — Página de gestión de cita por email

### Problema

La página `/confirm-appointment` auto-confirma al cargar. No da opción de cancelar ni solicitar reprogramación.

### Solución

Tres nuevos endpoints públicos (sin auth) + refactor de la página frontend.

**Nuevos endpoints backend:**

- `GET /public/appointments/:token/info` → `{patientName, doctorName, startAt, status}`
- `POST /public/appointments/:token/cancel` → `{status: "cancelled"}`
- `POST /public/appointments/:token/reschedule-request` → envía notificación a la clínica, retorna `{status: "request_sent"}`

**Router:** los 3 endpoints se registran como rutas públicas (sin JWT), igual que el confirm existente.

**Service:**

- `GetInfoByToken(ctx, token)` → busca cita por `confirmToken`, retorna info básica
- `CancelByToken(ctx, token)` → valida token, cambia status a `"cancelled"` (solo si no está ya cancelada/completada)
- `RequestRescheduleByToken(ctx, token)` → envía email/SMS al doctor con asunto "Paciente solicita reprogramar"

**Frontend (`ConfirmAppointmentPage.tsx`):**

- Al montar: llama `GET /info` → muestra datos + 3 botones
- Botón "Confirmar" es el default/highlighted (color teal)
- Botones "Cancelar" y "Solicitar reprogramar" en gris/outline
- Al clic en cualquier botón: llama endpoint, muestra resultado
- Si `status` ya es `confirmed/cancelled`: muestra estado sin permitir cambio

### Modelo de datos

Sin cambios al modelo `Appointment`. Se reutiliza `ConfirmToken` existente.

---

## Feature 2 — Timer de consulta hacia adelante

### Problema

El timer usa `appointmentDate` (hora programada) como referencia. Si la consulta inicia antes de la hora programada, el elapsed es negativo → se ve `-24:-18`.

### Solución

**Backend:**

- Agrega `ConsultationStartedAt *time.Time \`json:"consultationStartedAt,omitempty"\``al struct`Appointment`en`domain/models.go`
- En `appointment_service.go`, al actualizar status a `"in_progress"`, si `consultationStartedAt` es nil → asignar `time.Now()`
- Persistir en DynamoDB como atributo adicional

**Frontend (`ConsultaPage.tsx`):**

- Cambiar el timer para usar `appointment.consultationStartedAt` en vez de `appointmentDate`
- Fallback: si no existe el campo (citas antiguas), usar `Date.now()` como inicio
- Label: `HH:MM:SS` siempre positivo, contando hacia adelante
- Remover el signo negativo del display

---

## Feature 3 — Logo del doctor en presupuesto

### Problema

El PDF de presupuesto ya soporta logo (`generateBudgetPdf.ts` ya usa `logoBase64`), y el backend tiene endpoint de upload S3 + settings. Pero no hay UI para configurarlo.

### Solución

**Frontend (`PresupuestosPage.tsx`):**

- Sección colapsable/discreta al top del listado (solo roles admin/doctor)
- Muestra thumbnail del logo actual o mensaje "Sin logo configurado"
- Botón "Cambiar logo" → abre `<input type="file" accept="image/png,image/jpeg">` (max 2MB)
- Flujo de upload:
  1. `GET /platform/uploads/presigned?contentType=image/png` → obtiene URL presigned S3
  2. `PUT <presignedUrl>` con el archivo binario
  3. `PUT /platform/settings { logoUrl: <public S3 URL> }` para guardar
  4. Refrescar preview

**Backend:** sin cambios (todo ya existe: presigned URL endpoint + settings CRUD).

---

## Orden de implementación

1. Feature 2 (timer) — más pequeño, solo backend model + 1 línea frontend
2. Feature 1 (email page) — backend 3 endpoints + frontend refactor
3. Feature 3 (logo) — solo frontend

## Deploy

`sam deploy` (backend) + `git push origin main` (frontend via CodePipeline)

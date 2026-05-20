# Appointment UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar 3 mejoras UX: (1) timer de consulta cuenta hacia adelante desde inicio real, (2) página de gestión de cita desde email con botones Confirmar/Cancelar/Solicitar reprogramar, (3) sección de logo en PresupuestosPage.

**Architecture:** Feature 2 (timer) requiere un nuevo campo en el modelo Appointment + cambio en el service + 1 línea en frontend. Feature 1 (email page) agrega 3 endpoints públicos Go + refactoriza ConfirmAppointmentPage. Feature 3 (logo) es solo frontend — la infraestructura backend S3 + settings ya existe.

**Tech Stack:** Go 1.x, AWS Lambda/DynamoDB, React 18, TypeScript, Tailwind CSS, jsPDF

---

## Mapa de archivos

| Archivo                                                   | Cambio                                                                                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `backend/internal/domain/models.go`                       | Agregar `ConsultationStartedAt` al struct `Appointment`                                                                           |
| `backend/internal/service/appointment_service.go`         | Asignar `ConsultationStartedAt` al cambiar a `in_progress`; agregar `GetInfoByToken`, `CancelByToken`, `RequestRescheduleByToken` |
| `backend/internal/notifications/notifier.go`              | Agregar `SendRescheduleRequest` a la interface + implementación                                                                   |
| `backend/internal/api/router.go`                          | 3 nuevas rutas públicas + handlers; extender `isPublic`                                                                           |
| `frontend/react-app/src/pages/ConsultaPage.tsx`           | Cambiar timer para usar `consultationStartedAt`                                                                                   |
| `frontend/react-app/src/api/clinical.ts`                  | Agregar 3 métodos públicos: `getPublicAppointmentInfo`, `cancelPublicAppointment`, `requestReschedulePublic`                      |
| `frontend/react-app/src/pages/ConfirmAppointmentPage.tsx` | Refactorizar: carga info, muestra 3 botones                                                                                       |
| `frontend/react-app/src/pages/PresupuestosPage.tsx`       | Agregar sección logo (upload + preview)                                                                                           |

---

## Task 1: Backend — Campo ConsultationStartedAt en modelo Appointment

**Files:**

- Modify: `backend/internal/domain/models.go` (~línea 82, después de `DoctorDailyClosedAt`)

- [ ] **Step 1: Agregar el campo al struct**

Abrir `backend/internal/domain/models.go`. Después de la línea `DoctorDailyClosedAt *time.Time \`json:"doctorDailyClosedAt,omitempty"\``, agregar:

```go
ConsultationStartedAt *time.Time `json:"consultationStartedAt,omitempty"`
```

El struct `Appointment` queda:

```go
PatientConfirmedAt  *time.Time `json:"patientConfirmedAt,omitempty"`
DoctorDailyClosedAt *time.Time `json:"doctorDailyClosedAt,omitempty"`
ConsultationStartedAt *time.Time `json:"consultationStartedAt,omitempty"`
```

- [ ] **Step 2: Verificar que compila**

```bash
cd backend && go build ./...
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
cd backend
git add internal/domain/models.go
git commit -m "feat(domain): add ConsultationStartedAt to Appointment model"
```

---

## Task 2: Backend — Asignar ConsultationStartedAt al pasar a in_progress

**Files:**

- Modify: `backend/internal/service/appointment_service.go` (~línea 363, bloque `if in.Status != ""`)

- [ ] **Step 1: Escribir el test (in-memory service)**

Abrir `backend/test/integration_test.go`. Antes de `TestSetup`, agregar:

```go
func TestConsultationStartedAtSetOnInProgress(t *testing.T) {
	repos := store.NewInMemoryStore()
	svc := service.NewAppointmentService(repos.Appointments, nil)

	ctx := context.Background()
	appt := domain.Appointment{
		ID:       "appt-1",
		OrgID:    "org-1",
		DoctorID: "doc-1",
		PatientID: "pat-1",
		StartAt:  time.Now().Add(time.Hour),
		EndAt:    time.Now().Add(2 * time.Hour),
		Status:   "scheduled",
	}
	if err := repos.Appointments.(*store.InMemoryAppointmentRepo).SaveForTest(ctx, appt); err != nil {
		t.Fatal(err)
	}

	updated, err := svc.UpdateAppointment(ctx, "appt-1", service.UpdateAppointmentInput{
		Status: "in_progress",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.ConsultationStartedAt == nil {
		t.Fatal("expected ConsultationStartedAt to be set, got nil")
	}

	// Segunda llamada: debe ser idempotente (no sobreescribir)
	first := *updated.ConsultationStartedAt
	time.Sleep(10 * time.Millisecond)
	updated2, err := svc.UpdateAppointment(ctx, "appt-1", service.UpdateAppointmentInput{
		Status: "in_progress",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !updated2.ConsultationStartedAt.Equal(first) {
		t.Fatal("ConsultationStartedAt should not change on repeated in_progress update")
	}
}
```

- [ ] **Step 2: Ejecutar el test para ver que falla**

```bash
cd backend && go test ./test/... -run TestConsultationStartedAtSetOnInProgress -v
```

Expected: FAIL (el campo no se asigna aún) — **NOTA:** si el test falla por `SaveForTest` no existir, continúa al Step 3 y vuelve.

- [ ] **Step 3: Implementar en UpdateAppointment**

En `backend/internal/service/appointment_service.go`, buscar el bloque:

```go
if in.Status != "" {
    appt.Status = in.Status
}
```

Agregar inmediatamente después:

```go
if in.Status == "in_progress" && appt.ConsultationStartedAt == nil {
    now := time.Now().UTC()
    appt.ConsultationStartedAt = &now
}
```

- [ ] **Step 4: Exponer SaveForTest en in_memory store (si no existe)**

Abrir `backend/internal/store/repositories.go`. Buscar `memoryAppointmentRepo`. Si no existe un método `SaveForTest`, agregar al struct:

```go
func (r *memoryAppointmentRepo) SaveForTest(ctx context.Context, appt domain.Appointment) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    r.items[appt.ID] = appt
    return nil
}
```

Si el struct no se llama `memoryAppointmentRepo` o la implementación es diferente, adaptar el test en Step 1 para usar `service.Create` en su lugar:

```go
// Alternativa si SaveForTest no aplica
created, err := svc.Create(ctx, service.CreateAppointmentInput{
    DoctorID:  "doc-1",
    PatientID: "pat-1",
    StartAt:   time.Now().Add(time.Hour).Format(time.RFC3339),
    EndAt:     time.Now().Add(2 * time.Hour).Format(time.RFC3339),
})
if err != nil {
    t.Fatalf("create: %v", err)
}
updated, err := svc.UpdateAppointment(ctx, created.ID, service.UpdateAppointmentInput{
    Status: "in_progress",
})
```

- [ ] **Step 5: Ejecutar los tests**

```bash
cd backend && go test ./... 2>&1
```

Expected: todos los tests pasan, sin errores de compilación.

- [ ] **Step 6: Commit**

```bash
cd backend
git add internal/service/appointment_service.go internal/store/repositories.go test/integration_test.go
git commit -m "feat(service): set ConsultationStartedAt when appointment starts in_progress"
```

---

## Task 3: Frontend — Timer de consulta hacia adelante

**Files:**

- Modify: `frontend/react-app/src/pages/ConsultaPage.tsx`

- [ ] **Step 1: Agregar estado consultationStartedAt**

En `ConsultaPage.tsx`, buscar:

```typescript
const [appointmentDate, setAppointmentDate] = useState<string>("");
```

Agregar en la línea siguiente:

```typescript
const [consultationStartedAt, setConsultationStartedAt] = useState<string>("");
```

- [ ] **Step 2: Poblar el estado desde loadAll**

Buscar el bloque donde se setea `appointmentDate`:

```typescript
setAppointmentStatus(appt.status ?? "scheduled");
setAppointmentDate(appt.startAt ?? "");
```

Agregar en la línea siguiente:

```typescript
setConsultationStartedAt((appt as any).consultationStartedAt ?? "");
```

- [ ] **Step 3: Cambiar el timer para usar consultationStartedAt**

Buscar el useEffect del timer:

```typescript
useEffect(() => {
  if (isInProgress && appointmentDate) {
    const start = new Date(appointmentDate).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    timerRef.current = setInterval(tick, 1000);
  }
  return () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };
}, [isInProgress, appointmentDate]);
```

Reemplazarlo por:

```typescript
useEffect(() => {
  if (isInProgress) {
    const start = consultationStartedAt
      ? new Date(consultationStartedAt).getTime()
      : Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    timerRef.current = setInterval(tick, 1000);
  }
  return () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };
}, [isInProgress, consultationStartedAt]);
```

- [ ] **Step 4: Verificar que el label no muestra negativo**

El `elapsedLabel` usa `elapsed` que ahora siempre será ≥ 0. No requiere cambio adicional.

- [ ] **Step 5: Build del frontend**

```bash
cd frontend/react-app && npm run build 2>&1
```

Expected: sin errores TypeScript.

- [ ] **Step 6: Commit**

```bash
cd frontend/react-app
git add src/pages/ConsultaPage.tsx
git commit -m "feat(consulta): timer counts forward from actual consultation start"
```

---

## Task 4: Backend — SendRescheduleRequest en Notifier

**Files:**

- Modify: `backend/internal/notifications/notifier.go`

- [ ] **Step 1: Agregar método a la interface**

En `notifier.go`, buscar el bloque `type Notifier interface {`. Agregar antes del cierre `}`:

```go
SendRescheduleRequest(ctx context.Context, toEmail, patientName string, startAt time.Time) error
```

- [ ] **Step 2: Implementar el método en Router**

Al final del archivo `notifier.go`, agregar:

```go
func (r *Router) SendRescheduleRequest(ctx context.Context, toEmail, patientName string, startAt time.Time) error {
	if !r.allowed(ctx, "email") {
		return fmt.Errorf("email notifications disabled")
	}
	dateStr := startAt.Format("02/01/2006")
	timeStr := startAt.Format("15:04")
	subject := "CliniSense — Solicitud de reprogramación de cita"
	body := fmt.Sprintf(
		"El paciente %s ha solicitado reprogramar su cita del %s a las %s.\n\nPor favor contáctalo para coordinar un nuevo horario.",
		patientName, dateStr, timeStr,
	)
	htmlBody := buildHTMLEmail(fmt.Sprintf(`
<p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#1e293b;">Solicitud de reprogramación</p>
<p style="margin:0 0 8px;font-size:14px;color:#334155;">El paciente <strong>%s</strong> ha solicitado reprogramar su cita del <strong>%s</strong> a las <strong>%s</strong>.</p>
<p style="margin:0;font-size:14px;color:#64748b;">Por favor contáctalo para coordinar un nuevo horario.</p>`,
		html.EscapeString(patientName), dateStr, timeStr))
	return r.sendEmail(ctx, toEmail, subject, body, htmlBody)
}
```

- [ ] **Step 3: Verificar que el in-memory notifier también implementa la interface**

Buscar en `repositories.go` o `in_memory.go` si existe un `noopNotifier` o similar que implemente `Notifier`. Si existe, agregar el método:

```go
func (n *noopNotifier) SendRescheduleRequest(_ context.Context, _, _ string, _ time.Time) error {
	return nil
}
```

Si no hay notifier in-memory (el servicio usa `nil`), este paso no aplica.

- [ ] **Step 4: Compilar**

```bash
cd backend && go build ./...
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
cd backend
git add internal/notifications/notifier.go
git commit -m "feat(notifications): add SendRescheduleRequest method"
```

---

## Task 5: Backend — GetInfoByToken, CancelByToken, RequestRescheduleByToken en AppointmentService

**Files:**

- Modify: `backend/internal/service/appointment_service.go`

- [ ] **Step 1: Agregar el tipo AppointmentPublicInfo**

Al final de `appointment_service.go`, antes de `generateAppointmentToken`, agregar:

```go
// AppointmentPublicInfo contains publicly-safe appointment data for the patient-facing confirmation page.
type AppointmentPublicInfo struct {
	PatientName string    `json:"patientName"`
	DoctorName  string    `json:"doctorName"`
	StartAt     time.Time `json:"startAt"`
	Status      string    `json:"status"`
}
```

- [ ] **Step 2: Agregar GetInfoByToken**

Después del tipo `AppointmentPublicInfo`:

```go
func (s *AppointmentService) GetInfoByToken(ctx context.Context, token string) (AppointmentPublicInfo, error) {
	appt, err := s.repo.GetByConfirmToken(ctx, token)
	if err != nil {
		return AppointmentPublicInfo{}, fmt.Errorf("enlace inválido o expirado")
	}
	info := AppointmentPublicInfo{
		StartAt: appt.StartAt,
		Status:  appt.Status,
	}
	if s.patientRepo != nil {
		if p, err := s.patientRepo.GetByID(ctx, appt.PatientID); err == nil {
			info.PatientName = p.FirstName + " " + p.LastName
		}
	}
	if s.authRepo != nil {
		if u, err := s.authRepo.GetUserByID(ctx, appt.DoctorID); err == nil {
			info.DoctorName = u.Name
		}
	}
	return info, nil
}
```

- [ ] **Step 3: Agregar CancelByToken**

```go
func (s *AppointmentService) CancelByToken(ctx context.Context, token string) (domain.Appointment, error) {
	appt, err := s.repo.GetByConfirmToken(ctx, token)
	if err != nil {
		return domain.Appointment{}, fmt.Errorf("enlace inválido o expirado")
	}
	if appt.Status == "cancelled" {
		return appt, nil
	}
	if appt.Status == "completed" || appt.Status == "in_progress" {
		return domain.Appointment{}, fmt.Errorf("no se puede cancelar una cita en progreso o finalizada")
	}
	appt.Status = "cancelled"
	updated, err := s.repo.Update(ctx, appt)
	if err != nil {
		return domain.Appointment{}, err
	}
	if s.notifier != nil {
		if email, name := s.patientEmail(ctx, updated.PatientID); email != "" {
			_ = s.notifier.SendAppointmentEvent(ctx, email, name, "cancelled", updated.StartAt.UTC(), updated.EndAt.UTC())
		}
	}
	return updated, nil
}
```

- [ ] **Step 4: Agregar RequestRescheduleByToken**

```go
func (s *AppointmentService) RequestRescheduleByToken(ctx context.Context, token string) error {
	appt, err := s.repo.GetByConfirmToken(ctx, token)
	if err != nil {
		return fmt.Errorf("enlace inválido o expirado")
	}
	if appt.Status == "cancelled" || appt.Status == "completed" {
		return fmt.Errorf("esta cita ya no puede ser modificada")
	}
	if s.notifier != nil && s.authRepo != nil {
		_, patientName := s.patientEmail(ctx, appt.PatientID)
		if doc, err := s.authRepo.GetUserByID(ctx, appt.DoctorID); err == nil && doc.Email != "" {
			_ = s.notifier.SendRescheduleRequest(ctx, doc.Email, patientName, appt.StartAt)
		}
	}
	return nil
}
```

- [ ] **Step 5: Compilar**

```bash
cd backend && go build ./...
```

Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
cd backend
git add internal/service/appointment_service.go
git commit -m "feat(service): add GetInfoByToken, CancelByToken, RequestRescheduleByToken"
```

---

## Task 6: Backend — Rutas públicas en Router

**Files:**

- Modify: `backend/internal/api/router.go`

- [ ] **Step 1: Extender isPublic con las 3 nuevas rutas**

En `router.go`, buscar:

```go
if method == "POST" && strings.HasPrefix(path, "/public/appointments/") && strings.HasSuffix(path, "/confirm") {
    return true
}
return false
```

Reemplazar con:

```go
if method == "POST" && strings.HasPrefix(path, "/public/appointments/") && strings.HasSuffix(path, "/confirm") {
    return true
}
if method == "GET" && strings.HasPrefix(path, "/public/appointments/") && strings.HasSuffix(path, "/info") {
    return true
}
if method == "POST" && strings.HasPrefix(path, "/public/appointments/") && strings.HasSuffix(path, "/cancel") {
    return true
}
if method == "POST" && strings.HasPrefix(path, "/public/appointments/") && strings.HasSuffix(path, "/reschedule-request") {
    return true
}
return false
```

- [ ] **Step 2: Agregar los 3 casos en el switch de rutas**

En el switch principal de rutas, buscar el bloque existente:

```go
// Public appointment confirm endpoint (no API key required — called from email link)
case method == "POST" && strings.HasPrefix(path, "/public/appointments/") && strings.HasSuffix(path, "/confirm"):
    token := strings.TrimSuffix(strings.TrimPrefix(path, "/public/appointments/"), "/confirm")
    resp, err = r.publicConfirmAppointment(ctx, token)
```

Agregar después de este case:

```go
case method == "GET" && strings.HasPrefix(path, "/public/appointments/") && strings.HasSuffix(path, "/info"):
    token := strings.TrimSuffix(strings.TrimPrefix(path, "/public/appointments/"), "/info")
    resp, err = r.publicGetAppointmentInfo(ctx, token)

case method == "POST" && strings.HasPrefix(path, "/public/appointments/") && strings.HasSuffix(path, "/cancel"):
    token := strings.TrimSuffix(strings.TrimPrefix(path, "/public/appointments/"), "/cancel")
    resp, err = r.publicCancelAppointment(ctx, token)

case method == "POST" && strings.HasPrefix(path, "/public/appointments/") && strings.HasSuffix(path, "/reschedule-request"):
    token := strings.TrimSuffix(strings.TrimPrefix(path, "/public/appointments/"), "/reschedule-request")
    resp, err = r.publicRescheduleRequest(ctx, token)
```

- [ ] **Step 3: Agregar los 3 handler methods**

Al final de `router.go`, después de `publicConfirmAppointment`, agregar:

```go
func (r *Router) publicGetAppointmentInfo(ctx context.Context, token string) (events.APIGatewayV2HTTPResponse, error) {
    info, err := r.appointments.GetInfoByToken(ctx, token)
    if err != nil {
        return response(400, map[string]string{"error": err.Error()})
    }
    return response(200, info)
}

func (r *Router) publicCancelAppointment(ctx context.Context, token string) (events.APIGatewayV2HTTPResponse, error) {
    appt, err := r.appointments.CancelByToken(ctx, token)
    if err != nil {
        return response(400, map[string]string{"error": err.Error()})
    }
    return response(200, map[string]interface{}{
        "status":  "cancelled",
        "startAt": appt.StartAt,
    })
}

func (r *Router) publicRescheduleRequest(ctx context.Context, token string) (events.APIGatewayV2HTTPResponse, error) {
    if err := r.appointments.RequestRescheduleByToken(ctx, token); err != nil {
        return response(400, map[string]string{"error": err.Error()})
    }
    return response(200, map[string]string{"status": "request_sent"})
}
```

- [ ] **Step 4: Compilar y correr tests**

```bash
cd backend && go build ./... && go test ./...
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
cd backend
git add internal/api/router.go
git commit -m "feat(router): add public appointment info/cancel/reschedule-request endpoints"
```

---

## Task 7: Frontend — API client: 3 métodos públicos

**Files:**

- Modify: `frontend/react-app/src/api/clinical.ts`

- [ ] **Step 1: Agregar los 3 métodos al objeto clinicalApi**

En `clinical.ts`, buscar la sección de métodos de appointments o cualquier punto lógico (cerca de `confirmAppointment` si existe, o antes del cierre `}`). Agregar:

```typescript
  // Public appointment management (called from email link — no auth token)
  getPublicAppointmentInfo: (token: string) =>
    request<{ patientName: string; doctorName: string; startAt: string; status: string }>(
      `/public/appointments/${encodeURIComponent(token)}/info`,
    ),

  cancelPublicAppointment: (token: string) =>
    request<{ status: string; startAt: string }>(
      `/public/appointments/${encodeURIComponent(token)}/cancel`,
      { method: "POST" },
    ),

  requestReschedulePublic: (token: string) =>
    request<{ status: string }>(
      `/public/appointments/${encodeURIComponent(token)}/reschedule-request`,
      { method: "POST" },
    ),
```

- [ ] **Step 2: Build**

```bash
cd frontend/react-app && npm run build 2>&1
```

Expected: sin errores TypeScript.

- [ ] **Step 3: Commit**

```bash
cd frontend/react-app
git add src/api/clinical.ts
git commit -m "feat(api): add public appointment info/cancel/reschedule-request methods"
```

---

## Task 8: Frontend — Refactorizar ConfirmAppointmentPage

**Files:**

- Modify: `frontend/react-app/src/pages/ConfirmAppointmentPage.tsx`

- [ ] **Step 1: Reemplazar el archivo completo**

Reemplazar `frontend/react-app/src/pages/ConfirmAppointmentPage.tsx` con:

```typescript
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { clinicalApi } from "../api/clinical";

type Action = "confirm" | "cancel" | "reschedule";
type Phase = "loading" | "choice" | "acting" | "done" | "error";

export default function ConfirmAppointmentPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [selectedAction, setSelectedAction] = useState<Action>("confirm");
  const [patientName, setPatientName] = useState("");
  const [startAt, setStartAt] = useState("");
  const [appointmentStatus, setAppointmentStatus] = useState("");
  const [resultMsg, setResultMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setErrorMsg("Enlace inválido — falta el token de confirmación.");
      setPhase("error");
      return;
    }
    clinicalApi
      .getPublicAppointmentInfo(token)
      .then((data) => {
        setPatientName(data.patientName);
        setAppointmentStatus(data.status);
        if (data.startAt) setStartAt(new Date(data.startAt).toLocaleString("es-ES"));
        // Si la cita ya tiene un estado terminal, mostrar directo
        if (data.status === "cancelled") {
          setResultMsg("Esta cita ya fue cancelada.");
          setPhase("done");
        } else if (data.status === "completed") {
          setResultMsg("Esta consulta ya fue atendida.");
          setPhase("done");
        } else {
          setPhase("choice");
        }
      })
      .catch(() => {
        setErrorMsg("Enlace inválido o expirado.");
        setPhase("error");
      });
  }, [token]);

  async function handleAction() {
    setPhase("acting");
    try {
      if (selectedAction === "confirm") {
        await clinicalApi.getPublicAppointmentInfo(token); // check token still valid
        // Llama confirm existente
        const apiKey = import.meta.env.VITE_API_KEY as string | undefined;
        const base = (import.meta.env.VITE_API_BASE_URL as string) || "";
        const res = await fetch(`${base}/public/appointments/${encodeURIComponent(token)}/confirm`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { "x-api-key": apiKey } : {}),
          },
        });
        await res.json();
        setResultMsg("¡Tu cita ha sido confirmada! Te esperamos puntualmente.");
      } else if (selectedAction === "cancel") {
        await clinicalApi.cancelPublicAppointment(token);
        setResultMsg("Tu cita ha sido cancelada. Si deseas reagendar, contacta a tu clínica.");
      } else {
        await clinicalApi.requestReschedulePublic(token);
        setResultMsg("Tu solicitud de reprogramación fue enviada. Tu clínica se pondrá en contacto contigo.");
      }
      setPhase("done");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Ocurrió un error. Intenta de nuevo.");
      setPhase("error");
    }
  }

  const actionLabels: Record<Action, { label: string; icon: string; desc: string }> = {
    confirm: {
      label: "Confirmar asistencia",
      icon: "✓",
      desc: "Confirmaré mi presencia en la fecha indicada.",
    },
    cancel: {
      label: "Cancelar cita",
      icon: "✗",
      desc: "No podré asistir y deseo cancelar la cita.",
    },
    reschedule: {
      label: "Solicitar reprogramar",
      icon: "↺",
      desc: "Necesito un horario diferente.",
    },
  };

  return (
    <div className="consent-page">
      <div className="consent-card">
        <div className="consent-logo">
          <span className="consent-logo-text">DOCCO</span>
        </div>

        {phase === "loading" && (
          <div className="consent-loading">
            <div className="consent-spinner" />
            <p>Cargando información de tu cita…</p>
          </div>
        )}

        {phase === "acting" && (
          <div className="consent-loading">
            <div className="consent-spinner" />
            <p>Procesando tu solicitud…</p>
          </div>
        )}

        {phase === "choice" && (
          <div>
            <h2 style={{ margin: "0 0 4px", color: "#1e293b", fontSize: "20px" }}>
              Tu cita
            </h2>
            {patientName && (
              <p style={{ margin: "0 0 2px", color: "#64748b", fontSize: "14px" }}>
                Paciente: <strong>{patientName}</strong>
              </p>
            )}
            {startAt && (
              <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: "14px" }}>
                Fecha y hora: <strong>{startAt}</strong>
              </p>
            )}

            <p style={{ margin: "0 0 12px", fontSize: "14px", color: "#475569" }}>
              ¿Qué deseas hacer con esta cita?
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {(["confirm", "cancel", "reschedule"] as Action[]).map((action) => {
                const { label, icon, desc } = actionLabels[action];
                const isSelected = selectedAction === action;
                return (
                  <button
                    key={action}
                    onClick={() => setSelectedAction(action)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                      padding: "12px 16px",
                      borderRadius: "10px",
                      border: isSelected
                        ? "2px solid #0d9488"
                        : "2px solid #e2e8f0",
                      background: isSelected ? "#f0fdfa" : "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "border-color 0.15s",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "18px",
                        color: isSelected ? "#0d9488" : "#94a3b8",
                        fontWeight: "bold",
                        minWidth: "20px",
                      }}
                    >
                      {icon}
                    </span>
                    <span>
                      <strong style={{ display: "block", fontSize: "14px", color: "#1e293b" }}>
                        {label}
                      </strong>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>{desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleAction}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "none",
                background: "#0d9488",
                color: "#fff",
                fontSize: "15px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              {actionLabels[selectedAction].label}
            </button>
          </div>
        )}

        {phase === "done" && (
          <div className="consent-success">
            <div className="consent-success-icon">✓</div>
            <h2>Listo</h2>
            <p>{resultMsg}</p>
            {startAt && selectedAction === "confirm" && (
              <p className="consent-date">
                Fecha y hora: <strong>{startAt}</strong>
              </p>
            )}
          </div>
        )}

        {phase === "error" && (
          <div className="consent-error">
            <div className="consent-error-icon">✗</div>
            <h2>Ocurrió un problema</h2>
            <p>{errorMsg || "Este enlace no es válido o ya expiró."}</p>
            <p className="consent-note">Si crees que esto es un error, contacta a tu clínica.</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

```bash
cd frontend/react-app && npm run build 2>&1
```

Expected: sin errores TypeScript.

- [ ] **Step 3: Importar getApiBaseUrl**

Si el build falla por `import.meta.env.VITE_API_BASE_URL`, reemplazar esa línea por:

```typescript
import { getApiBaseUrl } from "../lib/config";
// ...
const base = getApiBaseUrl();
```

Y agregar el import al inicio del archivo.

- [ ] **Step 4: Commit**

```bash
cd frontend/react-app
git add src/pages/ConfirmAppointmentPage.tsx
git commit -m "feat(confirm-page): show confirm/cancel/reschedule choice instead of auto-confirm"
```

---

## Task 9: Frontend — Logo section en PresupuestosPage

**Files:**

- Modify: `frontend/react-app/src/pages/PresupuestosPage.tsx`

- [ ] **Step 1: Agregar estado de logo**

En `PresupuestosPage.tsx`, buscar el bloque de estados (línea ~90, donde está `const [budgets, setBudgets]`). Agregar:

```typescript
const [logoUrl, setLogoUrl] = useState<string>("");
const [logoUploading, setLogoUploading] = useState(false);
```

- [ ] **Step 2: Cargar logoUrl al montar**

En el `useEffect` inicial (donde se llama `loadBudgets`), agregar:

```typescript
clinicalApi
  .getPlatformSettings(token)
  .then((s) => setLogoUrl(s.logoUrl ?? ""))
  .catch(() => {});
```

- [ ] **Step 3: Agregar función handleLogoUpload**

Después de `loadBudgets()`, agregar:

```typescript
async function handleLogoUpload(file: File) {
  if (file.size > 2 * 1024 * 1024) {
    notify.error("El logo no puede superar 2 MB");
    return;
  }
  setLogoUploading(true);
  try {
    const [{ uploadUrl, imageUrl }, currentSettings] = await Promise.all([
      clinicalApi.getOrgUploadUrl("logo", file.name, token),
      clinicalApi.getPlatformSettings(token),
    ]);
    await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    await clinicalApi.updatePlatformSettings(
      {
        sendSMS: currentSettings.sendSMS ?? true,
        sendEmail: currentSettings.sendEmail ?? true,
        signatureUrl: currentSettings.signatureUrl,
        logoUrl: imageUrl,
      },
      token,
    );
    setLogoUrl(imageUrl);
    notify.success("Logo actualizado");
  } catch {
    notify.error("Error al subir el logo");
  } finally {
    setLogoUploading(false);
  }
}
```

- [ ] **Step 4: Agregar la sección de logo en el JSX**

En el JSX de `PresupuestosPage`, buscar la sección de header o el inicio del contenido (donde está `<PageHeader` o similar). Agregar antes del listado de presupuestos, solo si el rol es admin o doctor:

```typescript
{(session.role === "admin" || session.role === "doctor") && (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "16px",
      padding: "12px 16px",
      marginBottom: "16px",
      background: "#f8fafc",
      borderRadius: "10px",
      border: "1px solid #e2e8f0",
    }}
  >
    {logoUrl ? (
      <img
        src={logoUrl}
        alt="Logo"
        style={{ height: "48px", width: "auto", objectFit: "contain", borderRadius: "4px" }}
      />
    ) : (
      <div
        style={{
          height: "48px",
          width: "80px",
          background: "#e2e8f0",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          color: "#94a3b8",
        }}
      >
        Sin logo
      </div>
    )}
    <div>
      <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: "600", color: "#334155" }}>
        Logo de la clínica
      </p>
      <label
        style={{
          fontSize: "12px",
          color: logoUploading ? "#94a3b8" : "#0d9488",
          cursor: logoUploading ? "not-allowed" : "pointer",
          fontWeight: "500",
        }}
      >
        {logoUploading ? "Subiendo…" : "Cambiar logo (PNG/JPEG, máx. 2 MB)"}
        <input
          type="file"
          accept="image/png,image/jpeg"
          style={{ display: "none" }}
          disabled={logoUploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleLogoUpload(file);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  </div>
)}
```

- [ ] **Step 5: Build**

```bash
cd frontend/react-app && npm run build 2>&1
```

Si hay error por `session` no disponible en el componente, verificar que `session` es prop de `PresupuestosPage`. Si solo recibe `token`, usar:

```typescript
// Alternativa: leer rol desde token JWT
// Pero si session no está disponible como prop, simplemente quitar la condición de rol:
{true && ( ... )}
```

- [ ] **Step 6: Commit**

```bash
cd frontend/react-app
git add src/pages/PresupuestosPage.tsx
git commit -m "feat(presupuestos): add clinic logo upload section"
```

---

## Task 10: Deploy

- [ ] **Step 1: Tests backend completos**

```bash
cd backend && go test ./... 2>&1
```

Expected: todos pasan.

- [ ] **Step 2: Build frontend final**

```bash
cd frontend/react-app && npm run build 2>&1
```

Expected: sin errores.

- [ ] **Step 3: SAM build**

```bash
cd backend && sam build 2>&1
```

Expected: `Build Succeeded`.

- [ ] **Step 4: SAM deploy**

```bash
cd backend && sam deploy 2>&1
```

Expected: `Successfully deployed`.

- [ ] **Step 5: Fix CORS post-deploy**

```bash
bash scripts/fix-apigw-after-deploy.sh
```

- [ ] **Step 6: Push frontend para CodePipeline**

```bash
git push origin main
```

CodePipeline desplegará automáticamente el frontend a CloudFront.

- [ ] **Step 7: Verificar en producción**

1. Abrir `https://docco.aloai.me/confirm-appointment?token=TEST` — debe mostrar la página de elección (o "enlace inválido" si el token no existe, lo cual es correcto).
2. Abrir una cita en consulta (EN CURSO) — el timer debe mostrar tiempo positivo creciente.
3. En Presupuestos, el admin/doctor debe ver la sección de logo arriba del listado.

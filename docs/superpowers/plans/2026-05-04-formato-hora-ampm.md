# Formato de hora AM/PM — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar toda presentación de horas al formato "8:00 a.m." / "2:30 p.m." en frontend (React) y backend (Go), sin modificar el almacenamiento ni la API.

**Architecture:** Una función centralizada por capa: `fmt12h`/`fmt12hDate` en TypeScript (`src/lib/constants.ts`) y `util.FormatHora` en Go (`internal/util/time.go`). Todos los `toLocaleTimeString` y `Format("15:04")` visibles al usuario se reemplazan con estas funciones.

**Tech Stack:** Go 1.24 (módulo `clinical-backend`), React 18, TypeScript, Vite

---

### Task 1: Backend — función FormatHora

**Files:**

- Create: `backend/internal/util/time.go`
- Create: `backend/internal/util/time_test.go`

- [ ] **Step 1: Crear `backend/internal/util/time.go`**

```go
package util

import (
	"fmt"
	"time"
)

// FormatHora convierte time.Time a "8:00 a.m." / "2:30 p.m." en la zona horaria dada.
func FormatHora(t time.Time, loc *time.Location) string {
	local := t.In(loc)
	h := local.Hour()
	m := local.Minute()
	period := "a.m."
	if h >= 12 {
		period = "p.m."
	}
	h12 := h % 12
	if h12 == 0 {
		h12 = 12
	}
	return fmt.Sprintf("%d:%02d %s", h12, m, period)
}
```

- [ ] **Step 2: Crear `backend/internal/util/time_test.go`**

```go
package util

import (
	"testing"
	"time"
)

func TestFormatHora(t *testing.T) {
	loc := time.UTC
	cases := []struct {
		h, m int
		want string
	}{
		{0, 0, "12:00 a.m."},
		{8, 0, "8:00 a.m."},
		{9, 30, "9:30 a.m."},
		{12, 0, "12:00 p.m."},
		{14, 30, "2:30 p.m."},
		{23, 59, "11:59 p.m."},
	}
	for _, c := range cases {
		ts := time.Date(2026, 1, 1, c.h, c.m, 0, 0, loc)
		got := FormatHora(ts, loc)
		if got != c.want {
			t.Errorf("FormatHora(%d:%02d) = %q, want %q", c.h, c.m, got, c.want)
		}
	}
}
```

- [ ] **Step 3: Ejecutar el test**

```bash
cd backend && go test ./internal/util/... -v
```

Expected: 6 subcasos PASS

- [ ] **Step 4: Commit**

```bash
git add backend/internal/util/time.go backend/internal/util/time_test.go
git commit -m "feat(util): add FormatHora helper — 12h a.m./p.m. display"
```

---

### Task 2: Backend — notifier.go

**Files:**

- Modify: `backend/internal/notifications/notifier.go`

- [ ] **Step 1: Añadir import de util al bloque de imports existente**

Localizar el bloque `import (...)` en `notifier.go` y añadir:

```go
utilpkg "clinical-backend/internal/util"
```

- [ ] **Step 2: Actualizar `SendAppointmentCreated` (~línea 334)**

Reemplazar:

```go
timeStr := appt.StartAt.Format("15:04")
```

Con:

```go
loc := time.UTC
if tz := os.Getenv("CLINIC_TZ"); tz != "" {
    if l, err := time.LoadLocation(tz); err == nil {
        loc = l
    }
}
timeStr := utilpkg.FormatHora(appt.StartAt, loc)
```

- [ ] **Step 3: Actualizar `SendAppointmentCreatedSMS` (~línea 395)**

Añadir bloque de timezone antes de `msg := fmt.Sprintf(...)`:

```go
loc := time.UTC
if tz := os.Getenv("CLINIC_TZ"); tz != "" {
    if l, err := time.LoadLocation(tz); err == nil {
        loc = l
    }
}
```

Reemplazar los dos usos de `appt.StartAt.Format("15:04")` en esta función:

```go
// antes:
appt.StartAt.Format("15:04"),
// después:
utilpkg.FormatHora(appt.StartAt, loc),
```

(Aplica en la línea del `msg` principal y en el fallback corto `if len(msg) > 160`.)

- [ ] **Step 4: Actualizar `SendAppointmentEvent` (~línea 455)**

Reemplazar:

```go
startStr := startAt.Format("15:04")
endStr := endAt.Format("15:04")
```

Con:

```go
loc := time.UTC
if tz := os.Getenv("CLINIC_TZ"); tz != "" {
    if l, err := time.LoadLocation(tz); err == nil {
        loc = l
    }
}
startStr := utilpkg.FormatHora(startAt, loc)
endStr := utilpkg.FormatHora(endAt, loc)
```

- [ ] **Step 5: Compilar para verificar**

```bash
cd backend && go build ./...
```

Expected: sin errores de compilación

- [ ] **Step 6: Commit**

```bash
git add backend/internal/notifications/notifier.go
git commit -m "feat(notifications): use 12h a.m./p.m. in email and SMS"
```

---

### Task 3: Backend — appointment_service.go y chat_service.go

**Files:**

- Modify: `backend/internal/service/appointment_service.go`
- Modify: `backend/internal/service/chat_service.go`

- [ ] **Step 1: appointment_service.go — añadir import**

Añadir al bloque import:

```go
utilpkg "clinical-backend/internal/util"
```

- [ ] **Step 2: appointment_service.go — mensaje de conflicto (~línea 146)**

Reemplazar:

```go
return domain.Appointment{}, fmt.Errorf("el horario de %s a %s ya está ocupado", startAt.In(loc).Format("15:04"), endAt.In(loc).Format("15:04"))
```

Con:

```go
return domain.Appointment{}, fmt.Errorf("el horario de %s a %s ya está ocupado", utilpkg.FormatHora(startAt, loc), utilpkg.FormatHora(endAt, loc))
```

- [ ] **Step 3: chat_service.go — añadir import**

Añadir al bloque import:

```go
utilpkg "clinical-backend/internal/util"
```

- [ ] **Step 4: chat_service.go — citas de hoy y mañana (~líneas 267 y 286)**

Hay dos bloques idénticos (citas de hoy / citas de mañana). Reemplazar en ambos:

```go
hora := a.StartAt.In(s.tz).Format("3:04 PM")
```

Con:

```go
hora := utilpkg.FormatHora(a.StartAt, s.tz)
```

- [ ] **Step 5: Compilar y ejecutar todos los tests**

```bash
cd backend && go build ./... && go test ./...
```

Expected: build OK, todos los tests pasan

- [ ] **Step 6: Commit**

```bash
git add backend/internal/service/appointment_service.go \
        backend/internal/service/chat_service.go
git commit -m "feat(service): use 12h a.m./p.m. in conflict message and chat context"
```

---

### Task 4: Frontend — fmt12h y fmt12hDate en constants.ts

**Files:**

- Modify: `frontend/react-app/src/lib/constants.ts`

- [ ] **Step 1: Reemplazar `fmtTimeSlot` con `fmt12h` y añadir `fmt12hDate`**

Reemplazar el bloque completo:

```typescript
/** Formats a "HH:MM" time slot string to 12-hour AM/PM format. */
export function fmtTimeSlot(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}
```

Con:

```typescript
/** "14:30" → "2:30 p.m." */
export function fmt12h(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const period = h < 12 ? "a.m." : "p.m.";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Date → "2:30 p.m." */
export function fmt12hDate(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h < 12 ? "a.m." : "p.m.";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
```

- [ ] **Step 2: Verificar que el build muestra solo errores esperados (usos de fmtTimeSlot)**

```bash
cd frontend/react-app && npm run build 2>&1 | grep "fmtTimeSlot"
```

Expected: errores en DashboardHome.tsx (únicos consumidores de fmtTimeSlot)

- [ ] **Step 3: Commit**

```bash
git add frontend/react-app/src/lib/constants.ts
git commit -m "feat(constants): replace fmtTimeSlot with fmt12h/fmt12hDate"
```

---

### Task 5: Frontend — DashboardHome.tsx

**Files:**

- Modify: `frontend/react-app/src/pages/DashboardHome.tsx`

- [ ] **Step 1: Actualizar import (~línea 16)**

Buscar la línea:

```typescript
import { fmtTimeSlot, ... } from "@/lib/constants";
```

Reemplazar `fmtTimeSlot` con `fmt12h, fmt12hDate` en ese import (mantener el resto sin cambios).

- [ ] **Step 2: Actualizar `rowTime()` (~línea 353)**

Reemplazar:

```typescript
const rowTime = (row: AppointmentRow) =>
  new Date(row.startAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
```

Con:

```typescript
const rowTime = (row: AppointmentRow) => fmt12hDate(new Date(row.startAt));
```

- [ ] **Step 3: Actualizar uso de `fmtTimeSlot` (~línea 447)**

Buscar `fmtTimeSlot(s)` y reemplazar con `fmt12h(s)`.

- [ ] **Step 4: Verificar compilación**

```bash
cd frontend/react-app && npm run build 2>&1 | grep -E "error|fmtTimeSlot" | head -20
```

Expected: sin menciones de fmtTimeSlot ni errores en DashboardHome

- [ ] **Step 5: Commit**

```bash
git add frontend/react-app/src/pages/DashboardHome.tsx
git commit -m "feat(dashboard): use fmt12hDate for appointment time display"
```

---

### Task 6: Frontend — AppointmentsPage.tsx

**Files:**

- Modify: `frontend/react-app/src/pages/AppointmentsPage.tsx`

- [ ] **Step 1: Añadir import de `fmt12h` y `fmt12hDate`**

Buscar el import existente de `@/lib/constants` (o ruta relativa) y añadir `fmt12h` y `fmt12hDate` a la lista.

- [ ] **Step 2: Actualizar `formatTimeRange` (~línea 101)**

Reemplazar:

```typescript
function formatTimeRange(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}
```

Con:

```typescript
function formatTimeRange(startAt: string, endAt: string): string {
  return `${fmt12hDate(new Date(startAt))} – ${fmt12hDate(new Date(endAt))}`;
}
```

- [ ] **Step 3: Actualizar `formatSlotLabel` (~línea 109)**

Reemplazar:

```typescript
function formatSlotLabel(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}
```

Con:

```typescript
function formatSlotLabel(slot: string): string {
  return fmt12h(slot);
}
```

- [ ] **Step 4: Verificar compilación**

```bash
cd frontend/react-app && npm run build 2>&1 | grep -i "error" | head -20
```

Expected: sin errores en AppointmentsPage.tsx

- [ ] **Step 5: Commit**

```bash
git add frontend/react-app/src/pages/AppointmentsPage.tsx
git commit -m "feat(appointments): use fmt12h/fmt12hDate for time display"
```

---

### Task 7: Frontend — CalendarPage.tsx

**Files:**

- Modify: `frontend/react-app/src/pages/CalendarPage.tsx`

- [ ] **Step 1: Añadir import de `fmt12h` y `fmt12hDate`**

Buscar el import de `@/lib/constants` en CalendarPage.tsx y añadir `fmt12h` y `fmt12hDate`.

- [ ] **Step 2: Pills del calendario mensual (~línea 355)**

Reemplazar:

```typescript
const start = new Date(appt.startAt).toLocaleTimeString([], {
  hour: "2-digit",
  minute: "2-digit",
});
```

Con:

```typescript
const start = fmt12hDate(new Date(appt.startAt));
```

- [ ] **Step 3: Labels del timeline semanal (~línea 470)**

Reemplazar:

```typescript
const label = hour < 12 ? `${hour}am` : hour === 12 ? "12pm" : `${hour - 12}pm`;
```

Con:

```typescript
const label = fmt12h(`${hour}:00`);
```

- [ ] **Step 4: Hora de cita en el bloque del timeline (~línea 531)**

Reemplazar:

```typescript
const startFmt = new Date(appt.startAt).toLocaleTimeString([], {
  hour: "2-digit",
  minute: "2-digit",
});
```

Con:

```typescript
const startFmt = fmt12hDate(new Date(appt.startAt));
```

- [ ] **Step 5: Panel de detalle de cita (~línea 692)**

Reemplazar:

```typescript
const fmt = (d: Date) =>
  d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
```

Con:

```typescript
const fmt = fmt12hDate;
```

- [ ] **Step 6: Verificar compilación**

```bash
cd frontend/react-app && npm run build 2>&1 | grep -i "error" | head -20
```

Expected: sin errores en CalendarPage.tsx

- [ ] **Step 7: Commit**

```bash
git add frontend/react-app/src/pages/CalendarPage.tsx
git commit -m "feat(calendar): use fmt12h/fmt12hDate for all time labels"
```

---

### Task 8: Frontend — PatientsPage, PatientDetailPage, DoccoMessage

**Files:**

- Modify: `frontend/react-app/src/pages/PatientsPage.tsx`
- Modify: `frontend/react-app/src/pages/PatientDetailPage.tsx`
- Modify: `frontend/react-app/src/modules/docco/DoccoMessage.tsx`

- [ ] **Step 1: PatientsPage.tsx — import y `fmtTime` (~línea 54)**

Añadir `fmt12hDate` al import de constants. Reemplazar:

```typescript
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
```

Con:

```typescript
function fmtTime(iso: string) {
  return fmt12hDate(new Date(iso));
}
```

- [ ] **Step 2: PatientDetailPage.tsx — import y `toLocaleTimeString` (~línea 74)**

Añadir `fmt12hDate` al import de `@/lib/constants`. Reemplazar:

```typescript
time: dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
```

Con:

```typescript
time: fmt12hDate(dt),
```

- [ ] **Step 3: DoccoMessage.tsx — import y `fmtTime` local (~línea 3)**

Añadir import al inicio del archivo:

```typescript
import { fmt12hDate } from "@/lib/constants";
```

Reemplazar:

```typescript
function fmtTime(d: Date) {
  return d.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
}
```

Con:

```typescript
function fmtTime(d: Date) {
  return fmt12hDate(d);
}
```

- [ ] **Step 4: Verificar build completo sin errores**

```bash
cd frontend/react-app && npm run build 2>&1 | tail -10
```

Expected: `✓ built in X.XXs` sin líneas de error

- [ ] **Step 5: Commit final frontend**

```bash
git add frontend/react-app/src/pages/PatientsPage.tsx \
        frontend/react-app/src/pages/PatientDetailPage.tsx \
        frontend/react-app/src/modules/docco/DoccoMessage.tsx
git commit -m "feat(frontend): apply fmt12hDate in patients, detail, and chat views"
```

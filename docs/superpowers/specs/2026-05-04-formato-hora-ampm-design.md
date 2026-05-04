# Diseño: Formato de hora AM/PM en todo el sistema

**Fecha:** 2026-05-04  
**Estado:** Aprobado

## Problema

El sistema usa una mezcla inconsistente de formatos de hora:

- Formato 24h (`"14:30"`) en la mayoría de vistas frontend y notificaciones backend
- Formato 12h parcial (`fmtTimeSlot`, timeline del calendario) en algunos lugares
- `toLocaleTimeString()` sin `hour12: true` explícito, cuyo resultado varía por navegador/OS

## Objetivo

Unificar **toda** presentación de horas al formato `"8:00 a.m."` / `"2:30 p.m."` (minúsculas, con puntos, sin cero a la izquierda en la hora). Los datos internos (DynamoDB, API) siguen usando ISO 8601 — solo cambia la capa de presentación.

## Decisiones de diseño

- **Enfoque A: función centralizada manual** en cada capa.
- Sin dependencias nuevas (no dayjs, no date-fns).
- `toLocaleTimeString()` descartado por inconsistencia entre navegadores.

---

## Sección 1: Frontend

### Funciones nuevas en `src/lib/constants.ts`

Reemplazar `fmtTimeSlot` con dos variantes:

```typescript
// "14:30" → "2:30 p.m."
export function fmt12h(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const period = h < 12 ? "a.m." : "p.m.";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// Date object → "2:30 p.m."
export function fmt12hDate(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h < 12 ? "a.m." : "p.m.";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
```

`fmtTimeSlot` se elimina; todos sus usos se migran a `fmt12h`.

### Archivos afectados

| Archivo                              | Cambio                                                          |
| ------------------------------------ | --------------------------------------------------------------- |
| `src/lib/constants.ts`               | `fmtTimeSlot` → `fmt12h` + nueva `fmt12hDate`                   |
| `src/pages/AppointmentsPage.tsx`     | `formatTimeRange` y `formatSlotLabel` → `fmt12h`/`fmt12hDate`   |
| `src/pages/CalendarPage.tsx`         | Timeline manual y todos los `toLocaleTimeString` → `fmt12hDate` |
| `src/pages/DashboardHome.tsx`        | `rowTime()` → `fmt12hDate`                                      |
| `src/pages/PatientsPage.tsx`         | `fmtTime()` → `fmt12hDate`                                      |
| `src/pages/PatientDetailPage.tsx`    | `toLocaleTimeString` → `fmt12hDate`                             |
| `src/modules/docco/DoccoMessage.tsx` | `toLocaleTimeString("es-VE",…)` → `fmt12hDate`                  |

### Lo que NO cambia

- `TIME_SLOTS` internos (`"08:00"`, `"09:30"`…) — son keys de negocio, no de presentación.
- Lógica de selección/guardado de citas — sin cambios.

---

## Sección 2: Backend (Go)

### Función helper en `internal/util/time.go` (nuevo archivo)

```go
package util

import (
    "fmt"
    "time"
)

// FormatHora convierte time.Time a "2:30 p.m." en la zona horaria dada.
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

### Archivos afectados

| Archivo                                   | Cambio                                                             |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `internal/util/time.go`                   | **Nuevo** — `FormatHora()`                                         |
| `internal/notifications/notifier.go`      | Todos los `Format("15:04")` → `util.FormatHora(t, loc)`            |
| `internal/service/chat_service.go`        | `Format("3:04 PM")` → `util.FormatHora(t, loc)`                    |
| `internal/service/appointment_service.go` | Mensaje de conflicto `Format("15:04")` → `util.FormatHora(t, loc)` |

### Lo que NO cambia

- `dynamodb.go` — formatos de sort key e ISO 8601 (internos, nunca visibles al usuario).
- Parseo de fechas en la API (`time.RFC3339`).
- Zona horaria de la clínica — `FormatHora` la recibe como parámetro, igual que hoy.

### Ejemplo de resultado

SMS antes: `"tu cita del 21/02/2026 de 14:30 a 15:00"`  
SMS después: `"tu cita del 21/02/2026 de 2:30 p.m. a 3:00 p.m."`

---

## Criterios de éxito

1. Ningún `"15:04"` visible al usuario en notificaciones Go.
2. Ningún `toLocaleTimeString` sin `hour12` explícito en el frontend.
3. `fmtTimeSlot` eliminado y reemplazado por `fmt12h`.
4. Todos los horarios en UI muestran `"X:XX a.m."` / `"X:XX p.m."`.
5. Los tests Go existentes siguen pasando (`go test ./...`).
6. El build frontend compila sin errores (`npm run build`).

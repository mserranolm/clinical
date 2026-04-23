# Diseño: Canales de Notificación Dinámicos y Configuración de Plataforma

**Fecha:** 2026-04-22
**Estado:** Aprobado

---

## Objetivo

Permitir al super admin activar o desactivar dinámicamente los canales de notificación (SMS y email) a nivel global de plataforma desde la UI, sin necesidad de redeploy. Cualquier combinación es válida: ambos, solo uno, o ninguno.

---

## Contexto

Actualmente los flags `SEND_SMS` y `SEND_EMAIL` se leen de variables de entorno al arrancar Lambda. Cambiarlos requiere un redeploy. El notificador tiene una clase `Router` con campos `sendSMS`/`sendEmail` que se inicializan una sola vez desde `config.go`.

Algunas notificaciones son email-only, otras SMS-only. El parámetro `channel` por cita determina el canal en `SendAppointmentReminder`. Este comportamiento se reemplaza: el setting global manda sobre cualquier preferencia por cita.

---

## Decisiones de Diseño

| Decisión                            | Elección                                | Razón                                       |
| ----------------------------------- | --------------------------------------- | ------------------------------------------- |
| Alcance del setting                 | Global (toda la plataforma)             | No se necesita configuración por org        |
| Almacenamiento                      | DynamoDB nueva tabla `PlatformSettings` | Extensible, dinámico, sin redeploy          |
| Granularidad del toggle             | SMS independiente de Email              | Cada canal se activa/desactiva por separado |
| Override de canal por cita          | Sí — el setting global lo ignora        | El super admin controla todo                |
| Fallback si no existe ítem DynamoDB | Lee env vars `SEND_SMS`/`SEND_EMAIL`    | Primer arranque sin romper nada             |

---

## Arquitectura

### 1. Nueva tabla DynamoDB

**Nombre:** `PlatformSettingsTable`  
**Billing:** PAY_PER_REQUEST  
**Ítem único:**

```
PK = "PLATFORM#SETTINGS"
SK = "CONFIG"
sendSMS   = true | false
sendEmail = true | false
```

### 2. Backend Go

**Nuevo struct en `store/repositories.go`:**

```go
type PlatformSettings struct {
    SendSMS   bool `json:"sendSMS"`
    SendEmail bool `json:"sendEmail"`
}
```

**Nuevos métodos en el store DynamoDB:**

- `GetPlatformSettings() (*PlatformSettings, error)` — lee el ítem; si no existe devuelve fallback desde env vars
- `UpdatePlatformSettings(settings PlatformSettings) error` — hace PutItem

**Nuevos endpoints (solo `platform_admin`):**

- `GET /platform/settings` → devuelve `PlatformSettings` actual
- `PUT /platform/settings` → body `{"sendSMS": bool, "sendEmail": bool}` → actualiza y devuelve el nuevo estado

**Cambio en `notifications/notifier.go`:**

- El `Router` deja de leer flags al arrancar desde `config.Config`
- En cada llamada de envío, consulta DynamoDB para obtener los settings actuales
- Caché en memoria con TTL de 60 segundos para no golpear DynamoDB en cada notificación
- El parámetro `channel` de funciones como `SendAppointmentReminder` se ignora — si SMS está activo se envía por SMS, si email está activo se envía por email, ambos si ambos están activos

**Comportamiento por canal activo:**

| sendSMS | sendEmail | Resultado                     |
| ------- | --------- | ----------------------------- |
| true    | true      | Envía por SMS **y** email     |
| true    | false     | Solo SMS                      |
| false   | true      | Solo email                    |
| false   | false     | No envía (log de advertencia) |

### 3. Frontend React

**Nueva sección "Configuración de Plataforma"** en `AdminConsoleHome.tsx`:

- Accesible desde el nav lateral del super admin
- Subsección "Canales de Notificación" con dos toggles:
  - **Email** — toggle on/off con badge de estado
  - **SMS** — toggle on/off con badge de estado
- Botón "Guardar" que llama a `PUT /platform/settings`
- Toast de éxito/error al guardar
- Carga valores actuales al montar vía `GET /platform/settings`

**Nuevas funciones en `src/api/clinical.ts`:**

```ts
getPlatformSettings(): Promise<{ sendSMS: boolean; sendEmail: boolean }>
updatePlatformSettings(settings: { sendSMS: boolean; sendEmail: boolean }): Promise<void>
```

### 4. Infraestructura (`template.yaml`)

- Nueva tabla `PlatformSettingsTable` con `BillingMode: PAY_PER_REQUEST`
- Nueva env var `PLATFORM_SETTINGS_TABLE` en todas las funciones Lambda
- Política IAM adicional: `dynamodb:GetItem` y `dynamodb:PutItem` sobre `PlatformSettingsTable`
- Las env vars `SEND_SMS`/`SEND_EMAIL` se mantienen como fallback de inicialización

---

## Flujo de Deploy

1. `aws sso login --profile aloai`
2. `cd backend && sam build`
3. `sam deploy` → crea la nueva tabla automáticamente
4. `scripts/fix-apigw-after-deploy.sh` → restaura CORS
5. El super admin entra a "Configuración de Plataforma" → los toggles muestran el estado por defecto (desde env vars en primer GET)
6. Super admin ajusta y guarda → queda persistido en DynamoDB

---

## Archivos Modificados

| Archivo                                                   | Cambio                                                           |
| --------------------------------------------------------- | ---------------------------------------------------------------- |
| `backend/template.yaml`                                   | Nueva tabla, env var, IAM policy                                 |
| `backend/internal/store/repositories.go`                  | Nuevo struct `PlatformSettings`                                  |
| `backend/internal/store/dynamodb.go`                      | Nuevos métodos Get/Update PlatformSettings                       |
| `backend/internal/store/in_memory.go`                     | Implementación in-memory para tests locales                      |
| `backend/internal/service/auth_service.go`                | Nuevos métodos Get/Update PlatformSettings                       |
| `backend/internal/api/router.go`                          | Nuevos endpoints GET/PUT `/platform/settings`                    |
| `backend/internal/notifications/notifier.go`              | Caché DynamoDB, ignorar canal por cita, enviar a ambos si aplica |
| `frontend/react-app/src/api/clinical.ts`                  | Nuevas funciones getPlatformSettings / updatePlatformSettings    |
| `frontend/react-app/src/pages/admin/AdminConsoleHome.tsx` | Nueva sección "Configuración de Plataforma"                      |

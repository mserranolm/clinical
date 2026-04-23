# Notification Channels & Platform Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir al super admin activar/desactivar SMS y email globalmente desde la UI sin redeploy, almacenando la config en DynamoDB con caché de 60 segundos en el notifier.

**Architecture:** Nueva tabla DynamoDB `PlatformSettingsTable` con un ítem singleton `PK=PLATFORM#SETTINGS / SK=CONFIG`. El notifier carga los settings desde DynamoDB con caché de 60s en lugar de leerlos al arrancar. Dos nuevos endpoints REST (`GET/PUT /platform/settings`) expuestos solo a `platform_admin`. Nueva sección "Configuración de Plataforma" en el super admin console con toggles de SMS y email.

**Tech Stack:** Go 1.21, AWS SDK v2 DynamoDB, React 18, TypeScript, SAM/CloudFormation

---

## File Map

| Archivo                                                   | Cambio                                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `backend/template.yaml`                                   | Nueva tabla `PlatformSettingsTable`, env var, IAM policies                                                   |
| `backend/internal/config/config.go`                       | Nuevo campo `PlatformSettingsTable`                                                                          |
| `backend/internal/store/repositories.go`                  | Nuevo struct `PlatformSettings` + interfaz `PlatformSettingsRepository` + `memoryPlatformSettingsRepo`       |
| `backend/internal/store/dynamodb.go`                      | Implementación DynamoDB de `PlatformSettingsRepository` + campo en `DynamoDBRepositories` + `DynamoDBConfig` |
| `backend/internal/notifications/notifier.go`              | Caché 60s + `getSettings()` + reemplazar `r.sendSMS`/`r.sendEmail` con llamada dinámica                      |
| `backend/internal/service/platform_settings_service.go`   | Nuevo archivo: `PlatformSettingsService` con Get/Update                                                      |
| `backend/internal/api/router.go`                          | Nuevos endpoints `GET/PUT /platform/settings` + campo en `Router`                                            |
| `backend/cmd/api/main.go`                                 | Mover init del notifier después de repos; wiring de `PlatformSettingsService`                                |
| `frontend/react-app/src/api/clinical.ts`                  | Nuevas funciones `getPlatformSettings` / `updatePlatformSettings`                                            |
| `frontend/react-app/src/pages/admin/AdminConsoleHome.tsx` | Nueva sección "Configuración de Plataforma" con tabs y toggles                                               |

---

### Task 1: template.yaml — Nueva tabla, env var e IAM

**Files:**

- Modify: `backend/template.yaml`

- [ ] **Step 1: Añadir tabla PlatformSettingsTable**

Justo antes de la línea de la tabla `AppointmentsTable` (que empieza con `AppointmentsTable:`), insertar:

```yaml
PlatformSettingsTable:
  Type: AWS::DynamoDB::Table
  DeletionPolicy: Retain
  UpdateReplacePolicy: Retain
  Properties:
    BillingMode: PAY_PER_REQUEST
    TableName: clinical-platform-settings
    AttributeDefinitions:
      - AttributeName: PK
        AttributeType: S
      - AttributeName: SK
        AttributeType: S
    KeySchema:
      - AttributeName: PK
        KeyType: HASH
      - AttributeName: SK
        KeyType: RANGE
    Tags:
      - Key: product
        Value: clinisense
```

- [ ] **Step 2: Añadir env var PLATFORM_SETTINGS_TABLE en Globals**

En la sección `Globals.Function.Environment.Variables`, después de `BUDGET_TABLE: !Ref BudgetsTable`, añadir:

```yaml
PLATFORM_SETTINGS_TABLE: !Ref PlatformSettingsTable
```

- [ ] **Step 3: Añadir IAM policy a ClinicalApiFunction**

En `ClinicalApiFunction.Properties.Policies`, añadir al final de la lista (antes de `Events:`):

```yaml
- DynamoDBCrudPolicy:
    TableName: !Ref PlatformSettingsTable
```

- [ ] **Step 4: Añadir IAM policy a Reminder24hFunction**

En `Reminder24hFunction.Properties.Policies`, añadir al final de la lista (antes de `Events:`):

```yaml
- DynamoDBCrudPolicy:
    TableName: !Ref PlatformSettingsTable
```

- [ ] **Step 5: Añadir IAM policy a EndOfDayFunction**

En `EndOfDayFunction.Properties.Policies`, añadir al final de la lista (antes de `Events:`):

```yaml
- DynamoDBCrudPolicy:
    TableName: !Ref PlatformSettingsTable
```

- [ ] **Step 6: Verificar que el YAML compila sin error**

```bash
cd /Users/manuelserrano/Trabajo/Personal/clinical/backend
sam validate --lint
```

Expected: sin errores de validación (puede haber warnings menores).

---

### Task 2: config.go — Nuevo campo PlatformSettingsTable

**Files:**

- Modify: `backend/internal/config/config.go`

- [ ] **Step 1: Añadir campo al struct Config**

En el struct `Config`, después de `BudgetTable string`, añadir:

```go
	PlatformSettingsTable string
```

- [ ] **Step 2: Añadir carga del campo en Load()**

En la función `Load()`, dentro del `return Config{...}`, después de `BudgetTable: getEnv("BUDGET_TABLE", "clinical-budgets"),`, añadir:

```go
		PlatformSettingsTable: getEnv("PLATFORM_SETTINGS_TABLE", "clinical-platform-settings"),
```

- [ ] **Step 3: Verificar compilación**

```bash
cd /Users/manuelserrano/Trabajo/Personal/clinical/backend
go build ./internal/config/...
```

Expected: sin errores.

---

### Task 3: repositories.go — Struct PlatformSettings, interfaz y repo in-memory

**Files:**

- Modify: `backend/internal/store/repositories.go`

- [ ] **Step 1: Añadir struct PlatformSettings**

Después del struct `PasswordResetToken` (que termina con `Used bool` y `}`), añadir:

```go
type PlatformSettings struct {
	SendSMS   bool `json:"sendSMS"`
	SendEmail bool `json:"sendEmail"`
}
```

- [ ] **Step 2: Añadir interfaz PlatformSettingsRepository**

Después de la interfaz `BudgetRepository`, añadir:

```go
type PlatformSettingsRepository interface {
	GetSettings(ctx context.Context) (PlatformSettings, error)
	UpdateSettings(ctx context.Context, settings PlatformSettings) error
}
```

- [ ] **Step 3: Añadir campo a InMemoryRepositories**

En el struct `InMemoryRepositories`, después de `Budgets BudgetRepository`, añadir:

```go
	PlatformSettings PlatformSettingsRepository
```

- [ ] **Step 4: Añadir implementación in-memory**

Al final del archivo (antes del último `}`), añadir el tipo in-memory. Buscar la sección de implementaciones in-memory (donde están `memoryPatientRepo`, etc.) y añadir:

```go
type memoryPlatformSettingsRepo struct {
	mu       sync.Mutex
	settings PlatformSettings
}

func (r *memoryPlatformSettingsRepo) GetSettings(_ context.Context) (PlatformSettings, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.settings, nil
}

func (r *memoryPlatformSettingsRepo) UpdateSettings(_ context.Context, s PlatformSettings) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.settings = s
	return nil
}
```

- [ ] **Step 5: Inicializar en NewInMemoryRepositories()**

En `NewInMemoryRepositories()`, añadir en el return:

```go
		PlatformSettings: &memoryPlatformSettingsRepo{
			settings: PlatformSettings{SendSMS: true, SendEmail: true},
		},
```

- [ ] **Step 6: Verificar compilación**

```bash
cd /Users/manuelserrano/Trabajo/Personal/clinical/backend
go build ./internal/store/...
```

Expected: sin errores.

---

### Task 4: dynamodb.go — Implementación DynamoDB de PlatformSettingsRepository

**Files:**

- Modify: `backend/internal/store/dynamodb.go`

- [ ] **Step 1: Añadir PlatformSettingsTableName a DynamoDBConfig**

En el struct `DynamoDBConfig`, después de `BudgetTableName string`, añadir:

```go
	PlatformSettingsTableName string
```

- [ ] **Step 2: Añadir campo PlatformSettings a DynamoDBRepositories**

En el struct `DynamoDBRepositories`, después de `Budgets BudgetRepository`, añadir:

```go
	PlatformSettings PlatformSettingsRepository
```

- [ ] **Step 3: Inicializar PlatformSettings en NewDynamoDBRepositories()**

En la función `NewDynamoDBRepositories()`, en el `return &DynamoDBRepositories{...}` (que ya asigna `Patients`, `Appointments`, etc.), añadir:

```go
		PlatformSettings: &dynamoPlatformSettingsRepo{
			client:    client,
			tableName: cfg.PlatformSettingsTableName,
		},
```

- [ ] **Step 4: Pasar PlatformSettingsTableName en DynamoDBConfig**

En el mismo `NewDynamoDBRepositories`, el `cfg.PlatformSettingsTableName` se pasa desde `main.go` en el siguiente task. Por ahora el campo quedará vacío si no se pasa — la implementación debe manejar esto con un nombre por defecto.

- [ ] **Step 5: Añadir implementación dynamoPlatformSettingsRepo**

Al final del archivo `dynamodb.go`, añadir:

```go
type dynamoPlatformSettingsRepo struct {
	client    *dynamodb.Client
	tableName string
}

func (r *dynamoPlatformSettingsRepo) GetSettings(ctx context.Context) (PlatformSettings, error) {
	tbl := r.tableName
	if tbl == "" {
		tbl = "clinical-platform-settings"
	}
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(tbl),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: "PLATFORM#SETTINGS"},
			"SK": &types.AttributeValueMemberS{Value: "CONFIG"},
		},
	})
	if err != nil {
		return PlatformSettings{SendSMS: true, SendEmail: true}, fmt.Errorf("get platform settings: %w", err)
	}
	if out.Item == nil {
		return PlatformSettings{SendSMS: true, SendEmail: true}, nil
	}
	var row struct {
		SendSMS   bool `dynamodbav:"sendSMS"`
		SendEmail bool `dynamodbav:"sendEmail"`
	}
	if err := attributevalue.UnmarshalMap(out.Item, &row); err != nil {
		return PlatformSettings{SendSMS: true, SendEmail: true}, fmt.Errorf("unmarshal platform settings: %w", err)
	}
	return PlatformSettings{SendSMS: row.SendSMS, SendEmail: row.SendEmail}, nil
}

func (r *dynamoPlatformSettingsRepo) UpdateSettings(ctx context.Context, s PlatformSettings) error {
	tbl := r.tableName
	if tbl == "" {
		tbl = "clinical-platform-settings"
	}
	item, err := attributevalue.MarshalMap(map[string]interface{}{
		"PK":        "PLATFORM#SETTINGS",
		"SK":        "CONFIG",
		"sendSMS":   s.SendSMS,
		"sendEmail": s.SendEmail,
	})
	if err != nil {
		return fmt.Errorf("marshal platform settings: %w", err)
	}
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(tbl),
		Item:      item,
	})
	return err
}
```

- [ ] **Step 6: Verificar compilación**

```bash
cd /Users/manuelserrano/Trabajo/Personal/clinical/backend
go build ./internal/store/...
```

Expected: sin errores.

---

### Task 5: platform_settings_service.go — Nuevo servicio

**Files:**

- Create: `backend/internal/service/platform_settings_service.go`

- [ ] **Step 1: Crear el archivo del servicio**

```go
package service

import (
	"context"

	"clinical-backend/internal/store"
)

type PlatformSettingsService struct {
	repo store.PlatformSettingsRepository
}

func NewPlatformSettingsService(repo store.PlatformSettingsRepository) *PlatformSettingsService {
	return &PlatformSettingsService{repo: repo}
}

func (s *PlatformSettingsService) GetSettings(ctx context.Context) (store.PlatformSettings, error) {
	return s.repo.GetSettings(ctx)
}

func (s *PlatformSettingsService) UpdateSettings(ctx context.Context, settings store.PlatformSettings) error {
	return s.repo.UpdateSettings(ctx, settings)
}
```

- [ ] **Step 2: Verificar compilación**

```bash
cd /Users/manuelserrano/Trabajo/Personal/clinical/backend
go build ./internal/service/...
```

Expected: sin errores.

---

### Task 6: notifier.go — Caché dinámica de settings

**Files:**

- Modify: `backend/internal/notifications/notifier.go`

El objetivo es reemplazar los campos estáticos `sendSMS`/`sendEmail` del `Router` por una lectura dinámica desde `store.PlatformSettingsRepository` con caché de 60 segundos.

- [ ] **Step 1: Añadir "sync" a los imports**

En el bloque de imports (línea 1-25), añadir `"sync"` junto a los demás imports estándar:

```go
import (
	"context"
	"fmt"
	"html"
	"log"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
    // ... resto igual
```

- [ ] **Step 2: Reemplazar struct Router**

Reemplazar el struct `Router` actual (líneas 47-53):

```go
// ANTES:
type Router struct {
	sendSMS   bool
	sendEmail bool
	cfg       config.Config
	ddb       *dynamodb.Client
	sns       *sns.Client
}
```

Por:

```go
// DESPUÉS:
type Router struct {
	cfg          config.Config
	ddb          *dynamodb.Client
	sns          *sns.Client
	settingsRepo store.PlatformSettingsRepository
	mu           sync.Mutex
	cachedSettings *store.PlatformSettings
	cacheUntil   time.Time
}
```

- [ ] **Step 3: Reemplazar NewRouter**

Reemplazar la función `NewRouter` (líneas 55-71):

```go
// ANTES:
func NewRouter(cfg config.Config) *Router {
	ctx := context.Background()
	var opts []func(*awsconfig.LoadOptions) error
	if cfg.AWSProfile != "" {
		opts = append(opts, awsconfig.WithSharedConfigProfile(cfg.AWSProfile))
	}
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		log.Printf("[notify] warn: failed to load aws cfg: %v", err)
	}
	r := &Router{sendSMS: cfg.SendSMS, sendEmail: cfg.SendEmail, cfg: cfg}
	if err == nil {
		r.ddb = dynamodb.NewFromConfig(awsCfg)
		r.sns = sns.NewFromConfig(awsCfg)
	}
	return r
}
```

Por:

```go
// DESPUÉS:
func NewRouter(cfg config.Config, settingsRepo store.PlatformSettingsRepository) *Router {
	ctx := context.Background()
	var opts []func(*awsconfig.LoadOptions) error
	if cfg.AWSProfile != "" {
		opts = append(opts, awsconfig.WithSharedConfigProfile(cfg.AWSProfile))
	}
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		log.Printf("[notify] warn: failed to load aws cfg: %v", err)
	}
	r := &Router{cfg: cfg, settingsRepo: settingsRepo}
	if err == nil {
		r.ddb = dynamodb.NewFromConfig(awsCfg)
		r.sns = sns.NewFromConfig(awsCfg)
	}
	return r
}
```

- [ ] **Step 4: Añadir método getSettings justo después de NewRouter**

Después de la función `NewRouter` y antes de `sendMail`, insertar:

```go
func (r *Router) getSettings(ctx context.Context) store.PlatformSettings {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.cachedSettings != nil && time.Now().Before(r.cacheUntil) {
		return *r.cachedSettings
	}
	if r.settingsRepo != nil {
		s, err := r.settingsRepo.GetSettings(ctx)
		if err == nil {
			r.cachedSettings = &s
			r.cacheUntil = time.Now().Add(60 * time.Second)
			return s
		}
		log.Printf("[notify] warn: could not load platform settings from DB: %v", err)
	}
	return store.PlatformSettings{SendSMS: r.cfg.SendSMS, SendEmail: r.cfg.SendEmail}
}
```

- [ ] **Step 5: Actualizar método allowed para usar ctx**

Reemplazar `allowed` (líneas 809-818):

```go
// ANTES:
func (r *Router) allowed(channel string) bool {
	switch channel {
	case "sms":
		return r.sendSMS
	case "email":
		return r.sendEmail
	default:
		return false
	}
}
```

Por:

```go
// DESPUÉS:
func (r *Router) allowed(ctx context.Context, channel string) bool {
	s := r.getSettings(ctx)
	switch channel {
	case "sms":
		return s.SendSMS
	case "email":
		return s.SendEmail
	default:
		return false
	}
}
```

- [ ] **Step 6: Actualizar SendAppointmentReminder (línea ~241)**

Reemplazar:

```go
	if !r.allowed(channel) {
		return fmt.Errorf("channel %s disabled", channel)
	}
	if channel == "email" && r.sendEmail {
```

Por:

```go
	if !r.allowed(ctx, channel) {
		return fmt.Errorf("channel %s disabled", channel)
	}
	if channel == "email" {
```

- [ ] **Step 7: Actualizar SendAppointmentCreated (línea ~326)**

Reemplazar:

```go
	if !r.sendEmail {
		return nil
	}
```

(el que está dentro de `SendAppointmentCreated`)

Por:

```go
	if !r.getSettings(ctx).SendEmail {
		return nil
	}
```

- [ ] **Step 8: Actualizar SendAppointmentCreatedSMS (línea ~346)**

Reemplazar:

```go
	if !r.sendSMS || r.sns == nil {
		log.Printf("[notify:sms] skip: SMS deshabilitado o cliente nil")
		return nil
	}
```

Por:

```go
	if !r.getSettings(ctx).SendSMS || r.sns == nil {
		log.Printf("[notify:sms] skip: SMS deshabilitado o cliente nil")
		return nil
	}
```

- [ ] **Step 9: Actualizar SendConsentRequest (línea ~384)**

Cambiar el parámetro `_ context.Context` a `ctx context.Context` y actualizar la llamada:

```go
// ANTES:
func (r *Router) SendConsentRequest(_ context.Context, patientID, channel, message string) error {
	if !r.allowed(channel) {
```

```go
// DESPUÉS:
func (r *Router) SendConsentRequest(ctx context.Context, patientID, channel, message string) error {
	if !r.allowed(ctx, channel) {
```

- [ ] **Step 10: Actualizar SendDoctorDailySummary (línea ~392)**

```go
// ANTES:
func (r *Router) SendDoctorDailySummary(_ context.Context, doctorID, channel, message string) error {
	if !r.allowed(channel) {
```

```go
// DESPUÉS:
func (r *Router) SendDoctorDailySummary(ctx context.Context, doctorID, channel, message string) error {
	if !r.allowed(ctx, channel) {
```

- [ ] **Step 11: Actualizar SendAppointmentEvent (línea ~529)**

Reemplazar `if !r.sendEmail {` dentro de `SendAppointmentEvent` por:

```go
	if !r.getSettings(ctx).SendEmail {
```

- [ ] **Step 12: Actualizar SendTreatmentPlanSummary (línea ~573)**

Reemplazar `if !r.sendEmail {` dentro de `SendTreatmentPlanSummary` por:

```go
	if !r.getSettings(ctx).SendEmail {
```

- [ ] **Step 13: Actualizar SendOrgCreated (línea ~610)**

Reemplazar `if !r.sendEmail {` dentro de `SendOrgCreated` por:

```go
	if !r.getSettings(ctx).SendEmail {
```

- [ ] **Step 14: Actualizar SendWelcome (línea ~671)**

Reemplazar `if !r.sendEmail {` dentro de `SendWelcome` por:

```go
	if !r.getSettings(ctx).SendEmail {
```

- [ ] **Step 15: Actualizar SendInvitation (línea ~732)**

Reemplazar `if !r.sendEmail {` dentro de `SendInvitation` por:

```go
	if !r.getSettings(ctx).SendEmail {
```

- [ ] **Step 16: Actualizar SendConsentWithAppointment (línea ~795)**

Reemplazar `if !r.sendEmail {` dentro de `SendConsentWithAppointment` por:

```go
	if !r.getSettings(ctx).SendEmail {
```

- [ ] **Step 17: Verificar compilación**

```bash
cd /Users/manuelserrano/Trabajo/Personal/clinical/backend
go build ./internal/notifications/...
```

Expected: sin errores. Si hay error `undefined: r.sendEmail` o `undefined: r.sendSMS`, es que se olvidó reemplazar alguna ocurrencia. Buscar con: `grep -n "r\.sendSMS\|r\.sendEmail" internal/notifications/notifier.go`

---

### Task 7: router.go — Nuevos endpoints GET/PUT /platform/settings

**Files:**

- Modify: `backend/internal/api/router.go`

- [ ] **Step 1: Añadir campo platformSettings al struct Router**

En el struct `Router` (línea ~117), después de `chat *service.ChatService`, añadir:

```go
	platformSettings *service.PlatformSettingsService
```

- [ ] **Step 2: Actualizar NewRouter para aceptar platformSettings**

En `NewRouter` (línea ~158), añadir el parámetro y asignarlo:

```go
// ANTES:
func NewRouter(appointments *service.AppointmentService, patients *service.PatientService, consents *service.ConsentService, auth *service.AuthService, odontogram *OdontogramHandler, payments *service.PaymentService, budgets *service.BudgetService, chat *service.ChatService) *Router {
	return &Router{appointments: appointments, patients: patients, consents: consents, auth: auth, odontogram: odontogram, payments: payments, budgets: budgets, chat: chat}
}
```

```go
// DESPUÉS:
func NewRouter(appointments *service.AppointmentService, patients *service.PatientService, consents *service.ConsentService, auth *service.AuthService, odontogram *OdontogramHandler, payments *service.PaymentService, budgets *service.BudgetService, chat *service.ChatService, platformSettings *service.PlatformSettingsService) *Router {
	return &Router{appointments: appointments, patients: patients, consents: consents, auth: auth, odontogram: odontogram, payments: payments, budgets: budgets, chat: chat, platformSettings: platformSettings}
}
```

- [ ] **Step 3: Añadir handlers para los nuevos endpoints**

Justo antes de la función `Handle` (línea ~179), añadir los dos handlers:

```go
func (r *Router) getPlatformSettings(ctx context.Context) (events.APIGatewayV2HTTPResponse, error) {
	if r.platformSettings == nil {
		return response(503, map[string]string{"error": "settings_service_unavailable"})
	}
	settings, err := r.platformSettings.GetSettings(ctx)
	if err != nil {
		return response(500, map[string]string{"error": err.Error()})
	}
	return response(200, settings)
}

func (r *Router) updatePlatformSettings(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	if r.platformSettings == nil {
		return response(503, map[string]string{"error": "settings_service_unavailable"})
	}
	var input store.PlatformSettings
	if err := json.Unmarshal([]byte(req.Body), &input); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	if err := r.platformSettings.UpdateSettings(ctx, input); err != nil {
		return response(500, map[string]string{"error": err.Error()})
	}
	return response(200, input)
}
```

- [ ] **Step 4: Añadir cases al switch en Handle()**

En el método `Handle`, dentro del `switch {}`, después del case de `GET /platform/stats`, añadir:

```go
		case method == "GET" && path == "/platform/settings":
			if actx, deny, ok := r.require(ctx, req, permPlatformManage); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.getPlatformSettings(actx)
			}
		case method == "PUT" && path == "/platform/settings":
			if actx, deny, ok := r.require(ctx, req, permPlatformManage); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.updatePlatformSettings(actx, req)
			}
```

- [ ] **Step 5: Añadir import de store en router.go si no existe**

Verificar que `"clinical-backend/internal/store"` ya está en los imports. Si no, añadirlo:

```bash
grep -n '"clinical-backend/internal/store"' /Users/manuelserrano/Trabajo/Personal/clinical/backend/internal/api/router.go
```

Si no aparece, añadir al bloque de imports.

- [ ] **Step 6: Verificar compilación**

```bash
cd /Users/manuelserrano/Trabajo/Personal/clinical/backend
go build ./internal/api/...
```

Expected: sin errores.

---

### Task 8: main.go — Wiring de PlatformSettingsService y notifier

**Files:**

- Modify: `backend/cmd/api/main.go`

- [ ] **Step 1: Mover inicialización del notifier después de repos**

Eliminar la línea `notifier := notifications.NewRouter(cfg)` de la línea 24 (antes de la inicialización de repos).

- [ ] **Step 2: Añadir PlatformSettingsTableName a DynamoDBConfig**

En el bloque donde se construye `dynamoConfig` (línea ~42), después de `BudgetTableName: cfg.BudgetTable,`, añadir:

```go
			PlatformSettingsTableName: cfg.PlatformSettingsTable,
```

- [ ] **Step 3: Añadir campo settingsRepo al bloque repos**

En el struct anónimo `repos`, después de `Budgets store.BudgetRepository`, añadir:

```go
		PlatformSettings store.PlatformSettingsRepository
```

- [ ] **Step 4: Asignar PlatformSettings en el bloque DynamoDB (éxito)**

En el bloque `else` donde se asignan `repos.Patients`, etc. (línea ~71), añadir:

```go
			repos.PlatformSettings = dynamoRepos.PlatformSettings
```

- [ ] **Step 5: Asignar PlatformSettings en el fallback in-memory (fallo DynamoDB)**

En el bloque de fallback dentro del `if err != nil` (donde se asigna desde `memRepos`), añadir:

```go
			repos.PlatformSettings = memRepos.PlatformSettings
```

- [ ] **Step 6: Asignar PlatformSettings en el bloque in-memory puro**

En el bloque `else` que inicializa repos in-memory para desarrollo local (línea ~82), añadir:

```go
		repos.PlatformSettings = memRepos.PlatformSettings
```

- [ ] **Step 7: Inicializar notifier con settingsRepo después del bloque de repos**

Después del bloque `if/else` de inicialización de repos (que cierra con `}`), añadir:

```go
	notifier := notifications.NewRouter(cfg, repos.PlatformSettings)
```

- [ ] **Step 8: Crear PlatformSettingsService y actualizar llamada a api.NewRouter**

Después de crear `budgetService` y antes de crear `chatService`, añadir:

```go
	platformSettingsService := service.NewPlatformSettingsService(repos.PlatformSettings)
```

Luego, actualizar la llamada `api.NewRouter(...)` (línea ~142) para incluir `platformSettingsService` como último argumento:

```go
// ANTES:
	router := api.NewRouter(appointments, patients, consents, auth, odontogramHandler, paymentService, budgetService, chatService)

// DESPUÉS:
	router := api.NewRouter(appointments, patients, consents, auth, odontogramHandler, paymentService, budgetService, chatService, platformSettingsService)
```

- [ ] **Step 9: Verificar compilación completa del backend**

```bash
cd /Users/manuelserrano/Trabajo/Personal/clinical/backend
go build ./...
```

Expected: sin errores.

- [ ] **Step 10: Ejecutar tests**

```bash
cd /Users/manuelserrano/Trabajo/Personal/clinical/backend
go test ./...
```

Expected: todos los tests pasan.

- [ ] **Step 11: Commit del backend**

```bash
cd /Users/manuelserrano/Trabajo/Personal/clinical/backend
git add internal/config/config.go internal/store/repositories.go internal/store/dynamodb.go internal/notifications/notifier.go internal/service/platform_settings_service.go internal/api/router.go cmd/api/main.go template.yaml
git commit -m "feat(notifications): canales SMS/email dinámicos con caché DynamoDB y endpoints /platform/settings"
```

---

### Task 9: clinical.ts — Nuevas funciones de API

**Files:**

- Modify: `frontend/react-app/src/api/clinical.ts`

- [ ] **Step 1: Añadir getPlatformSettings y updatePlatformSettings**

En `clinical.ts`, dentro del objeto `clinicalApi`, después de `deleteOrg`, añadir:

```ts
  getPlatformSettings: (token: string) =>
    request<{ sendSMS: boolean; sendEmail: boolean }>("/platform/settings", { token }),

  updatePlatformSettings: (data: { sendSMS: boolean; sendEmail: boolean }, token: string) =>
    request<{ sendSMS: boolean; sendEmail: boolean }>("/platform/settings", {
      method: "PUT",
      body: data,
      token,
    }),
```

- [ ] **Step 2: Verificar compilación TypeScript**

```bash
cd /Users/manuelserrano/Trabajo/Personal/clinical/frontend/react-app
npx tsc --noEmit
```

Expected: sin errores de tipo.

---

### Task 10: AdminConsoleHome.tsx — Sección Configuración de Plataforma

**Files:**

- Modify: `frontend/react-app/src/pages/admin/AdminConsoleHome.tsx`

- [ ] **Step 1: Añadir estado activeView y platform settings al componente**

En la función `AdminConsoleHome`, después de las declaraciones `useState` existentes (línea ~194), añadir:

```tsx
const [activeView, setActiveView] = useState<"orgs" | "settings">("orgs");
const [platformSettings, setPlatformSettings] = useState<{
  sendSMS: boolean;
  sendEmail: boolean;
} | null>(null);
const [settingsLoading, setSettingsLoading] = useState(false);
const [settingsSaving, setSettingsSaving] = useState(false);
```

- [ ] **Step 2: Añadir función loadPlatformSettings**

Después de la función `handleRefresh`, añadir:

```tsx
async function loadPlatformSettings() {
  setSettingsLoading(true);
  try {
    const s = await clinicalApi.getPlatformSettings(token);
    setPlatformSettings(s);
  } catch (e) {
    notify.error(
      "Error cargando configuración",
      e instanceof Error ? e.message : "",
    );
  } finally {
    setSettingsLoading(false);
  }
}

async function savePlatformSettings() {
  if (!platformSettings) return;
  setSettingsSaving(true);
  try {
    const updated = await clinicalApi.updatePlatformSettings(
      platformSettings,
      token,
    );
    setPlatformSettings(updated);
    notify.success("Configuración guardada");
  } catch (e) {
    notify.error(
      "Error guardando configuración",
      e instanceof Error ? e.message : "",
    );
  } finally {
    setSettingsSaving(false);
  }
}
```

- [ ] **Step 3: Cargar settings al montar cuando se activa la sección**

Modificar el `useEffect` que llama a `loadAll()`:

```tsx
// ANTES:
useEffect(() => {
  loadAll();
}, []);

// DESPUÉS:
useEffect(() => {
  loadAll();
  loadPlatformSettings();
}, []);
```

- [ ] **Step 4: Añadir tab bar en el return del componente**

Después del `{/* Header */}` (después del `</div>` que cierra el header, aproximadamente línea ~488), añadir la barra de tabs antes del `{/* Stats dashboard */}`:

```tsx
{
  /* Tab navigation */
}
<div
  style={{
    display: "flex",
    gap: "0.5rem",
    marginBottom: "1.5rem",
    borderBottom: "2px solid #e5e7eb",
    paddingBottom: 0,
  }}
>
  {(["orgs", "settings"] as const).map((view) => {
    const labels = {
      orgs: "Organizaciones",
      settings: "Configuración de Plataforma",
    };
    const active = activeView === view;
    return (
      <button
        key={view}
        onClick={() => setActiveView(view)}
        style={{
          background: "none",
          border: "none",
          borderBottom: active ? "2px solid #6366f1" : "2px solid transparent",
          marginBottom: -2,
          padding: "0.5rem 1rem",
          cursor: "pointer",
          fontSize: "0.875rem",
          fontWeight: active ? 700 : 500,
          color: active ? "#6366f1" : "#6b7280",
        }}
      >
        {labels[view]}
      </button>
    );
  })}
</div>;
```

- [ ] **Step 5: Envolver el contenido de orgs en condicional**

Todo el bloque que va desde `{/* Stats dashboard */}` hasta el final del return (antes del último `</div>`) debe quedar envuelto en `{activeView === "orgs" && (...)}`

Buscar `{/* Stats dashboard */}` y envolver desde ahí hasta antes del `</div>` final (que cierra el `<div style={{ padding: "2rem"...`):

```tsx
{
  activeView === "orgs" && (
    <>
      {/* Stats dashboard */}
      {/* ... todo el contenido existente de orgs y stats ... */}
    </>
  );
}
```

- [ ] **Step 6: Añadir sección de configuración de plataforma**

Justo antes del último `</div>` del return (que cierra el div principal con `padding: "2rem"`), añadir:

```tsx
{
  activeView === "settings" && (
    <div style={{ maxWidth: 520 }}>
      <h2
        style={{
          fontWeight: 700,
          fontSize: "1rem",
          marginBottom: "1.5rem",
          color: "#1e293b",
        }}
      >
        Configuración de Plataforma
      </h2>

      {settingsLoading ? (
        <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>Cargando...</p>
      ) : platformSettings ? (
        <>
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "1.5rem",
              marginBottom: "1.5rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <h3
              style={{
                fontWeight: 700,
                fontSize: "0.875rem",
                color: "#374151",
                marginBottom: "1rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Canales de Notificación
            </h3>

            {/* Toggle Email */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingBottom: "1rem",
                marginBottom: "1rem",
                borderBottom: "1px solid #f3f4f6",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    color: "#1e293b",
                  }}
                >
                  Email
                </div>
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  Notificaciones por correo electrónico (bienvenida, citas,
                  consentimientos)
                </div>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: platformSettings.sendEmail ? "#059669" : "#dc2626",
                  }}
                >
                  {platformSettings.sendEmail ? "Activo" : "Inactivo"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPlatformSettings({
                      ...platformSettings,
                      sendEmail: !platformSettings.sendEmail,
                    })
                  }
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    border: "none",
                    background: platformSettings.sendEmail
                      ? "#6366f1"
                      : "#d1d5db",
                    cursor: "pointer",
                    position: "relative",
                    transition: "background 0.2s",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 3,
                      left: platformSettings.sendEmail ? 23 : 3,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "#fff",
                      transition: "left 0.2s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }}
                  />
                </button>
              </div>
            </div>

            {/* Toggle SMS */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    color: "#1e293b",
                  }}
                >
                  SMS
                </div>
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  Notificaciones por mensaje de texto (confirmación de citas)
                </div>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: platformSettings.sendSMS ? "#059669" : "#dc2626",
                  }}
                >
                  {platformSettings.sendSMS ? "Activo" : "Inactivo"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPlatformSettings({
                      ...platformSettings,
                      sendSMS: !platformSettings.sendSMS,
                    })
                  }
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    border: "none",
                    background: platformSettings.sendSMS
                      ? "#6366f1"
                      : "#d1d5db",
                    cursor: "pointer",
                    position: "relative",
                    transition: "background 0.2s",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 3,
                      left: platformSettings.sendSMS ? 23 : 3,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "#fff",
                      transition: "left 0.2s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }}
                  />
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={savePlatformSettings}
            disabled={settingsSaving}
            style={{
              background: "#6366f1",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "0.625rem 1.5rem",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: settingsSaving ? "not-allowed" : "pointer",
              opacity: settingsSaving ? 0.7 : 1,
            }}
          >
            {settingsSaving ? "Guardando..." : "Guardar configuración"}
          </button>
        </>
      ) : (
        <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
          No se pudo cargar la configuración.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Verificar tipos con TypeScript**

```bash
cd /Users/manuelserrano/Trabajo/Personal/clinical/frontend/react-app
npx tsc --noEmit
```

Expected: sin errores de tipo.

- [ ] **Step 8: Commit del frontend**

```bash
cd /Users/manuelserrano/Trabajo/Personal/clinical
git add frontend/react-app/src/api/clinical.ts frontend/react-app/src/pages/admin/AdminConsoleHome.tsx
git commit -m "feat(frontend): sección Configuración de Plataforma con toggles SMS/email dinámicos"
```

---

### Task 11: Deploy

**Files:**

- No changes — solo comandos de deploy

- [ ] **Step 1: Autenticarse con SSO**

```bash
aws sso login --profile aloai
```

Expected: browser abre, autenticación exitosa.

- [ ] **Step 2: SAM build**

```bash
cd /Users/manuelserrano/Trabajo/Personal/clinical/backend
sam build
```

Expected: `Build Succeeded` con las 3 funciones.

- [ ] **Step 3: SAM deploy**

```bash
cd /Users/manuelserrano/Trabajo/Personal/clinical/backend
sam deploy
```

Expected: todos los recursos en estado `CREATE_COMPLETE` o `UPDATE_COMPLETE`. La nueva tabla `clinical-platform-settings` aparece creada.

- [ ] **Step 4: Restaurar CORS**

```bash
cd /Users/manuelserrano/Trabajo/Personal/clinical
bash scripts/fix-apigw-after-deploy.sh
```

Expected: sin errores.

- [ ] **Step 5: Verificar endpoint GET /platform/settings**

```bash
curl -s -X GET "$(aws cloudformation describe-stacks --stack-name clinical-backend --profile aloai --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)/platform/settings" \
  -H "Authorization: Bearer <token_super_admin>" \
  -H "x-api-key: <api_key>"
```

Expected: `{"sendSMS":true,"sendEmail":true}` (defaults desde env vars en el primer request).

- [ ] **Step 6: Deploy del frontend**

```bash
cd /Users/manuelserrano/Trabajo/Personal/clinical/frontend/react-app
npm run build
```

Subir el `dist/` al bucket S3 del frontend (o dejar que el pipeline de CodePipeline lo haga con el push a main).

- [ ] **Step 7: Verificar en producción**

Abrir `https://docco.aloai.me` con el usuario super admin. Verificar que aparece la pestaña "Configuración de Plataforma" y que los toggles responden al estado real de la plataforma.

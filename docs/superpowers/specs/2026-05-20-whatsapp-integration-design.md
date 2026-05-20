# WhatsApp Integration — Diseño Técnico

**Fecha:** 2026-05-20
**Proyecto:** clinical (docco.aloai.me)
**Rama:** feat/whatsapp-integration

## Contexto

El sistema clínico necesita un canal de atención por WhatsApp donde el asistente AI responda preguntas generales de pacientes (servicios, horarios, precios, dudas clínicas genéricas) usando una "Base de Conocimiento" que cada clínica configura. El asistente siempre aclara que la decisión final la tiene el doctor.

## Decisiones de Diseño

| Decisión                | Elección                            | Razón                                           |
| ----------------------- | ----------------------------------- | ----------------------------------------------- |
| Instancia Evolution API | Dedicada para clinical              | Aislamiento total de alo-ai-engine              |
| Modelo Bedrock          | Claude Sonnet 4.6                   | Mejor razonamiento médico disponible en Bedrock |
| Base de Conocimiento    | Texto libre + mensaje de bienvenida | Máxima flexibilidad para el admin               |
| Acceso WhatsApp         | Cualquier persona                   | Canal de captación abierto                      |
| Arquitectura mensajes   | Webhook → SQS → Worker async        | Evita timeout Lambda en respuesta Bedrock       |

## Arquitectura — Enfoque B

### Flujo de mensaje entrante

```
Paciente WhatsApp → Evolution API → POST /public/whatsapp/webhook
    → WhatsAppWebhookFunction (Go Lambda)
        → valida API key Evolution
        → guarda mensaje en DynamoDB (log)
        → encola en SQS
    → SQS trigger
    → WhatsAppWorkerFunction (Go Lambda)
        → carga Base de Conocimiento (DynamoDB clinical-whatsapp-config)
        → construye prompt sistema + contexto
        → llama Claude Sonnet 4.6 (Bedrock)
        → envía respuesta por Evolution API
```

### Flujo de conexión admin

```
Admin React → POST /admin/whatsapp/connect
    → WhatsAppAdminFunction (Go Lambda)
        → llama Evolution API createInstance(orgId)
        → guarda instanceName en clinical-whatsapp-config
        → retorna stage + qrcode base64

Admin polling GET /admin/whatsapp/status cada 3s
    → WhatsAppAdminFunction
        → llama Evolution API getConnectionStatus(orgId)
        → retorna { connected, stage }

Admin escanea QR → Evolution API detecta conexión
    → webhook CONNECTION_UPDATE
    → WhatsAppWebhookFunction actualiza DynamoDB connected=true
```

## Infraestructura Nueva

### `infrastructure/whatsapp-evolution.yaml` (CloudFormation separado)

Recursos:

- VPC 10.30.0.0/16 con 2 subnets públicas
- Security Groups: ALB (80), App (8080 desde ALB), DB (5432 desde App)
- RDS PostgreSQL 16 — db.t4g.micro, 20GB
- Secrets Manager: evolution-api-key (random), evolution-db-password
- ECS Cluster + Task Definition (512 CPU, 1024 MB)
  - Container 1: redis:7-alpine (6379)
  - Container 2: evoapicloud/evolution-api:v2.3.7 (8080)
- ECS Service (Fargate Spot weight 4 + Fargate base 1)
- ALB (HTTP 80 → target group 8080)
- SSM Parameter: /clinical/evolution-api-url

### `backend/template.yaml` — Additions

Nuevos recursos SAM:

- `WhatsAppConfig` DynamoDB table (PK: orgId)
- `WhatsAppMessagesQueue` SQS queue + DLQ (max receive 3, visibility 120s)
- `WhatsAppAdminFunction` Lambda — routes /admin/whatsapp/\*
- `WhatsAppWebhookFunction` Lambda — route /public/whatsapp/webhook
- `WhatsAppWorkerFunction` Lambda — SQS event source mapping

## Backend Go — Nuevos Paquetes

### `internal/whatsapp/client.go`

Cliente HTTP para Evolution API:

- `CreateInstance(orgId, webhookURL) → InstanceInfo`
- `GetQRCode(instanceName) → string (base64)`
- `GetConnectionStatus(instanceName) → ConnectionStatus`
- `DisconnectInstance(instanceName)`
- `SendTextMessage(instanceName, phone, text)`
- `DeleteInstance(instanceName)`

### `internal/whatsapp/manager.go`

Lógica de negocio WhatsApp:

- `Connect(orgId) → ConnectResult`
- `PollStatus(orgId) → StatusResult`
- `Disconnect(orgId)`
- `SendAIResponse(orgId, phone, userMessage)`

### `internal/service/whatsapp_ai_service.go`

Integración con Bedrock:

- `BuildSystemPrompt(knowledgeBase, welcomeMessage) → string`
- `GenerateResponse(systemPrompt, userMessage, conversationHistory) → string`
- Prompt siempre incluye disclaimer: "La decisión final la tiene tu doctor"
- Modelo: `claude-sonnet-4-6` vía Bedrock Converse API

### `internal/store/whatsapp_store.go`

DynamoDB `clinical-whatsapp-config`:

```
PK (orgId) | connected | instanceName | knowledgeBase | welcomeMessage | updatedAt
```

- `GetWhatsAppConfig(orgId) → WhatsAppConfig`
- `SaveWhatsAppConfig(config)`
- `SetConnected(orgId, connected)`

### Rutas nuevas en `router.go`

| Método | Path                       | Auth | Permiso |
| ------ | -------------------------- | ---- | ------- |
| POST   | /admin/whatsapp/connect    | JWT  | admin+  |
| GET    | /admin/whatsapp/status     | JWT  | admin+  |
| POST   | /admin/whatsapp/disconnect | JWT  | admin+  |
| PUT    | /admin/whatsapp/knowledge  | JWT  | admin+  |
| GET    | /admin/whatsapp/knowledge  | JWT  | admin+  |
| POST   | /public/whatsapp/webhook   | none | —       |

Nueva permission: `permWhatsAppManage = "whatsapp.manage"` → roles: `platform_admin`, `admin`

## Frontend React — Nuevas Páginas

### `src/pages/admin/WhatsAppSettingsPage.tsx`

Página principal bajo ruta `/admin/whatsapp`, visible solo para `admin` y `platform_admin`.

Secciones:

1. **Panel de Conexión** — estado actual, botón conectar/desconectar, QR modal con polling
2. **Base de Conocimiento** — textarea grande para que el admin escriba todo sobre la clínica
3. **Mensaje de Bienvenida** — input para el primer mensaje que recibe el paciente

### `src/modules/whatsapp/WhatsAppConnect.tsx`

- Estados: `idle | connecting | qr_ready | connected | disconnecting`
- QR modal con countdown 3 minutos, polling cada 3s
- Badge de estado con color (rojo desconectado, verde conectado, amarillo conectando)

### `src/modules/whatsapp/KnowledgeBaseEditor.tsx`

- Textarea resizable con placeholder guía
- Contador de caracteres (límite suave 5000 chars)
- Botón Guardar con feedback

### API client additions (`src/api/clinical.ts`)

- `connectWhatsApp()`
- `getWhatsAppStatus()`
- `disconnectWhatsApp()`
- `getWhatsAppKnowledge()`
- `updateWhatsAppKnowledge(knowledgeBase, welcomeMessage)`

## Prompt del Asistente Médico

```
Eres el asistente virtual de {clinicName}. Tu función es responder preguntas
generales de pacientes sobre los servicios, horarios y procedimientos de la clínica.

BASE DE CONOCIMIENTO DE LA CLÍNICA:
{knowledgeBase}

REGLAS IMPORTANTES:
1. Responde siempre de forma amable, clara y concisa.
2. Si te preguntan sobre diagnósticos, tratamientos específicos o condiciones médicas,
   proporciona información general útil pero SIEMPRE indica que la decisión y evaluación
   final la realiza el doctor en consulta.
3. No inventes información que no esté en la Base de Conocimiento.
4. Si no sabes algo, di que lo pueden consultar directamente en la clínica.
5. Responde en el mismo idioma que el paciente.
6. Máximo 3 párrafos cortos por respuesta (formato WhatsApp).
```

## Manejo de Errores

- **Evolution API no responde**: retorna error 503, el admin ve "Servicio no disponible"
- **Timeout QR (3 min)**: frontend cancela polling, muestra mensaje "Intenta de nuevo"
- **Bedrock throttling**: SQS reintenta hasta 3 veces, luego DLQ
- **Mensaje en DLQ**: CloudWatch alarm → revisión manual (no se pierde)
- **Webhook sin firma válida**: 401, no procesa

## Despliegue

### Orden de despliegue:

1. `aws cloudformation deploy --template-file infrastructure/whatsapp-evolution.yaml` — infra ECS
2. `sam build && sam deploy` — nuevas Lambda functions + tabla DynamoDB + SQS
3. `git push origin main` (CodePipeline) — frontend

### Variables de entorno nuevas (Lambda):

- `EVOLUTION_API_URL` — desde SSM /clinical/evolution-api-url
- `EVOLUTION_API_KEY` — desde Secrets Manager
- `WHATSAPP_WEBHOOK_SECRET` — token de validación
- `BEDROCK_WHATSAPP_MODEL_ID` — `claude-sonnet-4-6`

## Notas de Seguridad

- El webhook `/public/whatsapp/webhook` valida que el header `apikey` coincida con el secret guardado en Secrets Manager (no es público sin autenticación)
- `orgId` se deriva del `instanceName` en el webhook (formato `clinical-{orgId}`) — no viene del body
- La Base de Conocimiento se sanitiza antes de incluirse en el prompt (se trunca a 4000 tokens)
- El asistente nunca accede a datos médicos de DynamoDB — solo usa la Base de Conocimiento configurada por el admin

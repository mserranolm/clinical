# Design: Paridad completa del agente WhatsApp con módulo "asisten" de alo-ai-engine

**Fecha:** 2026-05-26  
**Proyecto:** clinical (backend Go + Lambda)  
**Referencia:** `/Users/manuelserrano/Trabajo/Personal/alo-ai-engine` — módulo `assistant`  
**Scope:** Opción B — Core parity en esta fase; S3 historical chats en Fase 2

---

## Contexto y motivación

El agente WhatsApp de `clinical` (docco) usa un prompt de 3 capas con KB limitada a 3500 chars. El módulo `asisten` de `alo-ai-engine` tiene un prompt de 8 bloques estructurados, handoff automático `[HANDOFF]`, prompt caching de Anthropic, model routing Haiku/Sonnet, tono/personalidad configurable e identidad personalizable. Este spec diseña la migración de `clinical` a paridad completa con `asisten`.

---

## Cambios en scope (Opción B)

### En scope (Fase 1 — esta implementación)

- Prompt de 8 bloques con prompt caching Anthropic
- Handoff `[HANDOFF]` + notificación al owner por WhatsApp
- Model routing: Haiku (default) vs Sonnet (configurable)
- Schema DynamoDB extendido (6 campos nuevos opcionales)
- Item `AWAITING_HUMAN#{phone}` con TTL 72h
- Comprobación de awaiting human en webhook (skip bot)
- Nuevos campos en API admin (`PUT/GET /admin/whatsapp/knowledge`)
- Skill `/sync-asisten` local en `.claude/skills/`

### Fuera de scope (Fase 2)

- Bucket S3 para históricos de chat
- Lambda triggerada por S3 para procesar y resumir históricos
- Upload UI en frontend para cargar archivos de chat histórico

---

## Arquitectura de cambios

```
alo-ai-engine (TypeScript / referencia)          clinical (Go / objetivo)
─────────────────────────────────────────        ──────────────────────────────────────────
AssistantConfig (types/index.ts)          →      WhatsAppConfig + HistoricalChat (store/whatsapp.go)
PromptEngine.assembleAssistantPrompt()    →      buildWhatsAppSystemPrompt() refactorizado
IAClient (ConverseCommand + cachePoint)   →      bedrock/client.go extendido
aiWorker [HANDOFF] signal parsing         →      whatsapp_handler.go ProcessWhatsAppSQSRecord()
markConversationAwaitingHuman()           →      repo.MarkAwaitingHuman() + DynamoDB TTL
ModelRouter (haiku/sonnet)                →      WhatsAppAIService.modelForConfig()
```

---

## Sección 1: Schema DynamoDB

### Struct `WhatsAppConfig` extendido (`internal/store/whatsapp.go`)

```go
type HistoricalChatStatus string
const (
    HistoricalChatPending HistoricalChatStatus = "pending_review"
    HistoricalChatReady   HistoricalChatStatus = "ready"
    HistoricalChatError   HistoricalChatStatus = "error"
)

type HistoricalChat struct {
    ID             string               `json:"id" dynamodbav:"id"`
    FileName       string               `json:"fileName" dynamodbav:"fileName"`
    UploadedAt     string               `json:"uploadedAt" dynamodbav:"uploadedAt"`
    S3Key          string               `json:"s3Key" dynamodbav:"s3Key"`
    Summary        string               `json:"summary,omitempty" dynamodbav:"summary,omitempty"`
    CharacterCount int                  `json:"characterCount" dynamodbav:"characterCount"`
    Status         HistoricalChatStatus `json:"status" dynamodbav:"status"`
    ErrorMessage   string               `json:"errorMessage,omitempty" dynamodbav:"errorMessage,omitempty"`
}

type HandoffMode string
const (
    HandoffSilent      HandoffMode = "silent"
    HandoffNotifyOwner HandoffMode = "notify_owner"
)

// Campos NUEVOS añadidos a WhatsAppConfig (todos omitempty = compatibilidad hacia atrás):
//   CustomIdentity           string
//   Considerations           string           (alias semántico de AssistantInstructions)
//   HistoricalChats          []HistoricalChat  (vacío hasta Fase 2)
//   HandoffMode              HandoffMode
//   OwnerNotificationChannel string
//   ToneConfig               string           ("formal" | "friendly" | "casual")
//   ModelTier                string           ("haiku" | "sonnet", default "haiku")
```

**Compatibilidad hacia atrás:** Todos los campos son `omitempty`. Las orgs existentes sin estos campos siguen funcionando con el comportamiento anterior. `HandoffMode` vacío → `"silent"` (no notifica). `ModelTier` vacío → `"haiku"`.

### Nuevo item: AWAITING_HUMAN

```
PK: ORG#{orgId}
SK: AWAITING_HUMAN#{phone}
Atributos:
  reason:    string   ("no_kb_match")
  createdAt: string   (RFC3339)
  ttl:       number   (unix timestamp, 72h desde creación)
```

**Nuevos métodos en `DynamoWhatsAppRepo`:**

- `MarkAwaitingHuman(orgID, phone, reason string) error`
- `IsAwaitingHuman(orgID, phone string) (bool, error)`
- `ClearAwaitingHuman(orgID, phone string) error` (para cuando el admin retoma el bot)

---

## Sección 2: Prompt Engine (8 bloques)

### Función `buildWhatsAppSystemPrompt()` refactorizada

Ubicación: `internal/service/whatsapp_ai_service.go`

**Estructura del prompt (en orden):**

```
[Bloque 1 — IDENTIDAD]
CustomIdentity si está definido.
Default: "Eres un asistente conversacional de {clinicName}. Respondes únicamente
basándote en el conocimiento que se te ha proporcionado. No inventes información."

[Bloque 2 — GUARDRAILS CLÍNICOS] (hardcodeados, inamovibles)
- No recomendar medicamentos ni dosis específicas
- No hacer diagnósticos médicos
- No interpretar exámenes o estudios
- Síntomas o molestias → invitar a agendar consulta
- Emergencia → indicar llamar a urgencias o ambulancia

[Bloque 3 — CONSIDERACIONES]
Tags: [CONSIDERACIONES]...[/CONSIDERACIONES]
Contenido: Considerations (fallback: AssistantInstructions)
Restricciones y reglas específicas de la clínica.

[Bloque 4 — BASE DE CONOCIMIENTO]
Tags: [BASE_DE_CONOCIMIENTO]...[/BASE_DE_CONOCIMIENTO]
Contenido: KnowledgeBase (FAQ, horarios, servicios)
+ summaries de HistoricalChats donde Status=="ready"
Límite total: 80,000 chars

[Bloque 5 — TONO]
Según ToneConfig:
  "formal"   → profesional, sin contracciones, usted
  "friendly" → cercano, tuteo, natural (DEFAULT)
  "casual"   → muy informal, emojis permitidos

[Bloque 6 — REGLAS DE DECISIÓN]
Solo se incluye si HandoffMode != "":
"Cuando puedas responder con base en el conocimiento disponible, comienza tu
respuesta con [ANSWER]. Cuando la pregunta esté fuera de tu conocimiento o
requiera atención humana, responde exactamente [HANDOFF]."

══ CACHE BOUNDARY (Anthropic cache_control: ephemeral) ══
  Bloques 1-6 → parte estable, cacheable 1 hora
  Bloque 7-8 → parte dinámica, no cacheable

[Bloque 7 — sin sección en system prompt]
El historial de conversación se inyecta como mensajes user/assistant (igual que hoy).

[Bloque 8 — RECORDATORIO DE PERSONALIDAD]
Frase corta recordando el tono al final del system prompt.
Ej: "Recuerda: responde de manera {toneConfig} y en primera persona."
```

### Prompt Caching

Se usa el formato Anthropic con `cache_control` en el payload de Bedrock:

```go
// bedrock/client.go — InvokeWithCache()
type SystemBlock struct {
    Type         string       `json:"type"`
    Text         string       `json:"text"`
    CacheControl *CacheControl `json:"cache_control,omitempty"`
}
type CacheControl struct {
    Type string `json:"type"` // "ephemeral"
}

// Split: los bloques 1-6 van en el primer SystemBlock con cache_control
// El bloque 8 va en el segundo SystemBlock sin cache_control
```

Solo se activa cuando `strings.Contains(modelID, "anthropic")`.

### Model Routing

```go
func (s *WhatsAppAIService) resolveModelID(cfg *store.WhatsAppConfig) string {
    if cfg.ModelTier == "sonnet" {
        if id := os.Getenv("WHATSAPP_SONNET_MODEL_ID"); id != "" {
            return id
        }
    }
    if id := os.Getenv("WHATSAPP_HAIKU_MODEL_ID"); id != "" {
        return id
    }
    return os.Getenv("WHATSAPP_MODEL_ID") // fallback a var existente
}
```

**Variables de entorno en `template.yaml`:**

```yaml
WHATSAPP_HAIKU_MODEL_ID: "us.anthropic.claude-haiku-4-5-20251001-v1:0"
WHATSAPP_SONNET_MODEL_ID: "us.anthropic.claude-sonnet-4-6"
WHATSAPP_MODEL_ID: "us.anthropic.claude-sonnet-4-6" # backwards compat
```

**Temperatura:** Se añade `temperature: 0.4` (hardcodeado, igual que asisten).

---

## Sección 3: Mecanismo Handoff

### Parsing de señal en `ProcessWhatsAppSQSRecord()`

```go
func parseAssistantSignal(reply string) (signal, cleanReply string) {
    trimmed := strings.TrimSpace(reply)
    if strings.HasPrefix(trimmed, "[HANDOFF]") {
        return "handoff", ""
    }
    clean := strings.TrimPrefix(trimmed, "[ANSWER]")
    return "answer", strings.TrimSpace(clean)
}
```

### Flujo en `ProcessWhatsAppSQSRecord()`

```go
signal, cleanReply := parseAssistantSignal(aiResponse)

switch signal {
case "handoff":
    repo.MarkAwaitingHuman(orgID, phone, "no_kb_match")
    if cfg.HandoffMode == store.HandoffNotifyOwner && cfg.OwnerNotificationChannel != "" {
        notif := fmt.Sprintf("⚠️ El paciente %s requiere atención humana (WhatsApp).", phone)
        _ = whatsAppSvc.SendTextToPatient(cfg.InstanceName, cfg.OwnerNotificationChannel, notif)
    }
    // Sin respuesta al remitente — el handoff es silencioso por defecto
    return nil

case "answer":
    if err := whatsAppSvc.SendTextToPatient(cfg.InstanceName, phone, cleanReply); err != nil {
        return err
    }
    repo.SaveConversationTurn(orgID, phone, "assistant", cleanReply)
}
```

### Comprobación AWAITING_HUMAN en webhook

En `handleWhatsAppWebhook()`, antes de encolar a SQS:

```go
if awaiting, _ := repo.IsAwaitingHuman(orgID, phone); awaiting {
    // Un humano está atendiendo — el bot no interviene
    return
}
```

---

## Sección 4: Cambios API Admin

### `PUT /admin/whatsapp/knowledge` — payload extendido

```go
type SaveKnowledgeRequest struct {
    KnowledgeBase            string      `json:"knowledgeBase"`
    AssistantInstructions    string      `json:"assistantInstructions"`
    WelcomeMessage           string      `json:"welcomeMessage"`
    // Nuevos campos:
    CustomIdentity           string      `json:"customIdentity,omitempty"`
    Considerations           string      `json:"considerations,omitempty"`
    HandoffMode              string      `json:"handoffMode,omitempty"`
    OwnerNotificationChannel string      `json:"ownerNotificationChannel,omitempty"`
    ToneConfig               string      `json:"toneConfig,omitempty"`
    ModelTier                string      `json:"modelTier,omitempty"`
}
```

`GET /admin/whatsapp/knowledge` retorna `WhatsAppConfig` completo (ya incluye los nuevos campos por ser el mismo struct).

---

## Sección 5: Skill `/sync-asisten`

### Ubicación

`.claude/skills/sync-asisten.md` — skill local del proyecto `clinical`.

### Trigger

Usuario ejecuta `/sync-asisten` en Claude Code.

### Comportamiento del skill

```
1. READ — Archivos fuente en alo-ai-engine:
   - backend/src/shared/PromptEngine.ts       (bloques del prompt)
   - backend/src/shared/IAClient.ts           (parámetros Bedrock + caching)
   - backend/src/types/index.ts               (AssistantConfig interface)
   - backend/src/functions/aiWorker.ts        (señales ANSWER/HANDOFF, handoff logic)
   - backend/src/shared/ModelRouter.ts        (model tiers)

2. READ — Archivos equivalentes en clinical:
   - internal/service/whatsapp_ai_service.go
   - internal/bedrock/client.go
   - internal/store/whatsapp.go
   - internal/api/whatsapp_handler.go

3. COMPARE — 5 dimensiones:
   A. Bloques del prompt (estructura, orden, contenido de cada bloque)
   B. Parámetros Bedrock (temperatura, maxTokens, caching activado/no)
   C. Schema de config (campos nuevos, eliminados, tipos cambiados)
   D. Señales de respuesta ([ANSWER]/[HANDOFF] u otras nuevas)
   E. Model routing (tiers, nombres de modelos, vars de entorno)

4. REPORT — Diff por dimensión con severidad:
   🔴 Breaking — comportamiento diferente (debe aplicarse)
   🟡 Enhancement — feature presente en asisten pero faltante (recomendado)
   🟢 Cosmético — nombres, orden, style (opcional)

5. APPLY — Con aprobación del usuario, aplica los cambios en Go
   Orden: 🔴 primero, luego 🟡, luego 🟢 (si el usuario lo pide)
   Cada cambio → Edit puntual + confirmación antes de pasar al siguiente
```

---

## Compatibilidad hacia atrás

| Área     | Garantía                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------ |
| DynamoDB | Todos los campos nuevos son `omitempty`. Las orgs sin ellos no se ven afectadas.                       |
| Bot mode | `HandoffMode` vacío = comportamiento actual (no handoff).                                              |
| Modelo   | `ModelTier` vacío → usa `WHATSAPP_HAIKU_MODEL_ID`. Si tampoco existe → fallback a `WHATSAPP_MODEL_ID`. |
| Prompt   | Si `Considerations` vacío → usa `AssistantInstructions` como contenido del bloque 3.                   |
| Caching  | Solo se activa con modelos Anthropic; modelos Nova siguen igual.                                       |

---

## Tests necesarios

- `TestBuildWhatsAppSystemPromptAllBlocks` — verifica los 8 bloques están presentes
- `TestBuildWhatsAppSystemPromptBackwardsCompat` — config minimal (campos nuevos vacíos) produce prompt válido
- `TestParseAssistantSignal` — casos: `[HANDOFF]`, `[ANSWER] texto`, texto sin prefix
- `TestProcessSQSHandoff_Silent` — handoffMode="" → no envía notificación
- `TestProcessSQSHandoff_NotifyOwner` — handoffMode="notify_owner" → llama SendTextToPatient con ownerChannel
- `TestIsAwaitingHuman_BlocksBot` — si AWAITING_HUMAN existe, webhook skip SQS
- `TestModelRouting` — haiku/sonnet/fallback

---

## Cambios en `template.yaml`

```yaml
# Vars nuevas en todas las funciones que usan WhatsApp:
WHATSAPP_HAIKU_MODEL_ID: "us.anthropic.claude-haiku-4-5-20251001-v1:0"
WHATSAPP_SONNET_MODEL_ID: "us.anthropic.claude-sonnet-4-6"

# IAM: añadir s3:GetObject al role de WhatsAppWorkerFunction
# (para cuando Fase 2 habilite S3 historical chats)
# No requiere bucket aún — se puede añadir el permiso ahora de forma preventiva.
```

---

## Fase 2 (fuera de scope actual)

- Nuevo bucket S3 `clinical-historical-chats-{accountId}`
- Lambda `HistoricalChatProcessorFunction` triggerada por `s3:ObjectCreated`
  - Descarga el archivo, genera resumen con Bedrock, actualiza `HistoricalChat.Summary` y `Status="ready"` en DynamoDB
- Endpoint `POST /admin/whatsapp/historical-chats` para subir archivos
- UI en frontend para gestionar históricos

---

## Archivos a modificar (Fase 1)

| Archivo                                   | Cambio                                                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `internal/store/whatsapp.go`              | Nuevos tipos + campos en WhatsAppConfig                                                             |
| `internal/store/dynamodb_whatsapp.go`     | MarkAwaitingHuman, IsAwaitingHuman, ClearAwaitingHuman                                              |
| `internal/service/whatsapp_ai_service.go` | buildWhatsAppSystemPrompt() 8 bloques + resolveModelID() + temperatura                              |
| `internal/bedrock/client.go`              | Soporte cache_control en system blocks                                                              |
| `internal/api/whatsapp_handler.go`        | parseAssistantSignal(), handoff logic, check IsAwaitingHuman, nuevos campos en SaveKnowledgeRequest |
| `backend/template.yaml`                   | WHATSAPP_HAIKU_MODEL_ID, WHATSAPP_SONNET_MODEL_ID                                                   |
| `.claude/skills/sync-asisten.md`          | Skill nuevo                                                                                         |

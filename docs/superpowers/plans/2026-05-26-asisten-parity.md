# Asisten Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring clinical's WhatsApp AI agent to full feature parity with alo-ai-engine's "asisten" module: 8-block prompt, Anthropic prompt caching, handoff signal, model routing, and sync skill.

**Architecture:** Extend `store.WhatsAppConfig` with 7 new optional fields (backwards-compatible), refactor `buildWhatsAppSystemPrompt` into an 8-block function returning a stable+dynamic split, add `InvokeWithOptions` to the Bedrock client for caching, add `AWAITING_HUMAN` DynamoDB pattern, and create a `.claude/skills/sync-asisten.md` skill for future syncing.

**Tech Stack:** Go 1.22, AWS Bedrock (Anthropic Claude Haiku/Sonnet), DynamoDB, SAM/Lambda, `github.com/aws/aws-sdk-go-v2`

**Spec:** `docs/superpowers/specs/2026-05-26-asisten-parity-design.md`

---

## File Map

| File                                           | Action | Responsibility                                                                               |
| ---------------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| `internal/store/whatsapp.go`                   | Modify | New types + extended WhatsAppConfig + extended interface                                     |
| `internal/store/dynamodb_whatsapp.go`          | Modify | MarkAwaitingHuman, IsAwaitingHuman, ClearAwaitingHuman                                       |
| `internal/bedrock/client.go`                   | Modify | InvokeWithOptions + SystemBlock + CacheControl types                                         |
| `internal/service/whatsapp_ai_service.go`      | Modify | 8-block prompt engine + model routing + updated GenerateResponse                             |
| `internal/service/whatsapp_service.go`         | Modify | Extended KnowledgeResult + KnowledgeSaveRequest + SaveKnowledge/GetKnowledge                 |
| `internal/api/whatsapp_handler.go`             | Modify | parseAssistantSignal + handoff in SQS processor + awaiting check in webhook + new API fields |
| `backend/template.yaml`                        | Modify | WHATSAPP_HAIKU_MODEL_ID + WHATSAPP_SONNET_MODEL_ID env vars                                  |
| `.claude/skills/sync-asisten.md`               | Create | Skill for detecting and applying alo-ai-engine changes to clinical                           |
| `internal/service/whatsapp_ai_service_test.go` | Create | Tests for prompt engine + model routing                                                      |
| `internal/api/whatsapp_handler_test.go`        | Create | Tests for parseAssistantSignal                                                               |

---

## Task 1: Extend store types and WhatsAppRepository interface

**Files:**

- Modify: `internal/store/whatsapp.go`
- Create: `internal/store/whatsapp_test.go`

- [ ] **Step 1.1: Write the failing compile test**

Create `internal/store/whatsapp_test.go`:

```go
package store_test

import (
	"testing"
	"clinical-backend/internal/store"
)

func TestWhatsAppConfigNewFields(t *testing.T) {
	cfg := store.WhatsAppConfig{
		KnowledgeBase:            "horarios: L-V 8am-6pm",
		CustomIdentity:           "Soy Docco, asistente de la clínica.",
		Considerations:           "No ofrecer descuentos sin autorización del director.",
		HandoffMode:              store.HandoffNotifyOwner,
		OwnerNotificationChannel: "+584140000000",
		ToneConfig:               "friendly",
		ModelTier:                "haiku",
		HistoricalChats: []store.HistoricalChat{
			{
				ID:             "chat-1",
				FileName:       "conversaciones.txt",
				UploadedAt:     "2026-05-26T10:00:00Z",
				S3Key:          "historical-chats/org-1/chat-1.txt",
				Summary:        "Resumen de conversaciones frecuentes.",
				CharacterCount: 1500,
				Status:         store.HistoricalChatReady,
			},
		},
	}

	if cfg.HandoffMode != store.HandoffNotifyOwner {
		t.Errorf("HandoffMode: got %q, want %q", cfg.HandoffMode, store.HandoffNotifyOwner)
	}
	if cfg.HistoricalChats[0].Status != store.HistoricalChatReady {
		t.Errorf("HistoricalChat.Status: got %q, want %q", cfg.HistoricalChats[0].Status, store.HistoricalChatReady)
	}
}
```

- [ ] **Step 1.2: Run the test to verify it fails**

```bash
cd backend && go test ./internal/store/... -run TestWhatsAppConfigNewFields -v
```

Expected: `FAIL` — compile error: `store.HistoricalChat undefined`, etc.

- [ ] **Step 1.3: Add new types and extend WhatsAppConfig in `internal/store/whatsapp.go`**

Replace the entire file content:

```go
package store

import "context"

// HistoricalChatStatus es el estado de procesamiento de un chat histórico.
type HistoricalChatStatus string

const (
	HistoricalChatPending HistoricalChatStatus = "pending_review"
	HistoricalChatReady   HistoricalChatStatus = "ready"
	HistoricalChatError   HistoricalChatStatus = "error"
)

// HistoricalChat representa un archivo de conversaciones históricas subido por el admin.
// Los chats con Status=="ready" tienen Summary populado y se inyectan en el prompt.
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

// HandoffMode controla qué pasa cuando el agente emite señal [HANDOFF].
type HandoffMode string

const (
	// HandoffSilent ignora la señal (no notifica al owner ni responde al paciente).
	HandoffSilent HandoffMode = "silent"
	// HandoffNotifyOwner envía un WhatsApp al OwnerNotificationChannel.
	HandoffNotifyOwner HandoffMode = "notify_owner"
)

// WhatsAppConfig almacena la configuración de WhatsApp por organización.
type WhatsAppConfig struct {
	OrgID                 string   `dynamodbav:"PK"`
	SK                    string   `dynamodbav:"SK"`
	Connected             bool     `dynamodbav:"connected"`
	InstanceName          string   `dynamodbav:"instanceName"`
	KnowledgeBase         string   `dynamodbav:"knowledgeBase"`
	WelcomeMessage        string   `dynamodbav:"welcomeMessage"`
	AssistantInstructions string   `dynamodbav:"assistantInstructions"`
	BotDisabled           bool     `dynamodbav:"botDisabled"`
	BotMode               string   `dynamodbav:"botMode"`
	BetaTestPhones        []string `dynamodbav:"betaTestPhones"`
	UpdatedAt             string   `dynamodbav:"updatedAt"`

	// Campos del agente asisten (todos opcionales — zero value = comportamiento anterior)
	CustomIdentity           string           `json:"customIdentity,omitempty" dynamodbav:"customIdentity,omitempty"`
	Considerations           string           `json:"considerations,omitempty" dynamodbav:"considerations,omitempty"`
	HistoricalChats          []HistoricalChat `json:"historicalChats,omitempty" dynamodbav:"historicalChats,omitempty"`
	HandoffMode              HandoffMode      `json:"handoffMode,omitempty" dynamodbav:"handoffMode,omitempty"`
	OwnerNotificationChannel string           `json:"ownerNotificationChannel,omitempty" dynamodbav:"ownerNotificationChannel,omitempty"`
	ToneConfig               string           `json:"toneConfig,omitempty" dynamodbav:"toneConfig,omitempty"`
	ModelTier                string           `json:"modelTier,omitempty" dynamodbav:"modelTier,omitempty"`
}

// ConversationTurn es un turno de la conversación entre el paciente y el asistente.
type ConversationTurn struct {
	Role    string // "user" o "assistant"
	Content string
}

// WhatsAppRepository define operaciones CRUD para la configuración de WhatsApp.
type WhatsAppRepository interface {
	Get(ctx context.Context, orgID string) (*WhatsAppConfig, error)
	Save(ctx context.Context, cfg *WhatsAppConfig) error
	SetConnected(ctx context.Context, orgID string, connected bool) error
	SetBotMode(ctx context.Context, orgID string, enabled bool, mode string, phones []string) error
	SaveConversationTurn(ctx context.Context, orgID, phone, role, content string) error
	GetRecentConversation(ctx context.Context, orgID, phone string, limit int) ([]ConversationTurn, error)
	// Métodos para gestionar el estado AWAITING_HUMAN (bot cede al operador humano).
	MarkAwaitingHuman(ctx context.Context, orgID, phone, reason string) error
	IsAwaitingHuman(ctx context.Context, orgID, phone string) (bool, error)
	ClearAwaitingHuman(ctx context.Context, orgID, phone string) error
}
```

- [ ] **Step 1.4: Run the test to verify it passes**

```bash
cd backend && go test ./internal/store/... -run TestWhatsAppConfigNewFields -v
```

Expected: `PASS`

- [ ] **Step 1.5: Verify build still compiles (interface now has 3 new methods)**

```bash
cd backend && go build ./...
```

Expected: **compile errors** en `dynamodb_whatsapp.go` — "does not implement WhatsAppRepository (missing MarkAwaitingHuman, IsAwaitingHuman, ClearAwaitingHuman)". Esto es correcto: la tarea 2 los implementa.

- [ ] **Step 1.6: Commit**

```bash
git add backend/internal/store/whatsapp.go backend/internal/store/whatsapp_test.go
git commit -m "feat(store): extend WhatsAppConfig with asisten fields and update interface"
```

---

## Task 2: DynamoDB AWAITING_HUMAN methods

**Files:**

- Modify: `internal/store/dynamodb_whatsapp.go`

- [ ] **Step 2.1: Add `awaitingHumanItem` struct and the 3 new methods**

Append to the end of `internal/store/dynamodb_whatsapp.go` (después de la última función):

```go
// awaitingHumanItem representa el ítem DynamoDB para el estado AWAITING_HUMAN.
type awaitingHumanItem struct {
	PK        string `dynamodbav:"PK"`
	SK        string `dynamodbav:"SK"`
	Reason    string `dynamodbav:"reason"`
	CreatedAt string `dynamodbav:"createdAt"`
	TTL       int64  `dynamodbav:"ttl"`
}

func awaitingHumanSK(phone string) string {
	return "AWAITING_HUMAN#" + phone
}

// MarkAwaitingHuman registra que el número `phone` necesita atención humana.
// El ítem expira automáticamente 72 horas después (requiere TTL habilitado en la tabla).
func (r *dynamoWhatsAppRepo) MarkAwaitingHuman(ctx context.Context, orgID, phone, reason string) error {
	now := time.Now().UTC()
	item := awaitingHumanItem{
		PK:        "ORG#" + orgID,
		SK:        awaitingHumanSK(phone),
		Reason:    reason,
		CreatedAt: now.Format(time.RFC3339),
		TTL:       now.Add(72 * time.Hour).Unix(),
	}
	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		return fmt.Errorf("whatsapp awaiting marshal: %w", err)
	}
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      av,
	})
	return err
}

// IsAwaitingHuman retorna true si el número `phone` tiene un handoff pendiente.
func (r *dynamoWhatsAppRepo) IsAwaitingHuman(ctx context.Context, orgID, phone string) (bool, error) {
	result, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: "ORG#" + orgID},
			"SK": &types.AttributeValueMemberS{Value: awaitingHumanSK(phone)},
		},
	})
	if err != nil {
		return false, fmt.Errorf("whatsapp awaiting get: %w", err)
	}
	return result.Item != nil, nil
}

// ClearAwaitingHuman elimina el estado AWAITING_HUMAN para que el bot retome la conversación.
func (r *dynamoWhatsAppRepo) ClearAwaitingHuman(ctx context.Context, orgID, phone string) error {
	_, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: "ORG#" + orgID},
			"SK": &types.AttributeValueMemberS{Value: awaitingHumanSK(phone)},
		},
	})
	return err
}
```

- [ ] **Step 2.2: Verify compilation**

```bash
cd backend && go build ./...
```

Expected: sin errores de compilación.

- [ ] **Step 2.3: Commit**

```bash
git add backend/internal/store/dynamodb_whatsapp.go
git commit -m "feat(store): add MarkAwaitingHuman, IsAwaitingHuman, ClearAwaitingHuman to DynamoDB repo"
```

---

## Task 3: Bedrock client — InvokeWithOptions con prompt caching

**Files:**

- Modify: `internal/bedrock/client.go`
- Create: `internal/bedrock/client_test.go`

- [ ] **Step 3.1: Write the failing test**

Create `internal/bedrock/client_test.go`:

```go
package bedrock

import (
	"encoding/json"
	"testing"
)

func TestSystemBlocksCachedSerialization(t *testing.T) {
	blocks := []SystemBlock{
		{
			Text:         "prompt estable",
			CacheControl: &CacheControl{Type: "ephemeral"},
		},
		{
			Text: "recordatorio dinámico",
		},
	}

	req := anthropicCachedRequest{
		AnthropicVersion: "bedrock-2023-05-31",
		MaxTokens:        1024,
		System:           blocks,
		Messages:         []Message{{Role: "user", Content: "hola"}},
	}

	b, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var out map[string]interface{}
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	sys, ok := out["system"].([]interface{})
	if !ok {
		t.Fatalf("system is not an array: %T", out["system"])
	}
	if len(sys) != 2 {
		t.Fatalf("expected 2 system blocks, got %d", len(sys))
	}
	first := sys[0].(map[string]interface{})
	if _, hasCacheControl := first["cache_control"]; !hasCacheControl {
		t.Error("first block should have cache_control")
	}
	second := sys[1].(map[string]interface{})
	if _, hasCacheControl := second["cache_control"]; hasCacheControl {
		t.Error("second block should NOT have cache_control")
	}
}

func TestInvokeOptionsResolveModelID(t *testing.T) {
	c := &Client{modelID: "default-model"}
	tests := []struct {
		opts    InvokeOptions
		wantID  string
	}{
		{InvokeOptions{}, "default-model"},
		{InvokeOptions{ModelID: "custom-model"}, "custom-model"},
	}
	for _, tt := range tests {
		got := c.resolveModelID(tt.opts)
		if got != tt.wantID {
			t.Errorf("resolveModelID(%v) = %q, want %q", tt.opts, got, tt.wantID)
		}
	}
}
```

- [ ] **Step 3.2: Run test to verify it fails**

```bash
cd backend && go test ./internal/bedrock/... -v
```

Expected: `FAIL` — compile error: `SystemBlock undefined`, `anthropicCachedRequest undefined`, etc.

- [ ] **Step 3.3: Add types and InvokeWithOptions to `internal/bedrock/client.go`**

Append al final del archivo (después de `parseNovaResponse`):

```go
// --- Opciones avanzadas de invocación ---

// SystemBlock es un bloque del system prompt con soporte de cache_control.
type SystemBlock struct {
	Type         string        `json:"type"`
	Text         string        `json:"text"`
	CacheControl *CacheControl `json:"cache_control,omitempty"`
}

// CacheControl activa el prompt caching de Anthropic para un bloque.
type CacheControl struct {
	Type string `json:"type"` // "ephemeral"
}

// InvokeOptions configura una llamada a Bedrock con control avanzado.
type InvokeOptions struct {
	ModelID      string        // Override del modelo (vacío = usa el modelo del cliente)
	Temperature  float64       // Temperatura de inferencia (0 = omitir, usa default del modelo)
	SystemBlocks []SystemBlock // Si no es nil, reemplaza systemPrompt con bloques cacheables (solo Anthropic)
}

func (c *Client) resolveModelID(opts InvokeOptions) string {
	if opts.ModelID != "" {
		return opts.ModelID
	}
	return c.modelID
}

// anthropicCachedRequest es el payload Anthropic con system como array de bloques.
type anthropicCachedRequest struct {
	AnthropicVersion string        `json:"anthropic_version"`
	MaxTokens        int           `json:"max_tokens"`
	Temperature      *float64      `json:"temperature,omitempty"`
	System           []SystemBlock `json:"system,omitempty"`
	Messages         []Message     `json:"messages"`
}

// InvokeWithOptions es como Invoke pero acepta modelo override, temperatura y prompt caching.
// Si opts.SystemBlocks no es nil y el modelo es Anthropic, usa el formato de array con cache_control.
func (c *Client) InvokeWithOptions(ctx context.Context, systemPrompt string, msgs []Message, opts InvokeOptions) (string, error) {
	modelID := c.resolveModelID(opts)

	var bodyBytes []byte
	var err error

	isAnthropicModel := func(id string) bool {
		lower := strings.ToLower(id)
		return strings.Contains(lower, "anthropic") || strings.Contains(lower, "claude")
	}

	if isAnthropicModel(modelID) {
		req := anthropicCachedRequest{
			AnthropicVersion: "bedrock-2023-05-31",
			MaxTokens:        1024,
			Messages:         msgs,
		}
		if opts.Temperature > 0 {
			t := opts.Temperature
			req.Temperature = &t
		}
		if len(opts.SystemBlocks) > 0 {
			// Normalizar: el campo "type" siempre es "text" en los bloques de system.
			blocks := make([]SystemBlock, len(opts.SystemBlocks))
			for i, b := range opts.SystemBlocks {
				blocks[i] = b
				if blocks[i].Type == "" {
					blocks[i].Type = "text"
				}
			}
			req.System = blocks
		} else if systemPrompt != "" {
			req.System = []SystemBlock{{Type: "text", Text: systemPrompt}}
		}
		bodyBytes, err = json.Marshal(req)
	} else {
		bodyBytes, err = json.Marshal(c.buildNovaRequest(systemPrompt, msgs))
	}
	if err != nil {
		return "", fmt.Errorf("bedrock: marshal request: %w", err)
	}

	out, err := c.runtime.InvokeModel(ctx, &bedrockruntime.InvokeModelInput{
		ModelId:     aws.String(modelID),
		ContentType: aws.String("application/json"),
		Accept:      aws.String("application/json"),
		Body:        bodyBytes,
	})
	if err != nil {
		return "", fmt.Errorf("bedrock: invoke model: %w", err)
	}

	if isAnthropicModel(modelID) {
		return parseAnthropicResponse(out.Body)
	}
	return parseNovaResponse(out.Body)
}
```

- [ ] **Step 3.4: Run test to verify it passes**

```bash
cd backend && go test ./internal/bedrock/... -v
```

Expected: `PASS`

- [ ] **Step 3.5: Verify build completo**

```bash
cd backend && go build ./...
```

Expected: sin errores.

- [ ] **Step 3.6: Commit**

```bash
git add backend/internal/bedrock/client.go backend/internal/bedrock/client_test.go
git commit -m "feat(bedrock): add InvokeWithOptions with model override, temperature and prompt caching"
```

---

## Task 4: Prompt engine de 8 bloques + model routing

**Files:**

- Modify: `internal/service/whatsapp_ai_service.go`
- Create: `internal/service/whatsapp_ai_service_test.go`

- [ ] **Step 4.1: Write the failing tests**

Create `internal/service/whatsapp_ai_service_test.go`:

```go
package service

import (
	"strings"
	"testing"

	"clinical-backend/internal/store"
)

func TestBuildWhatsAppSystemPromptAllBlocks(t *testing.T) {
	cfg := &store.WhatsAppConfig{
		KnowledgeBase:            "Horarios: L-V 8am-6pm. Tel: 0212-555-1234.",
		Considerations:           "No ofrecer descuentos sin autorización.",
		CustomIdentity:           "Soy Docco, asistente de Clínica Demo.",
		HandoffMode:              store.HandoffNotifyOwner,
		ToneConfig:               "formal",
		HistoricalChats: []store.HistoricalChat{
			{Status: store.HistoricalChatReady, Summary: "Los pacientes preguntan mucho por ortodoncia."},
		},
	}

	stable, dynamic := buildWhatsAppSystemPrompt(cfg, "Clínica Demo")

	// Bloque 1: identidad personalizada
	if !strings.Contains(stable, "Soy Docco") {
		t.Error("should contain custom identity")
	}
	// Bloque 2: guardrails
	if !strings.Contains(stable, "NUNCA recomiendes medicamentos") {
		t.Error("should contain hard guardrails")
	}
	// Bloque 3: consideraciones
	if !strings.Contains(stable, "No ofrecer descuentos") {
		t.Error("should contain considerations")
	}
	// Bloque 4: knowledge base
	if !strings.Contains(stable, "Horarios: L-V") {
		t.Error("should contain knowledge base")
	}
	if !strings.Contains(stable, "ortodoncia") {
		t.Error("should contain historical chat summary")
	}
	// Bloque 5: tono formal
	if !strings.Contains(stable, "formal") || !strings.Contains(stable, "usted") {
		t.Error("should contain formal tone instructions")
	}
	// Bloque 6: reglas de decisión (porque HandoffMode != "")
	if !strings.Contains(stable, "[ANSWER]") || !strings.Contains(stable, "[HANDOFF]") {
		t.Error("should contain decision rules with ANSWER and HANDOFF signals")
	}
	// Bloque 8: recordatorio dinámico
	if strings.TrimSpace(dynamic) == "" {
		t.Error("dynamic reminder should not be empty")
	}
}

func TestBuildWhatsAppSystemPromptBackwardsCompat(t *testing.T) {
	// Config mínima (sin campos nuevos) — debe generar un prompt válido.
	cfg := &store.WhatsAppConfig{
		KnowledgeBase:         "Info básica.",
		AssistantInstructions: "Instrucciones básicas.",
	}

	stable, _ := buildWhatsAppSystemPrompt(cfg, "Clínica Test")

	// Sin custom identity → usa el default
	if !strings.Contains(stable, "asistente virtual de Clínica Test") {
		t.Error("default identity should mention clinic name")
	}
	// AssistantInstructions como fallback de Considerations
	if !strings.Contains(stable, "Instrucciones básicas") {
		t.Error("should use AssistantInstructions as fallback for considerations")
	}
	// Sin HandoffMode → no incluir reglas ANSWER/HANDOFF
	if strings.Contains(stable, "[ANSWER]") {
		t.Error("should NOT contain ANSWER/HANDOFF rules when HandoffMode is empty")
	}
}

func TestBuildWhatsAppSystemPromptKBLimit(t *testing.T) {
	bigKB := strings.Repeat("x", 90000)
	cfg := &store.WhatsAppConfig{KnowledgeBase: bigKB}
	stable, _ := buildWhatsAppSystemPrompt(cfg, "Clínica")
	// La KB se trunca a 80000 chars; el prompt total debe ser < 100000
	if len(stable) > 100000 {
		t.Errorf("prompt too large: %d chars", len(stable))
	}
}

func TestResolveModelID(t *testing.T) {
	svc := &WhatsAppAIService{}
	tests := []struct {
		tier    string
		haiku   string
		sonnet  string
		fallback string
		want    string
	}{
		{"haiku", "haiku-model", "sonnet-model", "old-model", "haiku-model"},
		{"sonnet", "haiku-model", "sonnet-model", "old-model", "sonnet-model"},
		{"", "haiku-model", "sonnet-model", "old-model", "haiku-model"},        // empty = haiku
		{"haiku", "", "sonnet-model", "old-model", "old-model"},                // haiku missing, fallback
		{"sonnet", "haiku-model", "", "old-model", "old-model"},               // sonnet missing, fallback
	}
	for _, tt := range tests {
		t.Setenv("WHATSAPP_HAIKU_MODEL_ID", tt.haiku)
		t.Setenv("WHATSAPP_SONNET_MODEL_ID", tt.sonnet)
		t.Setenv("WHATSAPP_MODEL_ID", tt.fallback)
		cfg := &store.WhatsAppConfig{ModelTier: tt.tier}
		got := svc.resolveModelID(cfg)
		if got != tt.want {
			t.Errorf("tier=%q: got %q, want %q", tt.tier, got, tt.want)
		}
	}
}
```

- [ ] **Step 4.2: Run test to verify it fails**

```bash
cd backend && go test ./internal/service/... -run "TestBuildWhatsApp|TestResolveModelID" -v
```

Expected: `FAIL` — `buildWhatsAppSystemPrompt` tiene firma diferente, `resolveModelID` no existe.

- [ ] **Step 4.3: Reemplazar `internal/service/whatsapp_ai_service.go` completo**

```go
package service

import (
	"context"
	"fmt"
	"os"
	"strings"

	"clinical-backend/internal/bedrock"
	"clinical-backend/internal/store"
)

// WhatsAppAIService genera respuestas para el asistente de WhatsApp usando Bedrock.
type WhatsAppAIService struct {
	bedrock *bedrock.Client
}

// NewWhatsAppAIService crea un nuevo servicio de IA para WhatsApp.
func NewWhatsAppAIService(bedrockClient *bedrock.Client) *WhatsAppAIService {
	return &WhatsAppAIService{bedrock: bedrockClient}
}

// GenerateResponse genera una respuesta al mensaje de un paciente.
// Retorna el texto crudo del modelo (puede incluir prefijos [ANSWER] o [HANDOFF]).
// El llamador es responsable de parsear la señal con parseAssistantSignal.
func (s *WhatsAppAIService) GenerateResponse(
	ctx context.Context,
	cfg *store.WhatsAppConfig,
	clinicName string,
	history []store.ConversationTurn,
	userMessage string,
) (string, error) {
	stablePrompt, dynamicReminder := buildWhatsAppSystemPrompt(cfg, clinicName)
	modelID := s.resolveModelID(cfg)

	msgs := make([]bedrock.Message, 0, len(history)+1)
	for _, turn := range history {
		msgs = append(msgs, bedrock.Message{Role: turn.Role, Content: turn.Content})
	}
	msgs = append(msgs, bedrock.Message{Role: "user", Content: userMessage})

	opts := bedrock.InvokeOptions{
		ModelID:     modelID,
		Temperature: 0.4,
	}

	// Solo activar caching para modelos Anthropic.
	if isAnthropicModelID(modelID) && strings.TrimSpace(dynamicReminder) != "" {
		opts.SystemBlocks = []bedrock.SystemBlock{
			{Text: stablePrompt, CacheControl: &bedrock.CacheControl{Type: "ephemeral"}},
			{Text: dynamicReminder},
		}
	}

	reply, err := s.bedrock.InvokeWithOptions(ctx, stablePrompt, msgs, opts)
	if err != nil {
		return "", fmt.Errorf("whatsapp ai: bedrock invoke: %w", err)
	}
	return strings.TrimSpace(reply), nil
}

// resolveModelID selecciona el modelo Bedrock según el ModelTier configurado.
// Prioridad: WHATSAPP_SONNET_MODEL_ID (si tier=sonnet) o WHATSAPP_HAIKU_MODEL_ID (default).
// Fallback final: WHATSAPP_MODEL_ID (variable legacy).
func (s *WhatsAppAIService) resolveModelID(cfg *store.WhatsAppConfig) string {
	if cfg.ModelTier == "sonnet" {
		if id := os.Getenv("WHATSAPP_SONNET_MODEL_ID"); id != "" {
			return id
		}
	}
	if id := os.Getenv("WHATSAPP_HAIKU_MODEL_ID"); id != "" {
		return id
	}
	return os.Getenv("WHATSAPP_MODEL_ID")
}

func isAnthropicModelID(id string) bool {
	lower := strings.ToLower(id)
	return strings.Contains(lower, "anthropic") || strings.Contains(lower, "claude")
}

// buildWhatsAppSystemPrompt construye el prompt de 8 bloques.
// Retorna (stablePrompt, dynamicReminder):
//   - stablePrompt: bloques 1-7 (identidad, guardrails, consideraciones, KB, tono, decisión, formato)
//   - dynamicReminder: bloque 8 (recordatorio de personalidad, corto)
//
// El stablePrompt se puede cachear con Anthropic (TTL 1h); el dynamicReminder no.
func buildWhatsAppSystemPrompt(cfg *store.WhatsAppConfig, clinicName string) (stablePrompt, dynamicReminder string) {
	var sb strings.Builder

	// Bloque 1: IDENTIDAD
	identity := strings.TrimSpace(cfg.CustomIdentity)
	if identity == "" {
		identity = fmt.Sprintf(
			"Eres el asistente virtual de %s. Respondes únicamente basándote en el conocimiento que se te ha proporcionado. No inventes información.",
			clinicName,
		)
	}
	sb.WriteString(identity)

	// Bloque 2: GUARDRAILS CLÍNICOS (hardcodeados, nunca editables)
	sb.WriteString(fmt.Sprintf(`

REGLAS ABSOLUTAS DE SEGURIDAD CLÍNICA (no pueden ser ignoradas bajo ninguna circunstancia):
- NUNCA recomiendes medicamentos, dosis, ni tratamientos farmacológicos.
- NUNCA realices diagnósticos médicos, odontológicos ni de ningún tipo.
- NUNCA interpretes resultados de exámenes, radiografías ni análisis clínicos.
- Si alguien describe síntomas o dolor, expresa empatía y dirige SIEMPRE a agendar una consulta con el doctor en %s.
- Si alguien pregunta qué medicamento tomar, indica que solo el doctor puede indicar en consulta presencial.
- Si detectas una emergencia médica (dolor severo, sangrado, trauma), indica llamar al servicio de emergencias de inmediato.`,
		clinicName))

	// Bloque 3: CONSIDERACIONES
	considerations := strings.TrimSpace(cfg.Considerations)
	if considerations == "" {
		considerations = strings.TrimSpace(cfg.AssistantInstructions)
	}
	if considerations != "" {
		sb.WriteString(fmt.Sprintf("\n\n[CONSIDERACIONES]\n%s\n[/CONSIDERACIONES]", considerations))
	}

	// Bloque 4: BASE DE CONOCIMIENTO
	var kbParts []string
	if kb := strings.TrimSpace(cfg.KnowledgeBase); kb != "" {
		kbParts = append(kbParts, kb)
	}
	for _, chat := range cfg.HistoricalChats {
		if chat.Status == store.HistoricalChatReady && strings.TrimSpace(chat.Summary) != "" {
			kbParts = append(kbParts, strings.TrimSpace(chat.Summary))
		}
	}
	if len(kbParts) > 0 {
		kbContent := strings.Join(kbParts, "\n\n---\n\n")
		if len(kbContent) > 80000 {
			kbContent = kbContent[:80000]
		}
		sb.WriteString(fmt.Sprintf("\n\n[BASE_DE_CONOCIMIENTO]\n%s\n[/BASE_DE_CONOCIMIENTO]", kbContent))
	}

	// Bloque 5: TONO
	toneInstructions := map[string]string{
		"formal":   "Usa un tono formal y profesional. Habla de usted. Evita contracciones y lenguaje coloquial.",
		"casual":   "Usa un tono casual e informal. Puedes usar emojis con moderación. Habla de tú.",
		"friendly": "Usa un tono amigable y cercano. Habla de tú. Sé natural y empático.",
	}
	tone, ok := toneInstructions[cfg.ToneConfig]
	if !ok {
		tone = toneInstructions["friendly"]
	}
	sb.WriteString("\n\nTONO DE COMUNICACIÓN:\n" + tone)

	// Bloque 6: REGLAS DE DECISIÓN (solo si HandoffMode está configurado)
	if cfg.HandoffMode != "" {
		sb.WriteString("\n\nREGLAS DE RESPUESTA:\n- Cuando puedas responder con la información disponible, comienza tu respuesta con [ANSWER].\n- Cuando la pregunta esté fuera de tu conocimiento o requiera atención humana, responde exactamente [HANDOFF] sin texto adicional.")
	}

	// Bloque 7: FORMATO
	sb.WriteString("\n\nFORMATO DE RESPUESTA:\n- Responde de forma amable, clara y concisa.\n- Máximo 3 párrafos cortos (formato WhatsApp, sin markdown).\n- Responde siempre en el mismo idioma que el paciente.\n- Si no tienes información sobre algo, indica que contacten directamente a la clínica.")

	stablePrompt = sb.String()

	// Bloque 8: RECORDATORIO DE PERSONALIDAD (dinámico — no cacheable)
	toneWords := map[string]string{
		"formal":   "formal y profesional",
		"casual":   "casual y cercana",
		"friendly": "amigable y cercana",
	}
	toneWord, ok := toneWords[cfg.ToneConfig]
	if !ok {
		toneWord = toneWords["friendly"]
	}
	dynamicReminder = fmt.Sprintf("Recuerda responder siempre de forma %s, como el asistente de %s.", toneWord, clinicName)

	return stablePrompt, dynamicReminder
}
```

- [ ] **Step 4.4: Run tests to verify they pass**

```bash
cd backend && go test ./internal/service/... -run "TestBuildWhatsApp|TestResolveModelID" -v
```

Expected: todos `PASS`.

- [ ] **Step 4.5: Verify build**

```bash
cd backend && go build ./...
```

Expected: **compile error** en `internal/api/whatsapp_handler.go` porque `aiSvc.GenerateResponse` cambió de firma. Esto es esperado; la tarea 5 lo arregla.

- [ ] **Step 4.6: Commit**

```bash
git add backend/internal/service/whatsapp_ai_service.go backend/internal/service/whatsapp_ai_service_test.go
git commit -m "feat(service): refactor prompt engine to 8 blocks with caching + model routing"
```

---

## Task 5: parseAssistantSignal + actualizar SQS processor

**Files:**

- Modify: `internal/api/whatsapp_handler.go`
- Create: `internal/api/whatsapp_handler_test.go`

- [ ] **Step 5.1: Write the failing test**

Create `internal/api/whatsapp_handler_test.go`:

```go
package api

import (
	"testing"
)

func TestParseAssistantSignal(t *testing.T) {
	tests := []struct {
		input       string
		wantSignal  string
		wantReply   string
	}{
		{"[ANSWER] Hola, ¿en qué te puedo ayudar?", "answer", "Hola, ¿en qué te puedo ayudar?"},
		{"[ANSWER]Hola", "answer", "Hola"},
		{"[HANDOFF]", "handoff", ""},
		{"[HANDOFF] algo más", "handoff", ""},
		{"Respuesta sin prefijo", "answer", "Respuesta sin prefijo"},
		{"  [ANSWER]  texto con espacios  ", "answer", "texto con espacios"},
		{"  [HANDOFF]  ", "handoff", ""},
	}
	for _, tt := range tests {
		signal, reply := parseAssistantSignal(tt.input)
		if signal != tt.wantSignal {
			t.Errorf("parseAssistantSignal(%q): signal = %q, want %q", tt.input, signal, tt.wantSignal)
		}
		if reply != tt.wantReply {
			t.Errorf("parseAssistantSignal(%q): reply = %q, want %q", tt.input, reply, tt.wantReply)
		}
	}
}
```

- [ ] **Step 5.2: Run test to verify it fails**

```bash
cd backend && go test ./internal/api/... -run TestParseAssistantSignal -v
```

Expected: `FAIL` — `parseAssistantSignal undefined`.

- [ ] **Step 5.3: Agregar `parseAssistantSignal` y actualizar `ProcessWhatsAppSQSRecord` en `internal/api/whatsapp_handler.go`**

**Agregar la función `parseAssistantSignal`** después de `extractText` (antes de `handleWhatsAppConnect`, ~línea 96):

```go
// parseAssistantSignal parsea la respuesta del AI para detectar señales de control.
// Retorna ("handoff", "") si el modelo emitió [HANDOFF].
// Retorna ("answer", texto) en cualquier otro caso.
func parseAssistantSignal(reply string) (signal, cleanReply string) {
	trimmed := strings.TrimSpace(reply)
	if strings.HasPrefix(trimmed, "[HANDOFF]") {
		return "handoff", ""
	}
	clean := strings.TrimPrefix(trimmed, "[ANSWER]")
	return "answer", strings.TrimSpace(clean)
}
```

**Reemplazar el cuerpo de `ProcessWhatsAppSQSRecord`** (función completa, ~líneas 288-332):

```go
// ProcessWhatsAppSQSRecord procesa un mensaje SQS del worker de WhatsApp.
func ProcessWhatsAppSQSRecord(ctx context.Context, body string, whatsAppSvc *service.WhatsAppService, aiSvc *service.WhatsAppAIService, repo store.WhatsAppRepository, authRepo store.AuthRepository) error {
	if whatsAppSvc == nil || aiSvc == nil || repo == nil {
		log.Printf("whatsapp worker: services not configured, skipping record")
		return nil
	}

	var msg whatsAppSQSMessage
	if err := json.Unmarshal([]byte(body), &msg); err != nil {
		return nil // mensaje malformado, descartar
	}

	cfg, err := repo.Get(ctx, msg.OrgID)
	if err != nil {
		return err
	}

	// Nombre de la clínica desde la organización; fallback genérico si no está disponible.
	clinicName := "la clínica"
	if authRepo != nil {
		if org, orgErr := authRepo.GetOrganization(ctx, msg.OrgID); orgErr == nil && org.Name != "" {
			clinicName = org.Name
		}
	}

	// Leer historial reciente (no bloqueante).
	history, _ := repo.GetRecentConversation(ctx, msg.OrgID, msg.Phone, 10)

	// Guardar turno del usuario antes de llamar al AI.
	if saveErr := repo.SaveConversationTurn(ctx, msg.OrgID, msg.Phone, "user", msg.Message); saveErr != nil {
		log.Printf("whatsapp worker: save user turn: %v", saveErr)
	}

	rawResponse, err := aiSvc.GenerateResponse(ctx, cfg, clinicName, history, msg.Message)
	if err != nil {
		return err
	}

	signal, cleanReply := parseAssistantSignal(rawResponse)

	switch signal {
	case "handoff":
		if markErr := repo.MarkAwaitingHuman(ctx, msg.OrgID, msg.Phone, "no_kb_match"); markErr != nil {
			log.Printf("whatsapp worker: mark awaiting human: %v", markErr)
		}
		if cfg.HandoffMode == store.HandoffNotifyOwner && cfg.OwnerNotificationChannel != "" {
			notif := fmt.Sprintf("⚠️ El paciente %s requiere atención humana (WhatsApp).", msg.Phone)
			if sendErr := whatsAppSvc.SendTextToPatient(ctx, msg.InstanceName, cfg.OwnerNotificationChannel, notif); sendErr != nil {
				log.Printf("whatsapp worker: notify owner: %v", sendErr)
			}
		}
		// No responder al paciente — el handoff es silencioso desde su perspectiva.
		return nil

	default: // "answer"
		if saveErr := repo.SaveConversationTurn(ctx, msg.OrgID, msg.Phone, "assistant", cleanReply); saveErr != nil {
			log.Printf("whatsapp worker: save assistant turn: %v", saveErr)
		}
		return whatsAppSvc.SendTextToPatient(ctx, msg.InstanceName, msg.Phone, cleanReply)
	}
}
```

**Agregar el import de `fmt`** si no está (verificar la sección de imports en el archivo).

- [ ] **Step 5.4: Run test to verify it passes**

```bash
cd backend && go test ./internal/api/... -run TestParseAssistantSignal -v
```

Expected: `PASS`.

- [ ] **Step 5.5: Verify build**

```bash
cd backend && go build ./...
```

Expected: sin errores.

- [ ] **Step 5.6: Run all tests**

```bash
cd backend && go test ./...
```

Expected: todos pasan (o los que existían antes siguen pasando).

- [ ] **Step 5.7: Commit**

```bash
git add backend/internal/api/whatsapp_handler.go backend/internal/api/whatsapp_handler_test.go
git commit -m "feat(api): add parseAssistantSignal and handoff handling in SQS processor"
```

---

## Task 6: Webhook AWAITING_HUMAN check + admin API nuevos campos

**Files:**

- Modify: `internal/api/whatsapp_handler.go`
- Modify: `internal/service/whatsapp_service.go`

- [ ] **Step 6.1: Agregar check de AWAITING_HUMAN en `handleWhatsAppWebhook`**

En `internal/api/whatsapp_handler.go`, dentro del case `"messages.upsert"`, **después** del bloque de filtros de bot (después del bloque que cierra con `}` en la línea ~222) y **antes** del bloque SQS, agregar:

```go
			// Si el número está esperando atención humana, el bot no interviene.
			if r.whatsAppRepo != nil {
				if awaiting, awaitErr := r.whatsAppRepo.IsAwaitingHuman(ctx, orgID, phone); awaitErr == nil && awaiting {
					log.Printf("MSG_SKIP_AWAITING_HUMAN orgId=%s phone=%s", orgID, phone)
					return response(200, map[string]string{"status": "awaiting_human"})
				}
			}
```

El bloque completo de `"messages.upsert"` ahora tiene el orden:

1. Parsear mensaje y extraer texto
2. Filtros de bot (botDisabled, beta mode) ← ya existe
3. **Check AWAITING_HUMAN** ← nuevo
4. Enqueue a SQS ← ya existe

- [ ] **Step 6.2: Actualizar `handleWhatsAppSaveKnowledge` con los nuevos campos**

Reemplazar la función `handleWhatsAppSaveKnowledge` en `internal/api/whatsapp_handler.go`:

```go
func (r *Router) handleWhatsAppSaveKnowledge(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	auth := ctx.Value(ctxAuthKey).(service.Authenticated)
	var body struct {
		KnowledgeBase            string           `json:"knowledgeBase"`
		WelcomeMessage           string           `json:"welcomeMessage"`
		AssistantInstructions    string           `json:"assistantInstructions"`
		CustomIdentity           string           `json:"customIdentity"`
		Considerations           string           `json:"considerations"`
		HandoffMode              store.HandoffMode `json:"handoffMode"`
		OwnerNotificationChannel string           `json:"ownerNotificationChannel"`
		ToneConfig               string           `json:"toneConfig"`
		ModelTier                string           `json:"modelTier"`
	}
	if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	saveReq := service.KnowledgeSaveRequest{
		KnowledgeBase:            body.KnowledgeBase,
		WelcomeMessage:           body.WelcomeMessage,
		AssistantInstructions:    body.AssistantInstructions,
		CustomIdentity:           body.CustomIdentity,
		Considerations:           body.Considerations,
		HandoffMode:              body.HandoffMode,
		OwnerNotificationChannel: body.OwnerNotificationChannel,
		ToneConfig:               body.ToneConfig,
		ModelTier:                body.ModelTier,
	}
	if err := r.whatsApp.SaveKnowledge(ctx, auth.User.OrgID, saveReq); err != nil {
		return response(500, map[string]string{"error": err.Error()})
	}
	return response(200, map[string]string{"status": "saved"})
}
```

- [ ] **Step 6.3: Agregar import `store` en `whatsapp_handler.go`**

Verificar que el import de `"clinical-backend/internal/store"` esté en la sección de imports del archivo. Si no está, agregarlo.

- [ ] **Step 6.4: Actualizar `KnowledgeSaveRequest`, `KnowledgeResult`, `SaveKnowledge` y `GetKnowledge` en `internal/service/whatsapp_service.go`**

Reemplazar las estructuras y funciones relevantes (desde la línea `// KnowledgeResult es la Base de Conocimiento configurada.` hasta el final de `SaveKnowledge`):

```go
// KnowledgeSaveRequest contiene todos los campos configurables del agente WhatsApp.
type KnowledgeSaveRequest struct {
	KnowledgeBase            string
	WelcomeMessage           string
	AssistantInstructions    string
	CustomIdentity           string
	Considerations           string
	HandoffMode              store.HandoffMode
	OwnerNotificationChannel string
	ToneConfig               string
	ModelTier                string
}

// KnowledgeResult es la configuración completa del agente devuelta al frontend.
type KnowledgeResult struct {
	KnowledgeBase            string                  `json:"knowledgeBase"`
	WelcomeMessage           string                  `json:"welcomeMessage"`
	AssistantInstructions    string                  `json:"assistantInstructions"`
	CustomIdentity           string                  `json:"customIdentity,omitempty"`
	Considerations           string                  `json:"considerations,omitempty"`
	HandoffMode              store.HandoffMode       `json:"handoffMode,omitempty"`
	OwnerNotificationChannel string                  `json:"ownerNotificationChannel,omitempty"`
	ToneConfig               string                  `json:"toneConfig,omitempty"`
	ModelTier                string                  `json:"modelTier,omitempty"`
	HistoricalChats          []store.HistoricalChat  `json:"historicalChats,omitempty"`
}

// GetKnowledge retorna la configuración completa del agente.
func (s *WhatsAppService) GetKnowledge(ctx context.Context, orgID string) (*KnowledgeResult, error) {
	cfg, err := s.repo.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}
	return &KnowledgeResult{
		KnowledgeBase:            cfg.KnowledgeBase,
		WelcomeMessage:           cfg.WelcomeMessage,
		AssistantInstructions:    cfg.AssistantInstructions,
		CustomIdentity:           cfg.CustomIdentity,
		Considerations:           cfg.Considerations,
		HandoffMode:              cfg.HandoffMode,
		OwnerNotificationChannel: cfg.OwnerNotificationChannel,
		ToneConfig:               cfg.ToneConfig,
		ModelTier:                cfg.ModelTier,
		HistoricalChats:          cfg.HistoricalChats,
	}, nil
}

// SaveKnowledge persiste la configuración completa del agente.
func (s *WhatsAppService) SaveKnowledge(ctx context.Context, orgID string, req KnowledgeSaveRequest) error {
	cfg, err := s.repo.Get(ctx, orgID)
	if err != nil {
		return err
	}
	cfg.KnowledgeBase = strings.TrimSpace(req.KnowledgeBase)
	cfg.WelcomeMessage = strings.TrimSpace(req.WelcomeMessage)
	cfg.AssistantInstructions = strings.TrimSpace(req.AssistantInstructions)
	cfg.CustomIdentity = strings.TrimSpace(req.CustomIdentity)
	cfg.Considerations = strings.TrimSpace(req.Considerations)
	cfg.HandoffMode = req.HandoffMode
	cfg.OwnerNotificationChannel = strings.TrimSpace(req.OwnerNotificationChannel)
	cfg.ToneConfig = strings.TrimSpace(req.ToneConfig)
	cfg.ModelTier = strings.TrimSpace(req.ModelTier)
	return s.repo.Save(ctx, cfg)
}
```

- [ ] **Step 6.5: Verify build**

```bash
cd backend && go build ./...
```

Expected: sin errores.

- [ ] **Step 6.6: Run all tests**

```bash
cd backend && go test ./...
```

Expected: todos pasan.

- [ ] **Step 6.7: Commit**

```bash
git add backend/internal/api/whatsapp_handler.go backend/internal/service/whatsapp_service.go
git commit -m "feat(api,service): add awaiting_human webhook check and extended knowledge API"
```

---

## Task 7: Variables de entorno en template.yaml

**Files:**

- Modify: `backend/template.yaml`

- [ ] **Step 7.1: Agregar las nuevas variables de entorno**

En `backend/template.yaml`, en el bloque `Globals > Function > Environment > Variables`, agregar **después** de `WHATSAPP_MODEL_ID`:

```yaml
WHATSAPP_HAIKU_MODEL_ID: "us.anthropic.claude-haiku-4-5-20251001-v1:0"
WHATSAPP_SONNET_MODEL_ID: "us.anthropic.claude-sonnet-4-6"
```

El resultado de esa sección debe quedar:

```yaml
WHATSAPP_MODEL_ID: "us.anthropic.claude-sonnet-4-6"
WHATSAPP_HAIKU_MODEL_ID: "us.anthropic.claude-haiku-4-5-20251001-v1:0"
WHATSAPP_SONNET_MODEL_ID: "us.anthropic.claude-sonnet-4-6"
WHATSAPP_QUEUE_URL: !Ref WhatsAppMessagesQueue
```

- [ ] **Step 7.2: Verify build final completo**

```bash
cd backend && go test ./... && go build ./...
```

Expected: todos los tests pasan, build exitoso.

- [ ] **Step 7.3: Commit**

```bash
git add backend/template.yaml
git commit -m "feat(infra): add WHATSAPP_HAIKU_MODEL_ID and WHATSAPP_SONNET_MODEL_ID env vars"
```

---

## Task 8: Skill /sync-asisten

**Files:**

- Create: `.claude/skills/sync-asisten.md`

- [ ] **Step 8.1: Crear el skill**

Create `.claude/skills/sync-asisten.md`:

````markdown
---
name: sync-asisten
description: Detecta diferencias entre el módulo asisten de alo-ai-engine y el agente WhatsApp de clinical, luego aplica los cambios necesarios.
trigger: /sync-asisten
---

# Skill: sync-asisten

Uso: `/sync-asisten`

Compara el engine del agente "asisten" en `../alo-ai-engine` con la implementación equivalente en `clinical`, reporta diferencias por severidad y aplica los cambios aprobados.

## Archivos fuente a leer (alo-ai-engine)

- `../alo-ai-engine/backend/src/shared/PromptEngine.ts` — bloques del prompt
- `../alo-ai-engine/backend/src/shared/IAClient.ts` — parámetros Bedrock + caching
- `../alo-ai-engine/backend/src/types/index.ts` — AssistantConfig interface
- `../alo-ai-engine/backend/src/functions/aiWorker.ts` — señales ANSWER/HANDOFF, handoff logic
- `../alo-ai-engine/backend/src/shared/ModelRouter.ts` — model tiers

## Archivos equivalentes en clinical

- `backend/internal/service/whatsapp_ai_service.go` — prompt engine + model routing
- `backend/internal/bedrock/client.go` — parámetros Bedrock + caching
- `backend/internal/store/whatsapp.go` — tipos de config
- `backend/internal/api/whatsapp_handler.go` — señales ANSWER/HANDOFF, handoff logic

## Proceso

### 1. Leer y comparar en 5 dimensiones

**A. Bloques del prompt**
Comparar `assembleAssistantPrompt()` en PromptEngine.ts vs `buildWhatsAppSystemPrompt()` en whatsapp_ai_service.go:

- ¿Existen los mismos bloques?
- ¿El contenido/lógica de cada bloque es equivalente?
- ¿Hay bloques nuevos en alo-ai-engine que falten en clinical?

**B. Parámetros Bedrock**
Comparar `IAClient.ts` vs `bedrock/client.go`:

- Temperatura (alo-ai-engine usa 0.4)
- MaxTokens (ambos usan 1024)
- Prompt caching activado/no

**C. Schema de config**
Comparar `AssistantConfig` en types/index.ts vs `WhatsAppConfig` en store/whatsapp.go:

- Campos nuevos en alo-ai-engine que falten en clinical
- Campos eliminados
- Tipos cambiados

**D. Señales de respuesta**
Comparar parseAssistantSignal/aiWorker.ts vs parseAssistantSignal en whatsapp_handler.go:

- ¿Hay nuevas señales además de [ANSWER] y [HANDOFF]?
- ¿La lógica de handoff es equivalente?

**E. Model routing**
Comparar ModelRouter.ts vs resolveModelID() en whatsapp_ai_service.go:

- ¿Hay nuevos tiers?
- ¿Los model IDs por defecto cambiaron?
- ¿Las variables de entorno cambiaron de nombre?

### 2. Reportar diff por severidad

Después de leer ambos proyectos, presentar el reporte en este formato:

```
## Sync Report: alo-ai-engine → clinical

### 🔴 Breaking (comportamiento diferente — debe aplicarse)
- [descripción específica con archivo + línea de referencia]

### 🟡 Enhancement (feature en asisten pero faltante en clinical)
- [descripción específica]

### 🟢 Cosmético (nombres, orden — opcional)
- [descripción específica]

### ✅ En paridad
- [lista de dimensiones ya sincronizadas]
```

### 3. Aplicar cambios

Con aprobación del usuario, aplicar los cambios en orden:

1. 🔴 primero (breaking)
2. 🟡 después (enhancements)
3. 🟢 solo si el usuario lo pide explícitamente

Para cada cambio:

- Editar el archivo Go correspondiente
- Ejecutar `cd backend && go test ./... && go build ./...` para verificar
- Commit con mensaje descriptivo

## Notas importantes

- alo-ai-engine está en TypeScript; clinical está en Go. Traducir conceptos, no copiar código literal.
- Los nombres de campos en TypeScript usan camelCase; en Go usan PascalCase para campos exportados.
- El prompt caching de alo-ai-engine usa `ConverseCommand` de AWS SDK v3; clinical usa `InvokeModel` de SDK v2. La lógica es equivalente pero las APIs son diferentes.
- Si alo-ai-engine agrega un nuevo tipo de negocio o módulo que no aplica a clinical (ej: módulo "sales"), ignorarlo.
````

- [ ] **Step 8.2: Verify el skill existe**

```bash
cat /Users/manuelserrano/Trabajo/Personal/clinical/.claude/skills/sync-asisten.md | head -10
```

Expected: muestra las primeras líneas del skill.

- [ ] **Step 8.3: Commit**

```bash
git add .claude/skills/sync-asisten.md
git commit -m "feat(skills): add sync-asisten skill for detecting and applying alo-ai-engine changes"
```

---

## Verificación final

- [ ] **Correr suite completa de tests**

```bash
cd backend && go test ./... -v 2>&1 | tail -30
```

Expected: todos los tests pasan.

- [ ] **Build final**

```bash
cd backend && GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -o bootstrap ./cmd/api && echo "BUILD OK"
```

Expected: `BUILD OK` — binary generado correctamente para Lambda ARM64.

- [ ] **Verificar que el skill es ejecutable**

Correr `/sync-asisten` en Claude Code para confirmar que se carga correctamente (no requiere cambios reales en alo-ai-engine).

---

## Resumen de archivos modificados

| Archivo                                           | Cambios                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `backend/internal/store/whatsapp.go`              | +HistoricalChat, +HandoffMode, +7 campos en WhatsAppConfig, +3 métodos en interface          |
| `backend/internal/store/dynamodb_whatsapp.go`     | +MarkAwaitingHuman, +IsAwaitingHuman, +ClearAwaitingHuman                                    |
| `backend/internal/bedrock/client.go`              | +SystemBlock, +CacheControl, +InvokeOptions, +InvokeWithOptions, +resolveModelID             |
| `backend/internal/service/whatsapp_ai_service.go` | Refactor completo: 8 bloques, model routing, GenerateResponse con cfg                        |
| `backend/internal/service/whatsapp_service.go`    | +KnowledgeSaveRequest, extender KnowledgeResult, actualizar SaveKnowledge/GetKnowledge       |
| `backend/internal/api/whatsapp_handler.go`        | +parseAssistantSignal, handoff en SQS, AWAITING_HUMAN en webhook, nuevos campos en admin API |
| `backend/template.yaml`                           | +WHATSAPP_HAIKU_MODEL_ID, +WHATSAPP_SONNET_MODEL_ID                                          |
| `.claude/skills/sync-asisten.md`                  | Skill nuevo                                                                                  |

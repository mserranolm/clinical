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

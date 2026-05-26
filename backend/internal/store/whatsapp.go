package store

import "context"

// WhatsAppConfig almacena la configuración de WhatsApp por organización.
type WhatsAppConfig struct {
	OrgID                 string   `dynamodbav:"PK"`
	SK                    string   `dynamodbav:"SK"`
	Connected             bool     `dynamodbav:"connected"`
	InstanceName          string   `dynamodbav:"instanceName"`
	KnowledgeBase         string   `dynamodbav:"knowledgeBase"`
	WelcomeMessage        string   `dynamodbav:"welcomeMessage"`
	AssistantInstructions string   `dynamodbav:"assistantInstructions"`
	BotDisabled           bool     `dynamodbav:"botDisabled"` // false = activo (default seguro para registros existentes)
	BotMode               string   `dynamodbav:"botMode"`
	BetaTestPhones        []string `dynamodbav:"betaTestPhones"`
	UpdatedAt             string   `dynamodbav:"updatedAt"`
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
}

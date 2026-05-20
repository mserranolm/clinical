package store

import "context"

// WhatsAppConfig almacena la configuración de WhatsApp por organización.
type WhatsAppConfig struct {
	OrgID          string `dynamodbav:"PK"`
	SK             string `dynamodbav:"SK"`
	Connected      bool   `dynamodbav:"connected"`
	InstanceName   string `dynamodbav:"instanceName"`
	KnowledgeBase         string `dynamodbav:"knowledgeBase"`
	WelcomeMessage        string `dynamodbav:"welcomeMessage"`
	AssistantInstructions string `dynamodbav:"assistantInstructions"`
	UpdatedAt      string `dynamodbav:"updatedAt"`
}

// WhatsAppRepository define operaciones CRUD para la configuración de WhatsApp.
type WhatsAppRepository interface {
	Get(ctx context.Context, orgID string) (*WhatsAppConfig, error)
	Save(ctx context.Context, cfg *WhatsAppConfig) error
	SetConnected(ctx context.Context, orgID string, connected bool) error
}

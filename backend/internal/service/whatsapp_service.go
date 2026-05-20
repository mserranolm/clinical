package service

import (
	"context"
	"fmt"
	"strings"

	"clinical-backend/internal/store"
	"clinical-backend/internal/whatsapp"
)

// WhatsAppService gestiona la conexión y configuración de WhatsApp por organización.
type WhatsAppService struct {
	evolution      *whatsapp.Client
	repo           store.WhatsAppRepository
	webhookBaseURL string
}

// NewWhatsAppService crea un nuevo WhatsAppService.
func NewWhatsAppService(evolution *whatsapp.Client, repo store.WhatsAppRepository, webhookBaseURL string) *WhatsAppService {
	return &WhatsAppService{evolution: evolution, repo: repo, webhookBaseURL: webhookBaseURL}
}

// instanceName genera el nombre de instancia Evolution para una org.
func instanceName(orgID string) string {
	return "clinical-" + orgID
}

// ConnectResult es el resultado de iniciar una conexión.
type ConnectResult struct {
	QRCode    string `json:"qrCode"`
	Stage     string `json:"stage"`
	Connected bool   `json:"connected"`
}

// Connect inicia la conexión WhatsApp para una organización.
func (s *WhatsAppService) Connect(ctx context.Context, orgID string) (*ConnectResult, error) {
	instName := instanceName(orgID)
	webhookURL := s.webhookBaseURL + "/public/whatsapp/webhook"

	if !s.evolution.InstanceExists(instName) {
		if err := s.evolution.CreateInstance(instName, webhookURL); err != nil {
			return nil, fmt.Errorf("whatsapp connect: create instance: %w", err)
		}
	}

	state, err := s.evolution.GetConnectionState(instName)
	if err == nil && state == whatsapp.StateOpen {
		return &ConnectResult{Stage: "already_connected", Connected: true}, nil
	}

	qr, err := s.evolution.GetQRCode(instName)
	if err != nil {
		return nil, fmt.Errorf("whatsapp connect: get qr: %w", err)
	}

	cfg, _ := s.repo.Get(ctx, orgID)
	if cfg == nil {
		cfg = &store.WhatsAppConfig{OrgID: orgID}
	}
	cfg.InstanceName = instName
	cfg.Connected = false
	if err := s.repo.Save(ctx, cfg); err != nil {
		return nil, fmt.Errorf("whatsapp connect: save config: %w", err)
	}

	return &ConnectResult{QRCode: qr, Stage: "qr_ready", Connected: false}, nil
}

// StatusResult es el resultado de consultar el estado.
type StatusResult struct {
	Connected    bool   `json:"connected"`
	Stage        string `json:"stage"`
	InstanceName string `json:"instanceName"`
}

// GetStatus retorna el estado actual de la conexión WhatsApp.
func (s *WhatsAppService) GetStatus(ctx context.Context, orgID string) (*StatusResult, error) {
	cfg, err := s.repo.Get(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("whatsapp status: get config: %w", err)
	}
	if cfg.InstanceName == "" {
		return &StatusResult{Connected: false, Stage: "idle"}, nil
	}

	state, err := s.evolution.GetConnectionState(cfg.InstanceName)
	if err != nil {
		return &StatusResult{Connected: false, Stage: "error"}, nil
	}

	connected := state == whatsapp.StateOpen
	stage := "disconnected"
	if connected {
		stage = "connected"
	}

	if connected != cfg.Connected {
		_ = s.repo.SetConnected(ctx, orgID, connected)
	}

	return &StatusResult{Connected: connected, Stage: stage, InstanceName: cfg.InstanceName}, nil
}

// Disconnect desconecta y elimina la instancia WhatsApp.
func (s *WhatsAppService) Disconnect(ctx context.Context, orgID string) error {
	cfg, err := s.repo.Get(ctx, orgID)
	if err != nil {
		return fmt.Errorf("whatsapp disconnect: %w", err)
	}
	if cfg.InstanceName != "" {
		if err := s.evolution.DeleteInstance(cfg.InstanceName); err != nil {
			return fmt.Errorf("whatsapp disconnect: delete instance: %w", err)
		}
	}
	return s.repo.SetConnected(ctx, orgID, false)
}

// KnowledgeResult es la Base de Conocimiento configurada.
type KnowledgeResult struct {
	KnowledgeBase         string `json:"knowledgeBase"`
	WelcomeMessage        string `json:"welcomeMessage"`
	AssistantInstructions string `json:"assistantInstructions"`
}

// GetKnowledge retorna la Base de Conocimiento.
func (s *WhatsAppService) GetKnowledge(ctx context.Context, orgID string) (*KnowledgeResult, error) {
	cfg, err := s.repo.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}
	return &KnowledgeResult{
		KnowledgeBase:         cfg.KnowledgeBase,
		WelcomeMessage:        cfg.WelcomeMessage,
		AssistantInstructions: cfg.AssistantInstructions,
	}, nil
}

// SaveKnowledge persiste la Base de Conocimiento.
func (s *WhatsAppService) SaveKnowledge(ctx context.Context, orgID, knowledgeBase, welcomeMessage, assistantInstructions string) error {
	cfg, err := s.repo.Get(ctx, orgID)
	if err != nil {
		return err
	}
	cfg.KnowledgeBase = strings.TrimSpace(knowledgeBase)
	cfg.WelcomeMessage = strings.TrimSpace(welcomeMessage)
	cfg.AssistantInstructions = strings.TrimSpace(assistantInstructions)
	return s.repo.Save(ctx, cfg)
}

// SendTextToPatient envía texto de respuesta al número de WhatsApp del paciente.
func (s *WhatsAppService) SendTextToPatient(_ context.Context, instanceName, phone, text string) error {
	return s.evolution.SendText(instanceName, phone, text)
}

// OrgIDFromInstance extrae el orgID del nombre de instancia (formato: clinical-{orgId}).
func OrgIDFromInstance(instName string) string {
	return strings.TrimPrefix(instName, "clinical-")
}

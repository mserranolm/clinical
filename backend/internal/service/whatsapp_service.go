package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
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
	Connected      bool     `json:"connected"`
	Stage          string   `json:"stage"`
	InstanceName   string   `json:"instanceName"`
	BotEnabled     bool     `json:"botEnabled"`
	BotMode        string   `json:"botMode"`
	BetaTestPhones []string `json:"betaTestPhones"`
	PhoneNumber    string   `json:"phoneNumber"`
}

// GetStatus retorna el estado actual de la conexión WhatsApp.
func (s *WhatsAppService) GetStatus(ctx context.Context, orgID string) (*StatusResult, error) {
	cfg, err := s.repo.Get(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("whatsapp status: get config: %w", err)
	}
	if cfg.InstanceName == "" {
		return &StatusResult{Connected: false, Stage: "idle", BotEnabled: !cfg.BotDisabled, BotMode: cfg.BotMode, BetaTestPhones: cfg.BetaTestPhones}, nil
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

	phone := ""
	if connected {
		phone = s.evolution.GetOwnerPhone(cfg.InstanceName)
	}

	return &StatusResult{Connected: connected, Stage: stage, InstanceName: cfg.InstanceName, BotEnabled: !cfg.BotDisabled, BotMode: cfg.BotMode, BetaTestPhones: cfg.BetaTestPhones, PhoneNumber: phone}, nil
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
	KnowledgeBase            string                 `json:"knowledgeBase"`
	WelcomeMessage           string                 `json:"welcomeMessage"`
	AssistantInstructions    string                 `json:"assistantInstructions"`
	CustomIdentity           string                 `json:"customIdentity,omitempty"`
	Considerations           string                 `json:"considerations,omitempty"`
	HandoffMode              store.HandoffMode      `json:"handoffMode,omitempty"`
	OwnerNotificationChannel string                 `json:"ownerNotificationChannel,omitempty"`
	ToneConfig               string                 `json:"toneConfig,omitempty"`
	ModelTier                string                 `json:"modelTier,omitempty"`
	HistoricalChats          []store.HistoricalChat `json:"historicalChats,omitempty"`
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

// SendTextToPatient envía texto de respuesta al número de WhatsApp del paciente.
func (s *WhatsAppService) SendTextToPatient(_ context.Context, instanceName, phone, text string) error {
	return s.evolution.SendText(instanceName, phone, text)
}

// DownloadMedia descarga el binario de un mensaje de media (imagen, audio, video, documento).
// rawData es el payload.Data completo que llega del webhook de Evolution API.
// Retorna los bytes del archivo, el mimetype y un error si falla.
func (s *WhatsAppService) DownloadMedia(ctx context.Context, instanceName string, rawData json.RawMessage) ([]byte, string, error) {
	b64, mime, err := s.evolution.GetMediaBase64(ctx, instanceName, rawData)
	if err != nil {
		return nil, "", fmt.Errorf("evolution media download: %w", err)
	}
	// Evolution puede devolver "data:image/jpeg;base64,..." o solo el base64 puro
	if idx := strings.Index(b64, ","); idx >= 0 {
		b64 = b64[idx+1:]
	}
	decoded, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		// intentar con RawStdEncoding (sin padding)
		decoded, err = base64.RawStdEncoding.DecodeString(b64)
		if err != nil {
			return nil, "", fmt.Errorf("base64 decode: %w", err)
		}
	}
	return decoded, mime, nil
}

// OrgIDFromInstance extrae el orgID del nombre de instancia (formato: clinical-{orgId}).
func OrgIDFromInstance(instName string) string {
	return strings.TrimPrefix(instName, "clinical-")
}

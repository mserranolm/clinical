package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"

	"clinical-backend/internal/service"
	"clinical-backend/internal/store"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
)

var nonDigitRegex = regexp.MustCompile(`\D`)

type whatsAppSQSMessage struct {
	OrgID        string `json:"orgId"`
	Phone        string `json:"phone"`
	Message      string `json:"message"`
	InstanceName string `json:"instanceName"`
}

type evolutionWebhookPayload struct {
	Event    string          `json:"event"`
	Instance string          `json:"instance"`
	Data     json.RawMessage `json:"data"`
}

type evolutionConnectionData struct {
	State string `json:"state"`
}

type evolutionMediaMsg struct {
	Caption string `json:"caption"`
}

type evolutionMessageData struct {
	Key struct {
		RemoteJID string `json:"remoteJid"`
		FromMe    bool   `json:"fromMe"`
		ID        string `json:"id"`
	} `json:"key"`
	Message struct {
		Conversation        string             `json:"conversation"`
		ExtendedTextMessage *struct {
			Text string `json:"text"`
		} `json:"extendedTextMessage"`
		ImageMessage    *evolutionMediaMsg `json:"imageMessage"`
		VideoMessage    *evolutionMediaMsg `json:"videoMessage"`
		AudioMessage    *json.RawMessage   `json:"audioMessage"`
		DocumentMessage *evolutionMediaMsg `json:"documentMessage"`
		StickerMessage  *json.RawMessage   `json:"stickerMessage"`
	} `json:"message"`
	MessageTimestamp int64 `json:"messageTimestamp"`
}

// extractText devuelve el texto efectivo de cualquier tipo de mensaje WhatsApp.
// Para imágenes/video sin caption devuelve un placeholder que el AI puede manejar.
func extractText(data evolutionMessageData) string {
	if t := strings.TrimSpace(data.Message.Conversation); t != "" {
		return t
	}
	if data.Message.ExtendedTextMessage != nil {
		if t := strings.TrimSpace(data.Message.ExtendedTextMessage.Text); t != "" {
			return t
		}
	}
	if data.Message.ImageMessage != nil {
		if c := strings.TrimSpace(data.Message.ImageMessage.Caption); c != "" {
			return c
		}
		return "[imagen]"
	}
	if data.Message.VideoMessage != nil {
		if c := strings.TrimSpace(data.Message.VideoMessage.Caption); c != "" {
			return c
		}
		return "[video]"
	}
	if data.Message.AudioMessage != nil {
		return "[nota de voz]"
	}
	if data.Message.DocumentMessage != nil {
		if c := strings.TrimSpace(data.Message.DocumentMessage.Caption); c != "" {
			return "[documento] " + c
		}
		return "[documento]"
	}
	return ""
}

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

func (r *Router) handleWhatsAppConnect(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	auth := ctx.Value(ctxAuthKey).(service.Authenticated)
	result, err := r.whatsApp.Connect(ctx, auth.User.OrgID)
	if err != nil {
		log.Printf("whatsapp connect error org=%s: %v", auth.User.OrgID, err)
		return response(503, map[string]string{"error": "whatsapp_connect_failed", "detail": err.Error()})
	}
	return response(200, result)
}

func (r *Router) handleWhatsAppStatus(ctx context.Context, _ events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	auth := ctx.Value(ctxAuthKey).(service.Authenticated)
	status, err := r.whatsApp.GetStatus(ctx, auth.User.OrgID)
	if err != nil {
		return response(500, map[string]string{"error": err.Error()})
	}
	return response(200, status)
}

func (r *Router) handleWhatsAppDisconnect(ctx context.Context, _ events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	auth := ctx.Value(ctxAuthKey).(service.Authenticated)
	if err := r.whatsApp.Disconnect(ctx, auth.User.OrgID); err != nil {
		return response(500, map[string]string{"error": err.Error()})
	}
	return response(200, map[string]string{"status": "disconnected"})
}

func (r *Router) handleWhatsAppGetKnowledge(ctx context.Context, _ events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	auth := ctx.Value(ctxAuthKey).(service.Authenticated)
	knowledge, err := r.whatsApp.GetKnowledge(ctx, auth.User.OrgID)
	if err != nil {
		return response(500, map[string]string{"error": err.Error()})
	}
	return response(200, knowledge)
}

func (r *Router) handleWhatsAppSaveKnowledge(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	auth := ctx.Value(ctxAuthKey).(service.Authenticated)
	var body struct {
		KnowledgeBase         string `json:"knowledgeBase"`
		WelcomeMessage        string `json:"welcomeMessage"`
		AssistantInstructions string `json:"assistantInstructions"`
	}
	if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	if err := r.whatsApp.SaveKnowledge(ctx, auth.User.OrgID, body.KnowledgeBase, body.WelcomeMessage, body.AssistantInstructions); err != nil {
		return response(500, map[string]string{"error": err.Error()})
	}
	return response(200, map[string]string{"status": "saved"})
}

func (r *Router) handleWhatsAppWebhook(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	apiKey := req.Headers["apikey"]
	if apiKey == "" {
		apiKey = req.Headers["Apikey"]
	}
	if r.whatsAppWebhookSecret != "" && apiKey != r.whatsAppWebhookSecret {
		log.Printf("whatsapp webhook: invalid apikey")
		return response(401, map[string]string{"error": "unauthorized"})
	}

	var payload evolutionWebhookPayload
	if err := json.Unmarshal([]byte(req.Body), &payload); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}

	orgID := service.OrgIDFromInstance(payload.Instance)
	log.Printf("whatsapp webhook: event=%s instance=%s orgId=%s", payload.Event, payload.Instance, orgID)

	switch payload.Event {
	case "connection.update":
		var data evolutionConnectionData
		if err := json.Unmarshal(payload.Data, &data); err == nil && r.whatsAppRepo != nil {
			_ = r.whatsAppRepo.SetConnected(ctx, orgID, data.State == "open")
		}

	case "messages.upsert":
		var data evolutionMessageData
		if err := json.Unmarshal(payload.Data, &data); err != nil {
			return response(200, map[string]string{"status": "ignored_parse_error"})
		}

		text := extractText(data)
		if data.Key.FromMe || text == "" {
			return response(200, map[string]string{"status": "ignored"})
		}
		phone := strings.Split(data.Key.RemoteJID, "@")[0]

		// Filtros de bot: desactivado o modo beta
		if r.whatsAppRepo != nil {
			cfg, cfgErr := r.whatsAppRepo.Get(ctx, orgID)
			if cfgErr == nil {
				// Si el bot está apagado, no procesar
				if cfg.BotDisabled {
					log.Printf("MSG_SKIP_BOT_DISABLED orgId=%s", orgID)
					return response(200, map[string]string{"status": "bot_disabled"})
				}
				// Filtro beta: solo responder si botMode == "production" o el número está en la lista
				if cfg.BotMode != "" && cfg.BotMode != "production" {
					betaPhones := cfg.BetaTestPhones
					if len(betaPhones) == 0 {
						log.Printf("MSG_SKIP_BETA: no phones configured, orgId=%s", orgID)
						return response(200, map[string]string{"status": "skipped_beta"})
					}
					normalizedCustomer := nonDigitRegex.ReplaceAllString(phone, "")
					allowed := false
					for _, bp := range betaPhones {
						normalizedBeta := nonDigitRegex.ReplaceAllString(bp, "")
						if len(normalizedBeta) > 10 {
							normalizedBeta = normalizedBeta[len(normalizedBeta)-10:]
						}
						if len(normalizedCustomer) >= 10 && strings.HasSuffix(normalizedCustomer, normalizedBeta) {
							allowed = true
							break
						} else if normalizedCustomer == normalizedBeta {
							allowed = true
							break
						}
					}
					if !allowed {
						log.Printf("MSG_SKIP_BETA: phone not in list, orgId=%s phone=%s", orgID, phone)
						return response(200, map[string]string{"status": "skipped_beta"})
					}
				}
			}
		}

		if r.sqsClient != nil && r.whatsAppQueueURL != "" {
			sqsMsg := whatsAppSQSMessage{
				OrgID:        orgID,
				Phone:        phone,
				Message:      text,
				InstanceName: payload.Instance,
			}
			sqsBody, _ := json.Marshal(sqsMsg)
			if _, err := r.sqsClient.SendMessage(ctx, &sqs.SendMessageInput{
				QueueUrl:    aws.String(r.whatsAppQueueURL),
				MessageBody: aws.String(string(sqsBody)),
			}); err != nil {
				log.Printf("whatsapp webhook: sqs send error: %v", err)
			}
		}
	}

	return response(200, map[string]string{"status": "ok"})
}

func (r *Router) handleWhatsAppSetBotMode(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	auth := ctx.Value(ctxAuthKey).(service.Authenticated)
	var body struct {
		Enabled        bool     `json:"enabled"`
		Mode           string   `json:"mode"`
		BetaTestPhones []string `json:"betaTestPhones"`
	}
	if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}

	// Normalizar modo
	if body.Mode != "production" {
		body.Mode = "beta"
	}

	// Validar teléfonos — regex: 7-15 dígitos, + opcional
	phoneRegex := regexp.MustCompile(`^\+?\d{7,15}$`)
	var validPhones []string
	for _, p := range body.BetaTestPhones {
		cleaned := strings.ReplaceAll(p, " ", "")
		if phoneRegex.MatchString(cleaned) {
			validPhones = append(validPhones, cleaned)
		}
	}
	if len(validPhones) > 10 {
		validPhones = validPhones[:10]
	}

	// Modo beta requiere al menos un teléfono (solo si el bot está activo)
	if body.Enabled && body.Mode == "beta" && len(validPhones) == 0 {
		return response(400, map[string]string{"error": "beta_mode_requires_phones"})
	}

	if err := r.whatsAppRepo.SetBotMode(ctx, auth.User.OrgID, body.Enabled, body.Mode, validPhones); err != nil {
		return response(500, map[string]string{"error": err.Error()})
	}
	return response(200, map[string]interface{}{
		"botEnabled":     body.Enabled,
		"botMode":        body.Mode,
		"betaTestPhones": validPhones,
	})
}

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
		return nil

	default: // "answer"
		if saveErr := repo.SaveConversationTurn(ctx, msg.OrgID, msg.Phone, "assistant", cleanReply); saveErr != nil {
			log.Printf("whatsapp worker: save assistant turn: %v", saveErr)
		}
		return whatsAppSvc.SendTextToPatient(ctx, msg.InstanceName, msg.Phone, cleanReply)
	}
}

package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"clinical-backend/internal/service"
	"clinical-backend/internal/store"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
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

type evolutionMessageData struct {
	Key struct {
		RemoteJID string `json:"remoteJid"`
		FromMe    bool   `json:"fromMe"`
		ID        string `json:"id"`
	} `json:"key"`
	Message struct {
		Conversation string `json:"conversation"`
	} `json:"message"`
	MessageTimestamp int64 `json:"messageTimestamp"`
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

		// Auditoría: guardar TODOS los mensajes entrantes en S3 antes de cualquier filtro
		if !data.Key.FromMe {
			ts := data.MessageTimestamp
			if ts == 0 {
				ts = time.Now().Unix()
			}
			go r.auditWhatsAppMessage(ctx, payload.Instance, data.Key.RemoteJID, data.Key.ID, ts, payload.Data)
		}

		if data.Key.FromMe || strings.TrimSpace(data.Message.Conversation) == "" {
			return response(200, map[string]string{"status": "ignored"})
		}
		phone := strings.Split(data.Key.RemoteJID, "@")[0]

		// Filtro beta: solo responder si botMode == "production" o el número está en la lista
		if r.whatsAppRepo != nil {
			cfg, cfgErr := r.whatsAppRepo.Get(ctx, orgID)
			if cfgErr == nil && cfg.BotMode != "" && cfg.BotMode != "production" {
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

		if r.sqsClient != nil && r.whatsAppQueueURL != "" {
			sqsMsg := whatsAppSQSMessage{
				OrgID:        orgID,
				Phone:        phone,
				Message:      data.Message.Conversation,
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

	// Modo beta requiere al menos un teléfono
	if body.Mode == "beta" && len(validPhones) == 0 {
		return response(400, map[string]string{"error": "beta_mode_requires_phones"})
	}

	if err := r.whatsAppRepo.SetBotMode(ctx, auth.User.OrgID, body.Mode, validPhones); err != nil {
		return response(500, map[string]string{"error": err.Error()})
	}
	return response(200, map[string]interface{}{
		"botMode":        body.Mode,
		"betaTestPhones": validPhones,
	})
}

// auditWhatsAppMessage guarda el payload completo del mensaje en S3 para auditoría.
func (r *Router) auditWhatsAppMessage(ctx context.Context, instanceName, remoteJid, msgID string, ts int64, rawData json.RawMessage) {
	if r.auditS3Client == nil || r.auditBucket == "" {
		return
	}
	date := time.Unix(ts, 0).UTC().Format("2006-01-02")
	key := fmt.Sprintf("whatsapp/%s/%s/%s/%d_%s.json", instanceName, date, remoteJid, ts, msgID)

	envelope := map[string]interface{}{
		"instanceName": instanceName,
		"remoteJid":    remoteJid,
		"messageId":    msgID,
		"timestamp":    ts,
		"auditedAt":    time.Now().UTC().Format(time.RFC3339),
		"data":         json.RawMessage(rawData),
	}
	payload, _ := json.Marshal(envelope)

	_, err := r.auditS3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(r.auditBucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(payload),
		ContentType: aws.String("application/json"),
	})
	if err != nil {
		log.Printf("audit: s3 put failed key=%s: %v", key, err)
	} else {
		log.Printf("audit: saved key=%s", key)
	}
}

// ProcessWhatsAppSQSRecord procesa un mensaje SQS del worker de WhatsApp.
func ProcessWhatsAppSQSRecord(ctx context.Context, body string, whatsAppSvc *service.WhatsAppService, aiSvc *service.WhatsAppAIService, repo store.WhatsAppRepository) error {
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

	aiResponse, err := aiSvc.GenerateResponse(ctx, "la clínica", cfg.KnowledgeBase, cfg.AssistantInstructions, msg.Message)
	if err != nil {
		return err
	}

	return whatsAppSvc.SendTextToPatient(ctx, msg.InstanceName, msg.Phone, aiResponse)
}

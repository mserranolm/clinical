package api

import (
	"context"
	"encoding/json"
	"log"
	"strings"

	"clinical-backend/internal/service"
	"clinical-backend/internal/store"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
)

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
	} `json:"key"`
	Message struct {
		Conversation string `json:"conversation"`
	} `json:"message"`
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
		KnowledgeBase  string `json:"knowledgeBase"`
		WelcomeMessage string `json:"welcomeMessage"`
	}
	if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	if err := r.whatsApp.SaveKnowledge(ctx, auth.User.OrgID, body.KnowledgeBase, body.WelcomeMessage); err != nil {
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
		if data.Key.FromMe || strings.TrimSpace(data.Message.Conversation) == "" {
			return response(200, map[string]string{"status": "ignored"})
		}
		phone := strings.Split(data.Key.RemoteJID, "@")[0]

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

	aiResponse, err := aiSvc.GenerateResponse(ctx, "la clínica", cfg.KnowledgeBase, msg.Message)
	if err != nil {
		return err
	}

	return whatsAppSvc.SendTextToPatient(ctx, msg.InstanceName, msg.Phone, aiResponse)
}

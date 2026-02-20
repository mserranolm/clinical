package notifications

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"clinical-backend/internal/config"
	"clinical-backend/internal/store"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	ddbtypes "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	sestypes "github.com/aws/aws-sdk-go-v2/service/sesv2/types"
)

type Notifier interface {
	SendAppointmentReminder(ctx context.Context, patientID, channel, message string) error
	SendConsentRequest(ctx context.Context, patientID, channel, message string) error
	SendDoctorDailySummary(ctx context.Context, doctorID, channel, message string) error
	SendInvitation(ctx context.Context, toEmail, inviteURL, role, tempPassword string) error
}

type Router struct {
	sendSMS   bool
	sendEmail bool
	cfg       config.Config
	ddb       *dynamodb.Client
	ses       *sesv2.Client
}

func NewRouter(cfg config.Config) *Router {
	awsCfg, err := awsconfig.LoadDefaultConfig(context.Background())
	if err != nil {
		log.Printf("[notify] warn: failed to load aws cfg: %v", err)
	}
	r := &Router{sendSMS: cfg.SendSMS, sendEmail: cfg.SendEmail, cfg: cfg}
	if err == nil {
		r.ddb = dynamodb.NewFromConfig(awsCfg)
		r.ses = sesv2.NewFromConfig(awsCfg)
	}
	return r
}

func (r *Router) SendAppointmentReminder(ctx context.Context, patientID, channel, message string) error {
	if !r.allowed(channel) {
		return fmt.Errorf("channel %s disabled", channel)
	}
	if channel == "email" && r.sendEmail && r.ses != nil {
		to := patientID
		if !strings.Contains(to, "@") && r.ddb != nil {
			orgID := store.OrgIDFromContext(ctx)
			if strings.TrimSpace(orgID) == "" {
				return fmt.Errorf("missing orgId")
			}
			key := map[string]ddbtypes.AttributeValue{
				"PK": &ddbtypes.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
				"SK": &ddbtypes.AttributeValueMemberS{Value: fmt.Sprintf("PATIENT#%s", patientID)},
			}
			out, err := r.ddb.GetItem(ctx, &dynamodb.GetItemInput{
				TableName: aws.String(r.cfg.PatientTable),
				Key:       key,
			})
			if err == nil && out.Item != nil {
				var row struct{ Email string }
				if uerr := attributevalue.UnmarshalMap(out.Item, &row); uerr == nil && row.Email != "" {
					to = row.Email
				}
			}
		}
		sender := os.Getenv("SES_SENDER_EMAIL")
		if sender == "" {
			sender = "no-reply@clinisense.aski-tech.net"
		}
		subject := "Confirmación de cita"
		_, err := r.ses.SendEmail(ctx, &sesv2.SendEmailInput{
			FromEmailAddress: aws.String(sender),
			Destination:      &sestypes.Destination{ToAddresses: []string{to}},
			Content: &sestypes.EmailContent{Simple: &sestypes.Message{
				Subject: &sestypes.Content{Data: aws.String(subject)},
				Body:    &sestypes.Body{Text: &sestypes.Content{Data: aws.String(message)}},
			}},
		})
		if err != nil {
			log.Printf("[notify:ses] send failed: %v", err)
			return err
		}
		log.Printf("[notify:ses] email sent to %s", to)
		return nil
	}
	log.Printf("[notify:appointment] patient=%s channel=%s message=%s", patientID, channel, message)
	return nil
}

func (r *Router) SendConsentRequest(_ context.Context, patientID, channel, message string) error {
	if !r.allowed(channel) {
		return fmt.Errorf("channel %s disabled", channel)
	}
	log.Printf("[notify:consent] patient=%s channel=%s message=%s", patientID, channel, message)
	return nil
}

func (r *Router) SendDoctorDailySummary(_ context.Context, doctorID, channel, message string) error {
	if !r.allowed(channel) {
		return fmt.Errorf("channel %s disabled", channel)
	}
	log.Printf("[notify:doctor-summary] doctor=%s channel=%s message=%s", doctorID, channel, message)
	return nil
}

func (r *Router) SendInvitation(ctx context.Context, toEmail, inviteURL, role, tempPassword string) error {
	roleLabel := map[string]string{
		"admin": "Administrador", "doctor": "Doctor",
		"assistant": "Asistente", "patient": "Paciente",
	}
	label := roleLabel[role]
	if label == "" {
		label = role
	}
	subject := fmt.Sprintf("Invitación a CliniSense — Acceso como %s", label)
	body := fmt.Sprintf(
		"Has sido invitado a unirte a CliniSense como %s.\n\n"+
			"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"+
			"Tu contraseña temporal es:\n\n"+
			"   %s\n\n"+
			"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"+
			"Haz clic en el siguiente enlace para activar tu cuenta y crear una nueva contraseña (válido 72 horas):\n\n"+
			"%s\n\n"+
			"IMPORTANTE: Al ingresar por primera vez deberás establecer una nueva contraseña.\n\n"+
			"Si no esperabas esta invitación, ignora este mensaje.",
		label, tempPassword, inviteURL,
	)
	log.Printf("[notify:invitation] to=%s role=%s url=%s", toEmail, role, inviteURL)
	if !r.sendEmail || r.ses == nil {
		return nil
	}
	sender := r.cfg.SESSenderEmail
	if sender == "" {
		sender = os.Getenv("SES_SENDER_EMAIL")
	}
	if sender == "" {
		sender = "no-reply@clinisense.aski-tech.net"
	}
	_, err := r.ses.SendEmail(ctx, &sesv2.SendEmailInput{
		FromEmailAddress: aws.String(sender),
		Destination:      &sestypes.Destination{ToAddresses: []string{toEmail}},
		Content: &sestypes.EmailContent{Simple: &sestypes.Message{
			Subject: &sestypes.Content{Data: aws.String(subject)},
			Body:    &sestypes.Body{Text: &sestypes.Content{Data: aws.String(body)}},
		}},
	})
	if err != nil {
		log.Printf("[notify:invitation] ses send failed: %v", err)
	}
	return err
}

func (r *Router) allowed(channel string) bool {
	switch channel {
	case "sms":
		return r.sendSMS
	case "email":
		return r.sendEmail
	default:
		return false
	}
}

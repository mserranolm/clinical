package notifications

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"clinical-backend/internal/config"
	"clinical-backend/internal/domain"
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
	SendConsentWithAppointment(ctx context.Context, toEmail, patientName string, consent domain.Consent, startAt time.Time) error
	SendDoctorDailySummary(ctx context.Context, doctorID, channel, message string) error
	SendInvitation(ctx context.Context, toEmail, inviteURL, role, tempPassword string) error
	SendWelcome(ctx context.Context, toEmail, name, role, password, loginURL string) error
	SendAppointmentEvent(ctx context.Context, toEmail, patientName, eventType string, startAt, endAt time.Time) error
	SendOrgCreated(ctx context.Context, toEmail, orgName, adminName string) error
	SendTreatmentPlanSummary(ctx context.Context, toEmail, patientName, treatmentPlan string, consultDate time.Time) error
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

func (r *Router) SendAppointmentEvent(ctx context.Context, toEmail, patientName, eventType string, startAt, endAt time.Time) error {
	titles := map[string]string{
		"created":   "Cita agendada",
		"moved":     "Cita reprogramada",
		"cancelled": "Cita cancelada",
		"confirmed": "Cita confirmada",
		"completed": "Consulta finalizada",
		"updated":   "Actualización de cita",
	}
	title := titles[eventType]
	if title == "" {
		title = "Actualización de cita"
	}
	subject := fmt.Sprintf("CliniSense — %s", title)
	var body string
	switch eventType {
	case "cancelled":
		body = fmt.Sprintf(
			"Hola %s,\n\nTu cita del %s de %s a %s ha sido CANCELADA.\n\nSi tienes dudas, contáctanos.",
			patientName,
			startAt.Format("02/01/2006"),
			startAt.Format("15:04"),
			endAt.Format("15:04"),
		)
	case "moved":
		body = fmt.Sprintf(
			"Hola %s,\n\nTu cita ha sido REPROGRAMADA para el %s de %s a %s.\n\nSi tienes dudas, contáctanos.",
			patientName,
			startAt.Format("02/01/2006"),
			startAt.Format("15:04"),
			endAt.Format("15:04"),
		)
	case "confirmed":
		body = fmt.Sprintf(
			"Hola %s,\n\nTu cita del %s de %s a %s ha sido CONFIRMADA.\n\nTe esperamos puntualmente. Si necesitas cancelar, contáctanos con anticipación.",
			patientName,
			startAt.Format("02/01/2006"),
			startAt.Format("15:04"),
			endAt.Format("15:04"),
		)
	case "completed":
		body = fmt.Sprintf(
			"Hola %s,\n\nTu consulta del %s ha sido registrada exitosamente.\n\nGracias por tu visita. Recuerda seguir las indicaciones de tu doctor y no olvides tu próxima cita.",
			patientName,
			startAt.Format("02/01/2006"),
		)
	default:
		body = fmt.Sprintf(
			"Hola %s,\n\nTu cita ha sido agendada para el %s de %s a %s.\n\nTe esperamos. Si necesitas cancelar o cambiar, contáctanos con anticipación.",
			patientName,
			startAt.Format("02/01/2006"),
			startAt.Format("15:04"),
			endAt.Format("15:04"),
		)
	}
	log.Printf("[notify:appointment] to=%s event=%s start=%s", toEmail, eventType, startAt)
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
		log.Printf("[notify:appointment] ses send failed: %v", err)
	}
	return err
}

func (r *Router) SendTreatmentPlanSummary(ctx context.Context, toEmail, patientName, treatmentPlan string, consultDate time.Time) error {
	subject := "CliniSense — Plan de tratamiento de tu consulta"
	body := fmt.Sprintf(
		"Hola %s,\n\nGracias por tu visita del %s.\n\nA continuación te compartimos el plan de tratamiento indicado por tu doctor:\n\n%s\n\nSi tienes alguna duda, no dudes en contactarnos.\n\nCliniSense",
		patientName,
		consultDate.Format("02/01/2006"),
		treatmentPlan,
	)
	log.Printf("[notify:treatment-plan] to=%s date=%s", toEmail, consultDate.Format("02/01/2006"))
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
		log.Printf("[notify:treatment-plan] ses send failed: %v", err)
	}
	return err
}

func (r *Router) SendOrgCreated(ctx context.Context, toEmail, orgName, adminName string) error {
	subject := fmt.Sprintf("CliniSense — Organización '%s' creada", orgName)
	body := fmt.Sprintf(
		"Hola %s,\n\nTu organización '%s' ha sido creada exitosamente en CliniSense.\n\nYa puedes comenzar a agregar doctores, asistentes y pacientes desde el panel de administración.\n\nBienvenido a CliniSense.",
		adminName, orgName,
	)
	log.Printf("[notify:org-created] to=%s org=%s", toEmail, orgName)
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
		log.Printf("[notify:org-created] ses send failed: %v", err)
	}
	return err
}

func (r *Router) SendWelcome(ctx context.Context, toEmail, name, role, password, loginURL string) error {
	roleLabel := map[string]string{
		"admin": "Administrador", "doctor": "Doctor",
		"assistant": "Asistente", "patient": "Paciente",
	}
	label := roleLabel[role]
	if label == "" {
		label = role
	}
	subject := fmt.Sprintf("Bienvenido a CliniSense — Tu cuenta como %s", label)
	body := fmt.Sprintf(
		"Hola %s,\n\n"+
			"Tu cuenta en CliniSense ha sido creada como %s.\n\n"+
			"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"+
			"Tus credenciales de acceso:\n\n"+
			"   Email: %s\n"+
			"   Contraseña: %s\n\n"+
			"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"+
			"Ingresa en: %s\n\n"+
			"Por seguridad, te recomendamos cambiar tu contraseña después de tu primer inicio de sesión.",
		name, label, toEmail, password, loginURL,
	)
	log.Printf("[notify:welcome] to=%s role=%s", toEmail, role)
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
		log.Printf("[notify:welcome] ses send failed: %v", err)
	}
	return err
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

func (r *Router) SendConsentWithAppointment(ctx context.Context, toEmail, patientName string, consent domain.Consent, startAt time.Time) error {
	frontendBase := os.Getenv("FRONTEND_BASE_URL")
	if frontendBase == "" {
		frontendBase = "https://clinisense.aski-tech.net"
	}
	acceptURL := fmt.Sprintf("%s/consent?token=%s", frontendBase, consent.AcceptToken)
	subject := "CliniSense — Consentimiento informado y confirmación de cita"
	body := fmt.Sprintf(
		"Hola %s,\n\n"+
			"Tu cita ha sido agendada para el %s a las %s.\n\n"+
			"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"+
			"CONSENTIMIENTO INFORMADO\n"+
			"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"+
			"%s\n\n"+
			"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"+
			"Para ACEPTAR el consentimiento y CONFIRMAR tu cita, haz clic en el siguiente enlace:\n\n"+
			"   %s\n\n"+
			"Si no puedes hacer clic, copia y pega el enlace en tu navegador.\n\n"+
			"Si tienes alguna duda, contáctanos.\n\n"+
			"CliniSense",
		patientName,
		startAt.Format("02/01/2006"),
		startAt.Format("15:04"),
		consent.Content,
		acceptURL,
	)
	log.Printf("[notify:consent] to=%s appointmentId=%s token=%s", toEmail, consent.AppointmentID, consent.AcceptToken)
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
		log.Printf("[notify:consent] ses send failed: %v", err)
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

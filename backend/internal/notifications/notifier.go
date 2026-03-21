package notifications

import (
	"context"
	"fmt"
	"html"
	"log"
	"os"
	"regexp"
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
	"github.com/aws/aws-sdk-go-v2/service/sns"
	snstypes "github.com/aws/aws-sdk-go-v2/service/sns/types"
)

type Notifier interface {
	SendAppointmentReminder(ctx context.Context, patientID, channel, message string) error
	SendConsentRequest(ctx context.Context, patientID, channel, message string) error
	SendConsentWithAppointment(ctx context.Context, toEmail, patientName string, consent domain.Consent, startAt time.Time) error
	SendDoctorDailySummary(ctx context.Context, doctorID, channel, message string) error
	SendInvitation(ctx context.Context, toEmail, inviteURL, role, tempPassword string) error
	SendWelcome(ctx context.Context, toEmail, name, role, password, loginURL string) error
	SendAppointmentEvent(ctx context.Context, toEmail, patientName, eventType string, startAt, endAt time.Time) error
	SendAppointmentCreated(ctx context.Context, toEmail, patientName string, appt domain.Appointment, consentLinks []ConsentLink) error
	SendAppointmentCreatedSMS(ctx context.Context, toPhone, patientName string, appt domain.Appointment) error
	SendOrgCreated(ctx context.Context, toEmail, orgName, adminName string) error
	SendTreatmentPlanSummary(ctx context.Context, toEmail, patientName, treatmentPlan string, consultDate time.Time) error
}

// ConsentLink is a consent title and its public accept token for the email body.
type ConsentLink struct {
	Title string
	Token string
}

type Router struct {
	sendSMS   bool
	sendEmail bool
	cfg       config.Config
	ddb       *dynamodb.Client
	ses       *sesv2.Client
	sns       *sns.Client
}

func NewRouter(cfg config.Config) *Router {
	ctx := context.Background()
	var opts []func(*awsconfig.LoadOptions) error
	if cfg.AWSProfile != "" {
		opts = append(opts, awsconfig.WithSharedConfigProfile(cfg.AWSProfile))
	}
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		log.Printf("[notify] warn: failed to load aws cfg: %v", err)
	}
	r := &Router{sendSMS: cfg.SendSMS, sendEmail: cfg.SendEmail, cfg: cfg}
	if err == nil {
		r.ddb = dynamodb.NewFromConfig(awsCfg)
		r.ses = sesv2.NewFromConfig(awsCfg)
		r.sns = sns.NewFromConfig(awsCfg)
	}
	return r
}

// ── HTML Email Helpers ────────────────────────────────────────────────────────

// buildHTMLEmail wraps bodyHTML in the CliniSense email layout.
// orgName is shown in the footer; pass "" to use the default.
func buildHTMLEmail(subject, bodyHTML, orgName string) string {
	if orgName == "" {
		orgName = "CliniSense"
	}
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>%s</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;background:#ffffff;border-radius:12px;
                    box-shadow:0 4px 24px rgba(0,0,0,0.07);overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#0ea5e9;padding:32px 40px;text-align:center;">
            <div style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
              CliniSense
            </div>
            <div style="margin-top:6px;font-size:13px;color:rgba(255,255,255,0.85);">
              Tu plataforma de gestión clínica
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            %s
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:0 40px;">
            <div style="border-top:1.5px solid #e0f2fe;"></div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              Este correo fue enviado por <strong style="color:#64748b;">%s</strong> a través de CliniSense.
            </p>
            <p style="margin:6px 0 0;font-size:11px;color:#cbd5e1;">
              Si no esperabas este mensaje, puedes ignorarlo.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`, html.EscapeString(subject), bodyHTML, html.EscapeString(orgName))
}

// htmlParagraph wraps text in a styled paragraph.
func htmlParagraph(text string) string {
	return fmt.Sprintf(`<p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">%s</p>`, text)
}

// htmlCTAButton renders a sky-500 call-to-action button centered.
func htmlCTAButton(label, url string) string {
	return fmt.Sprintf(`
<table width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td align="center">
      <a href="%s"
         style="display:inline-block;background:#0ea5e9;color:#ffffff;font-size:15px;
                font-weight:700;text-decoration:none;padding:14px 32px;
                border-radius:8px;letter-spacing:0.2px;">
        %s
      </a>
    </td>
  </tr>
</table>`, html.EscapeString(url), html.EscapeString(label))
}

// htmlInfoBox renders a highlighted info block (for credentials, dates, etc.).
func htmlInfoBox(lines ...string) string {
	var rows string
	for _, l := range lines {
		rows += fmt.Sprintf(`<div style="margin-bottom:6px;font-size:14px;color:#1e293b;">%s</div>`, l)
	}
	return fmt.Sprintf(`
<div style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:8px;
            padding:16px 20px;margin:20px 0;">
  %s
</div>`, rows)
}

// htmlDivider returns a sky-100 horizontal rule.
func htmlDivider() string {
	return `<div style="border-top:1.5px solid #e0f2fe;margin:20px 0;"></div>`
}

// htmlStatusBadge renders a colored pill for appointment status.
func htmlStatusBadge(label, bg, color string) string {
	return fmt.Sprintf(`
<div style="display:inline-block;background:%s;color:%s;padding:5px 16px;
            border-radius:20px;font-size:13px;font-weight:700;margin-bottom:20px;">
  Cita %s
</div>`, bg, color, html.EscapeString(label))
}

// ── normalizePhoneForSMS ──────────────────────────────────────────────────────

// normalizePhoneForSMS returns E.164 phone for SNS (only digits and leading +). Empty if invalid.
func normalizePhoneForSMS(phone string) string {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return ""
	}
	digits := regexp.MustCompile(`\D`).ReplaceAllString(phone, "")
	if digits == "" {
		return ""
	}
	// Colombia 10 dígitos empezando en 3 -> +57
	if len(digits) == 10 && digits[0] == '3' {
		return "+57" + digits
	}
	if strings.HasPrefix(phone, "+") {
		return "+" + digits
	}
	if len(digits) >= 10 {
		return "+" + digits
	}
	return ""
}

// ── Notification Methods ──────────────────────────────────────────────────────

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
		htmlBody := htmlParagraph(html.EscapeString(message))
		_, err := r.ses.SendEmail(ctx, &sesv2.SendEmailInput{
			FromEmailAddress: aws.String(sender),
			Destination:      &sestypes.Destination{ToAddresses: []string{to}},
			Content: &sestypes.EmailContent{Simple: &sestypes.Message{
				Subject: &sestypes.Content{Data: aws.String(subject)},
				Body: &sestypes.Body{
					Html: &sestypes.Content{Data: aws.String(buildHTMLEmail(subject, htmlBody, ""))},
					Text: &sestypes.Content{Data: aws.String(message)},
				},
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

func (r *Router) SendAppointmentCreated(ctx context.Context, toEmail, patientName string, appt domain.Appointment, consentLinks []ConsentLink) error {
	frontendBase := os.Getenv("FRONTEND_BASE_URL")
	if frontendBase == "" {
		frontendBase = "https://clinisense.aski-tech.net"
	}
	confirmURL := fmt.Sprintf("%s/confirm-appointment?token=%s", frontendBase, appt.ConfirmToken)
	subject := "CliniSense — Tu cita ha sido agendada"

	dateStr := appt.StartAt.Format("02/01/2006")
	timeStr := appt.StartAt.Format("15:04")

	body := fmt.Sprintf(
		"Hola %s,\n\n"+
			"Tu cita ha sido agendada para el %s a las %s.\n\n"+
			"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"+
			"Para CONFIRMAR tu cita haz clic aquí:\n\n"+
			"   %s\n\n"+
			"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"+
			"Si no puedes hacer clic, copia y pega el enlace en tu navegador.\n\n"+
			"CliniSense",
		patientName, dateStr, timeStr, confirmURL,
	)
	htmlBody := fmt.Sprintf(`
<p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#1e293b;">
  Hola %s,
</p>
%s
%s
%s
<p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">
  Si no puedes hacer clic en el botón, copia y pega este enlace:<br>
  <a href="%s" style="color:#0ea5e9;word-break:break-all;font-size:12px;">%s</a>
</p>`,
		html.EscapeString(patientName),
		htmlParagraph(fmt.Sprintf("Tu cita ha sido agendada para el <strong>%s</strong> a las <strong>%s</strong>.", dateStr, timeStr)),
		htmlDivider(),
		htmlCTAButton("Confirmar mi cita", confirmURL),
		html.EscapeString(confirmURL), html.EscapeString(confirmURL),
	)

	log.Printf("[notify:appointment-created] to=%s appointmentId=%s confirmToken=%s consentLinks=%d", toEmail, appt.ID, appt.ConfirmToken, len(consentLinks))
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
			Body: &sestypes.Body{
				Html: &sestypes.Content{Data: aws.String(buildHTMLEmail(subject, htmlBody, ""))},
				Text: &sestypes.Content{Data: aws.String(body)},
			},
		}},
	})
	if err != nil {
		log.Printf("[notify:appointment-created] ses send failed: %v", err)
	}
	return err
}

func (r *Router) SendAppointmentCreatedSMS(ctx context.Context, toPhone, patientName string, appt domain.Appointment) error {
	e164 := normalizePhoneForSMS(toPhone)
	if e164 == "" {
		log.Printf("[notify:sms] skip: paciente sin teléfono válido (patientName=%s)", patientName)
		return nil
	}
	if !r.sendSMS || r.sns == nil {
		log.Printf("[notify:sms] skip: SMS deshabilitado o cliente nil")
		return nil
	}
	frontendBase := os.Getenv("FRONTEND_BASE_URL")
	if frontendBase == "" {
		frontendBase = "https://clinisense.aski-tech.net"
	}
	confirmURL := fmt.Sprintf("%s/confirm-appointment?token=%s", frontendBase, appt.ConfirmToken)
	msg := fmt.Sprintf("CliniSense: Hola %s. Tu cita es el %s a las %s. Confirmar: %s",
		strings.TrimSpace(patientName),
		appt.StartAt.Format("02/01/2006"),
		appt.StartAt.Format("15:04"),
		confirmURL,
	)
	if len(msg) > 160 {
		msg = fmt.Sprintf("CliniSense: Cita %s a las %s. Confirmar: %s",
			appt.StartAt.Format("02/01/2006"), appt.StartAt.Format("15:04"), confirmURL)
	}
	_, err := r.sns.Publish(ctx, &sns.PublishInput{
		PhoneNumber: aws.String(e164),
		Message:     aws.String(msg),
		MessageAttributes: map[string]snstypes.MessageAttributeValue{
			"AWS.SNS.SMS.SMSType": {
				DataType:    aws.String("String"),
				StringValue: aws.String("Transactional"),
			},
		},
	})
	if err != nil {
		log.Printf("[notify:sms] send failed to %s: %v", e164, err)
		return err
	}
	log.Printf("[notify:sms] sent to %s appointmentId=%s", e164, appt.ID)
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

	dateStr := startAt.Format("02/01/2006")
	startStr := startAt.Format("15:04")
	endStr := endAt.Format("15:04")

	var body string
	var htmlBody string

	type statusStyle struct{ bg, color, label string }
	styles := map[string]statusStyle{
		"confirmed": {"#d1fae5", "#059669", "CONFIRMADA"},
		"cancelled": {"#fee2e2", "#dc2626", "CANCELADA"},
		"moved":     {"#fef3c7", "#d97706", "REPROGRAMADA"},
		"completed": {"#e0f2fe", "#0284c7", "FINALIZADA"},
	}
	st, ok := styles[eventType]
	if !ok {
		st = statusStyle{"#f1f5f9", "#475569", strings.ToUpper(title)}
	}

	switch eventType {
	case "cancelled":
		body = fmt.Sprintf(
			"Hola %s,\n\nTu cita del %s de %s a %s ha sido CANCELADA.\n\nSi tienes dudas, contáctanos.",
			patientName, dateStr, startStr, endStr,
		)
		htmlBody = fmt.Sprintf(`
<p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#1e293b;">Hola %s,</p>
%s
%s
%s
<p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">Si tienes dudas, no dudes en contactarnos.</p>`,
			html.EscapeString(patientName),
			htmlStatusBadge(st.label, st.bg, st.color),
			htmlInfoBox(
				fmt.Sprintf("<strong>Fecha:</strong> %s", dateStr),
				fmt.Sprintf("<strong>Horario:</strong> %s — %s", startStr, endStr),
			),
			htmlDivider(),
		)
	case "moved":
		body = fmt.Sprintf(
			"Hola %s,\n\nTu cita ha sido REPROGRAMADA para el %s de %s a %s.\n\nSi tienes dudas, contáctanos.",
			patientName, dateStr, startStr, endStr,
		)
		htmlBody = fmt.Sprintf(`
<p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#1e293b;">Hola %s,</p>
%s
%s
%s
<p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">Si tienes dudas, contáctanos.</p>`,
			html.EscapeString(patientName),
			htmlStatusBadge(st.label, st.bg, st.color),
			htmlInfoBox(
				fmt.Sprintf("<strong>Nueva fecha:</strong> %s", dateStr),
				fmt.Sprintf("<strong>Horario:</strong> %s — %s", startStr, endStr),
			),
			htmlDivider(),
		)
	case "confirmed":
		body = fmt.Sprintf(
			"Hola %s,\n\nTu cita del %s de %s a %s ha sido CONFIRMADA.\n\nTe esperamos puntualmente. Si necesitas cancelar, contáctanos con anticipación.",
			patientName, dateStr, startStr, endStr,
		)
		htmlBody = fmt.Sprintf(`
<p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#1e293b;">Hola %s,</p>
%s
%s
%s
<p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">Te esperamos puntualmente. Si necesitas cancelar, contáctanos con anticipación.</p>`,
			html.EscapeString(patientName),
			htmlStatusBadge(st.label, st.bg, st.color),
			htmlInfoBox(
				fmt.Sprintf("<strong>Fecha:</strong> %s", dateStr),
				fmt.Sprintf("<strong>Horario:</strong> %s — %s", startStr, endStr),
			),
			htmlDivider(),
		)
	case "completed":
		body = fmt.Sprintf(
			"Hola %s,\n\nTu consulta del %s ha sido registrada exitosamente.\n\nGracias por tu visita. Recuerda seguir las indicaciones de tu doctor y no olvides tu próxima cita.",
			patientName, dateStr,
		)
		htmlBody = fmt.Sprintf(`
<p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#1e293b;">Hola %s,</p>
%s
%s
%s
<p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">Recuerda seguir las indicaciones de tu doctor. ¡Hasta la próxima!</p>`,
			html.EscapeString(patientName),
			htmlStatusBadge(st.label, st.bg, st.color),
			htmlInfoBox(
				fmt.Sprintf("<strong>Fecha de consulta:</strong> %s", dateStr),
			),
			htmlDivider(),
		)
	default:
		body = fmt.Sprintf(
			"Hola %s,\n\nTu cita ha sido agendada para el %s de %s a %s.\n\nTe esperamos. Si necesitas cancelar o cambiar, contáctanos con anticipación.",
			patientName, dateStr, startStr, endStr,
		)
		htmlBody = fmt.Sprintf(`
<p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#1e293b;">Hola %s,</p>
%s
%s
<p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">Si necesitas cancelar o cambiar tu cita, contáctanos con anticipación.</p>`,
			html.EscapeString(patientName),
			htmlInfoBox(
				fmt.Sprintf("<strong>Fecha:</strong> %s", dateStr),
				fmt.Sprintf("<strong>Horario:</strong> %s — %s", startStr, endStr),
			),
			htmlDivider(),
		)
	}

	log.Printf("[notify:appointment] to=%s event=%s start=%s", toEmail, eventType, startAt)
	if !r.sendEmail || r.ses == nil {
		log.Printf("[notify:appointment] skip send: sendEmail=%v sesNil=%v", r.sendEmail, r.ses == nil)
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
			Body: &sestypes.Body{
				Html: &sestypes.Content{Data: aws.String(buildHTMLEmail(subject, htmlBody, ""))},
				Text: &sestypes.Content{Data: aws.String(body)},
			},
		}},
	})
	if err != nil {
		log.Printf("[notify:appointment] ses send failed: %v", err)
		return err
	}
	log.Printf("[notify:appointment] ses sent to=%s event=%s", toEmail, eventType)
	return nil
}

func (r *Router) SendTreatmentPlanSummary(ctx context.Context, toEmail, patientName, treatmentPlan string, consultDate time.Time) error {
	subject := "CliniSense — Plan de tratamiento de tu consulta"
	dateStr := consultDate.Format("02/01/2006")
	body := fmt.Sprintf(
		"Hola %s,\n\nGracias por tu visita del %s.\n\nA continuación te compartimos el plan de tratamiento indicado por tu doctor:\n\n%s\n\nSi tienes alguna duda, no dudes en contactarnos.\n\nCliniSense",
		patientName, dateStr, treatmentPlan,
	)
	htmlBody := fmt.Sprintf(`
<p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#1e293b;">Hola %s,</p>
%s
%s
<p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#1e293b;">
  Plan de tratamiento indicado por tu doctor:
</p>
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
            padding:16px 20px;font-size:14px;color:#334155;line-height:1.7;
            white-space:pre-wrap;margin-bottom:20px;">%s</div>
%s
<p style="margin:0;font-size:13px;color:#94a3b8;">
  Si tienes alguna duda sobre tu tratamiento, contáctanos.
</p>`,
		html.EscapeString(patientName),
		htmlParagraph(fmt.Sprintf("Gracias por tu visita del <strong>%s</strong>.", dateStr)),
		htmlDivider(),
		html.EscapeString(treatmentPlan),
		htmlDivider(),
	)
	log.Printf("[notify:treatment-plan] to=%s date=%s", toEmail, dateStr)
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
			Body: &sestypes.Body{
				Html: &sestypes.Content{Data: aws.String(buildHTMLEmail(subject, htmlBody, ""))},
				Text: &sestypes.Content{Data: aws.String(body)},
			},
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
	htmlBody := fmt.Sprintf(`
<p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#1e293b;">Hola %s,</p>
%s
%s
%s
<p style="margin:0;font-size:13px;color:#94a3b8;">
  Ya puedes agregar doctores, asistentes y pacientes desde el panel de administración.
</p>`,
		html.EscapeString(adminName),
		htmlParagraph(fmt.Sprintf(
			"Tu organización <strong>%s</strong> ha sido creada exitosamente en CliniSense.",
			html.EscapeString(orgName),
		)),
		htmlDivider(),
		htmlCTAButton("Ir al panel de administración", "https://clinisense.aski-tech.net/login"),
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
			Body: &sestypes.Body{
				Html: &sestypes.Content{Data: aws.String(buildHTMLEmail(subject, htmlBody, orgName))},
				Text: &sestypes.Content{Data: aws.String(body)},
			},
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
	htmlBody := fmt.Sprintf(`
<p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#1e293b;">Hola %s,</p>
%s
%s
<p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#1e293b;">Tus credenciales de acceso:</p>
%s
%s
%s
<p style="margin:0;font-size:12px;color:#94a3b8;">
  🔒 Por seguridad, cambia tu contraseña después de tu primer inicio de sesión.
</p>`,
		html.EscapeString(name),
		htmlParagraph(fmt.Sprintf(
			"Tu cuenta en CliniSense ha sido creada como <strong>%s</strong>.",
			html.EscapeString(label),
		)),
		htmlDivider(),
		htmlInfoBox(
			fmt.Sprintf("<strong>Email:</strong> %s", html.EscapeString(toEmail)),
			fmt.Sprintf("<strong>Contraseña temporal:</strong> <code style=\"font-family:monospace;background:#f1f5f9;padding:2px 6px;border-radius:4px;\">%s</code>", html.EscapeString(password)),
		),
		htmlCTAButton("Iniciar sesión", loginURL),
		htmlDivider(),
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
			Body: &sestypes.Body{
				Html: &sestypes.Content{Data: aws.String(buildHTMLEmail(subject, htmlBody, ""))},
				Text: &sestypes.Content{Data: aws.String(body)},
			},
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
	htmlBody := fmt.Sprintf(`
%s
%s
<p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#1e293b;">Tu contraseña temporal:</p>
%s
%s
%s
<p style="margin:0 0 8px;font-size:13px;color:#64748b;">
  ⏱ Este enlace es válido por <strong>72 horas</strong>.
</p>
<p style="margin:0;font-size:12px;color:#94a3b8;">
  Si no esperabas esta invitación, ignora este mensaje.
</p>`,
		htmlParagraph(fmt.Sprintf(
			"Has sido invitado a unirte a CliniSense como <strong>%s</strong>.",
			html.EscapeString(label),
		)),
		htmlDivider(),
		htmlInfoBox(
			fmt.Sprintf("<strong>Contraseña temporal:</strong> <code style=\"font-family:monospace;background:#f1f5f9;padding:2px 6px;border-radius:4px;\">%s</code>", html.EscapeString(tempPassword)),
		),
		htmlCTAButton("Activar mi cuenta", inviteURL),
		htmlDivider(),
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
			Body: &sestypes.Body{
				Html: &sestypes.Content{Data: aws.String(buildHTMLEmail(subject, htmlBody, ""))},
				Text: &sestypes.Content{Data: aws.String(body)},
			},
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
	dateStr := startAt.Format("02/01/2006")
	timeStr := startAt.Format("15:04")
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
		patientName, dateStr, timeStr, consent.Content, acceptURL,
	)
	htmlBody := fmt.Sprintf(`
<p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#1e293b;">Hola %s,</p>
%s
%s
<p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#1e293b;">
  Consentimiento informado
</p>
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
            padding:16px 20px;font-size:14px;color:#334155;line-height:1.7;
            white-space:pre-wrap;max-height:300px;overflow-y:auto;margin-bottom:20px;">%s</div>
%s
%s
<p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">
  Si no puedes hacer clic en el botón, copia y pega este enlace:<br>
  <a href="%s" style="color:#0ea5e9;word-break:break-all;font-size:12px;">%s</a>
</p>`,
		html.EscapeString(patientName),
		htmlParagraph(fmt.Sprintf("Tu cita ha sido agendada para el <strong>%s</strong> a las <strong>%s</strong>.", dateStr, timeStr)),
		htmlDivider(),
		html.EscapeString(consent.Content),
		htmlDivider(),
		htmlCTAButton("Aceptar consentimiento y confirmar cita", acceptURL),
		html.EscapeString(acceptURL), html.EscapeString(acceptURL),
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
			Body: &sestypes.Body{
				Html: &sestypes.Content{Data: aws.String(buildHTMLEmail(subject, htmlBody, ""))},
				Text: &sestypes.Content{Data: aws.String(body)},
			},
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

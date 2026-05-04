package notifications

import (
	"context"
	"fmt"
	"html"
	"log"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"clinical-backend/internal/config"
	"clinical-backend/internal/domain"
	"clinical-backend/internal/store"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	ddbtypes "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	snstypes "github.com/aws/aws-sdk-go-v2/service/sns/types"
	mail "github.com/wneessen/go-mail"
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
	SendRescheduleRequest(ctx context.Context, toEmail, patientName string, startAt time.Time) error
}

// ConsentLink is a consent title and its public accept token for the email body.
type ConsentLink struct {
	Title string
	Token string
}

type Router struct {
	cfg            config.Config
	ddb            *dynamodb.Client
	sns            *sns.Client
	settingsRepo   store.PlatformSettingsRepository
	mu             sync.Mutex
	cachedSettings *store.PlatformSettings
	cacheUntil     time.Time
}

func NewRouter(cfg config.Config, settingsRepo store.PlatformSettingsRepository) *Router {
	ctx := context.Background()
	var opts []func(*awsconfig.LoadOptions) error
	if cfg.AWSProfile != "" {
		opts = append(opts, awsconfig.WithSharedConfigProfile(cfg.AWSProfile))
	}
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		log.Printf("[notify] warn: failed to load aws cfg: %v", err)
	}
	r := &Router{cfg: cfg, settingsRepo: settingsRepo}
	if err == nil {
		r.ddb = dynamodb.NewFromConfig(awsCfg)
		r.sns = sns.NewFromConfig(awsCfg)
	}
	return r
}

func (r *Router) getSettings(ctx context.Context) store.PlatformSettings {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.cachedSettings != nil && time.Now().Before(r.cacheUntil) {
		return *r.cachedSettings
	}
	if r.settingsRepo != nil {
		s, err := r.settingsRepo.GetSettings(ctx)
		if err == nil {
			r.cachedSettings = &s
			r.cacheUntil = time.Now().Add(60 * time.Second)
			return s
		}
		log.Printf("[notify] warn: could not load platform settings from DB: %v", err)
	}
	return store.PlatformSettings{SendSMS: r.cfg.SendSMS, SendEmail: r.cfg.SendEmail}
}

func (r *Router) sendMail(_ context.Context, from, to, subject, htmlBody, textBody string) error {
	m := mail.NewMsg()
	if err := m.From(from); err != nil {
		return fmt.Errorf("mail from: %w", err)
	}
	if err := m.To(to); err != nil {
		return fmt.Errorf("mail to: %w", err)
	}
	m.Subject(subject)
	m.SetBodyString(mail.TypeTextHTML, htmlBody)
	m.AddAlternativeString(mail.TypeTextPlain, textBody)

	c, err := mail.NewClient(r.cfg.SMTPHost,
		mail.WithPort(r.cfg.SMTPPort),
		mail.WithSMTPAuth(mail.SMTPAuthPlain),
		mail.WithUsername(r.cfg.SMTPUser),
		mail.WithPassword(r.cfg.SMTPPass),
		mail.WithTLSPolicy(mail.TLSMandatory),
	)
	if err != nil {
		return fmt.Errorf("mail client: %w", err)
	}
	return c.DialAndSend(m)
}

// ── HTML Email Helpers ────────────────────────────────────────────────────────

// buildHTMLEmail wraps bodyHTML in the DOCCO email layout.
// orgName is shown in the footer; pass "" to omit the org line.
func buildHTMLEmail(subject, bodyHTML, orgName string) string {
	footerOrg := ""
	if orgName != "" {
		footerOrg = fmt.Sprintf(
			`<p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">En nombre de: %s</p>`,
			html.EscapeString(orgName),
		)
	}
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>%s</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Inter','Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;background:#ffffff;border-radius:16px;
                    box-shadow:0 4px 24px rgba(0,0,0,0.07);overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0ea5e9 0%%,#0284c7 100%%);padding:32px;">
            <div style="display:flex;align-items:center;gap:14px;">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">
                <circle cx="18" cy="18" r="18" fill="rgba(255,255,255,0.2)"/>
                <path d="M12 10c0-2.2 1.8-4 4-4h4c2.2 0 4 1.8 4 4 0 1.5-.5 2.8-1.2 3.8C21.6 15.5 22 17.2 22 19c0 3.3-1.8 9-4 9s-4-5.7-4-9c0-1.8.4-3.5 1.2-5.2C14.5 12.8 12 11.5 12 10z" fill="white"/>
              </svg>
              <div>
                <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:2px;">DOCCO</div>
                <div style="font-size:13px;color:rgba(255,255,255,0.85);">Sistema de Gestión Clínica</div>
              </div>
            </div>
          </td>
        </tr>

        <!-- Subject title -->
        <tr>
          <td style="padding:28px 32px 0;">
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#0f172a;">%s</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:24px 32px 32px;">
            %s
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;border-radius:0 0 16px 16px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">Enviado por DOCCO · Sistema de Gestión Clínica</p>
            %s
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`, html.EscapeString(subject), html.EscapeString(subject), bodyHTML, footerOrg)
}

// htmlParagraph wraps text in a styled paragraph.
func htmlParagraph(text string) string {
	return fmt.Sprintf(`<p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">%s</p>`, text)
}

// htmlCTAButton renders a prominent gradient call-to-action button centered.
func htmlCTAButton(label, url string) string {
	return fmt.Sprintf(`
<div style="text-align:center;margin:24px 0;">
  <a href="%s"
     style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#ffffff;
            font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;
            border-radius:10px;letter-spacing:0.3px;
            box-shadow:0 4px 14px rgba(14,165,233,0.4);">
    %s
  </a>
</div>`, html.EscapeString(url), html.EscapeString(label))
}

// htmlInfoBox renders a left-bordered info block (for credentials, dates, etc.).
// Lines containing ":" are split into bold key + value.
func htmlInfoBox(lines ...string) string {
	var rows string
	for i, l := range lines {
		marginBottom := "6px"
		if i == len(lines)-1 {
			marginBottom = "0"
		}
		// If line contains ":" render the key portion in bold
		if idx := strings.Index(l, ":"); idx != -1 {
			key := l[:idx]
			val := l[idx+1:]
			rows += fmt.Sprintf(
				`<p style="margin:0 0 %s;font-size:14px;color:#334155;"><span style="font-weight:600;color:#0f172a;">%s:</span>%s</p>`,
				marginBottom, key, val,
			)
		} else {
			rows += fmt.Sprintf(
				`<p style="margin:0 0 %s;font-size:14px;color:#334155;">%s</p>`,
				marginBottom, l,
			)
		}
	}
	return fmt.Sprintf(`
<div style="border-left:4px solid #0ea5e9;background:#f0f9ff;border-radius:0 10px 10px 0;
            padding:16px 20px;margin:16px 0;">
  %s
</div>`, rows)
}

// htmlDivider returns a subtle horizontal rule.
func htmlDivider() string {
	return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />`
}

// htmlStatusBadge renders a colored pill badge for appointment status.
func htmlStatusBadge(label, bg, color string) string {
	return fmt.Sprintf(
		`<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:%s;color:%s;font-size:12px;font-weight:600;letter-spacing:0.5px;">%s</span>`,
		bg, color, html.EscapeString(label),
	)
}

// ── getOrgName ───────────────────────────────────────────────────────────────

// getOrgName fetches the organization name from DynamoDB using the OrgID in ctx.
// Returns "" if unavailable so callers can safely pass it to buildHTMLEmail.
func (r *Router) getOrgName(ctx context.Context) string {
	if r.ddb == nil {
		return ""
	}
	orgID := store.OrgIDFromContext(ctx)
	if strings.TrimSpace(orgID) == "" {
		return ""
	}
	out, err := r.ddb.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.cfg.PatientTable),
		Key: map[string]ddbtypes.AttributeValue{
			"PK": &ddbtypes.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
			"SK": &ddbtypes.AttributeValueMemberS{Value: "ORG"},
		},
		ProjectionExpression: aws.String("#n"),
		ExpressionAttributeNames: map[string]string{"#n": "name"},
	})
	if err != nil || out.Item == nil {
		return ""
	}
	var row struct{ Name string }
	if err := attributevalue.UnmarshalMap(out.Item, &row); err != nil {
		return ""
	}
	return strings.TrimSpace(row.Name)
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
	if !r.allowed(ctx, channel) {
		return fmt.Errorf("channel %s disabled", channel)
	}
	if channel == "email" {
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
			sender = "no-reply@aloai.me"
		}
		subject := "Confirmación de cita"
		htmlBody := htmlParagraph(html.EscapeString(message))
		err := r.sendMail(ctx, sender, to, subject, buildHTMLEmail(subject, htmlBody, r.getOrgName(ctx)), message)
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
		frontendBase = "https://docco.aloai.me"
	}
	confirmURL := fmt.Sprintf("%s/confirm-appointment?token=%s", frontendBase, appt.ConfirmToken)
	subject := "Docco — Tu cita ha sido agendada"

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
			"Docco",
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
	if !r.getSettings(ctx).SendEmail {
		return nil
	}
	sender := r.cfg.SESSenderEmail
	if sender == "" {
		sender = "no-reply@aloai.me"
	}
	err := r.sendMail(ctx, sender, toEmail, subject, buildHTMLEmail(subject, htmlBody, r.getOrgName(ctx)), body)
	if err != nil {
		log.Printf("[notify:appointment-created] smtp send failed: %v", err)
	}
	return err
}

func (r *Router) SendAppointmentCreatedSMS(ctx context.Context, toPhone, patientName string, appt domain.Appointment) error {
	e164 := normalizePhoneForSMS(toPhone)
	if e164 == "" {
		log.Printf("[notify:sms] skip: paciente sin teléfono válido (patientName=%s)", patientName)
		return nil
	}
	if !r.getSettings(ctx).SendSMS || r.sns == nil {
		log.Printf("[notify:sms] skip: SMS deshabilitado o cliente nil")
		return nil
	}
	frontendBase := os.Getenv("FRONTEND_BASE_URL")
	if frontendBase == "" {
		frontendBase = "https://docco.aloai.me"
	}
	confirmURL := fmt.Sprintf("%s/confirm-appointment?token=%s", frontendBase, appt.ConfirmToken)
	msg := fmt.Sprintf("Docco: Hola %s. Tu cita es el %s a las %s. Confirmar: %s",
		strings.TrimSpace(patientName),
		appt.StartAt.Format("02/01/2006"),
		appt.StartAt.Format("15:04"),
		confirmURL,
	)
	if len(msg) > 160 {
		msg = fmt.Sprintf("Docco: Cita %s a las %s. Confirmar: %s",
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

func (r *Router) SendConsentRequest(ctx context.Context, patientID, channel, message string) error {
	if !r.allowed(ctx, channel) {
		return fmt.Errorf("channel %s disabled", channel)
	}
	log.Printf("[notify:consent] patient=%s channel=%s message=%s", patientID, channel, message)
	return nil
}

func (r *Router) SendDoctorDailySummary(ctx context.Context, doctorID, channel, message string) error {
	if !r.allowed(ctx, channel) {
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
	subject := fmt.Sprintf("Docco — %s", title)

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
	if !r.getSettings(ctx).SendEmail {
		return nil
	}
	sender := r.cfg.SESSenderEmail
	if sender == "" {
		sender = "no-reply@aloai.me"
	}
	err := r.sendMail(ctx, sender, toEmail, subject, buildHTMLEmail(subject, htmlBody, r.getOrgName(ctx)), body)
	if err != nil {
		log.Printf("[notify:appointment] smtp send failed: %v", err)
		return err
	}
	log.Printf("[notify:appointment] smtp sent to=%s event=%s", toEmail, eventType)
	return nil
}

func (r *Router) SendTreatmentPlanSummary(ctx context.Context, toEmail, patientName, treatmentPlan string, consultDate time.Time) error {
	subject := "Docco — Plan de tratamiento de tu consulta"
	dateStr := consultDate.Format("02/01/2006")
	body := fmt.Sprintf(
		"Hola %s,\n\nGracias por tu visita del %s.\n\nA continuación te compartimos el plan de tratamiento indicado por tu doctor:\n\n%s\n\nSi tienes alguna duda, no dudes en contactarnos.\n\nDocco",
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
	if !r.getSettings(ctx).SendEmail {
		return nil
	}
	sender := r.cfg.SESSenderEmail
	if sender == "" {
		sender = "no-reply@aloai.me"
	}
	err := r.sendMail(ctx, sender, toEmail, subject, buildHTMLEmail(subject, htmlBody, r.getOrgName(ctx)), body)
	if err != nil {
		log.Printf("[notify:treatment-plan] smtp send failed: %v", err)
	}
	return err
}

func (r *Router) SendOrgCreated(ctx context.Context, toEmail, orgName, adminName string) error {
	subject := fmt.Sprintf("Docco — Organización '%s' creada", orgName)
	body := fmt.Sprintf(
		"Hola %s,\n\nTu organización '%s' ha sido creada exitosamente en Docco.\n\nYa puedes comenzar a agregar doctores, asistentes y pacientes desde el panel de administración.\n\nBienvenido a Docco.",
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
			"Tu organización <strong>%s</strong> ha sido creada exitosamente en Docco.",
			html.EscapeString(orgName),
		)),
		htmlDivider(),
		htmlCTAButton("Ir al panel de administración", "https://docco.aloai.me/login"),
	)
	log.Printf("[notify:org-created] to=%s org=%s", toEmail, orgName)
	if !r.getSettings(ctx).SendEmail {
		return nil
	}
	sender := r.cfg.SESSenderEmail
	if sender == "" {
		sender = "no-reply@aloai.me"
	}
	err := r.sendMail(ctx, sender, toEmail, subject, buildHTMLEmail(subject, htmlBody, orgName), body)
	if err != nil {
		log.Printf("[notify:org-created] smtp send failed: %v", err)
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
	subject := fmt.Sprintf("Bienvenido a Docco — Tu cuenta como %s", label)
	body := fmt.Sprintf(
		"Hola %s,\n\n"+
			"Tu cuenta en Docco ha sido creada como %s.\n\n"+
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
			"Tu cuenta en Docco ha sido creada como <strong>%s</strong>.",
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
	if !r.getSettings(ctx).SendEmail {
		return nil
	}
	sender := r.cfg.SESSenderEmail
	if sender == "" {
		sender = "no-reply@aloai.me"
	}
	err := r.sendMail(ctx, sender, toEmail, subject, buildHTMLEmail(subject, htmlBody, r.getOrgName(ctx)), body)
	if err != nil {
		log.Printf("[notify:welcome] smtp send failed: %v", err)
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
	subject := fmt.Sprintf("Invitación a Docco — Acceso como %s", label)
	body := fmt.Sprintf(
		"Has sido invitado a unirte a Docco como %s.\n\n"+
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
			"Has sido invitado a unirte a Docco como <strong>%s</strong>.",
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
	if !r.getSettings(ctx).SendEmail {
		return nil
	}
	sender := r.cfg.SESSenderEmail
	if sender == "" {
		sender = "no-reply@aloai.me"
	}
	err := r.sendMail(ctx, sender, toEmail, subject, buildHTMLEmail(subject, htmlBody, r.getOrgName(ctx)), body)
	if err != nil {
		log.Printf("[notify:invitation] smtp send failed: %v", err)
	}
	return err
}

func (r *Router) SendConsentWithAppointment(ctx context.Context, toEmail, patientName string, consent domain.Consent, startAt time.Time) error {
	frontendBase := os.Getenv("FRONTEND_BASE_URL")
	if frontendBase == "" {
		frontendBase = "https://docco.aloai.me"
	}
	acceptURL := fmt.Sprintf("%s/consent?token=%s", frontendBase, consent.AcceptToken)
	subject := "Docco — Consentimiento informado y confirmación de cita"
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
			"Docco",
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
	if !r.getSettings(ctx).SendEmail {
		return nil
	}
	sender := r.cfg.SESSenderEmail
	if sender == "" {
		sender = "no-reply@aloai.me"
	}
	err := r.sendMail(ctx, sender, toEmail, subject, buildHTMLEmail(subject, htmlBody, r.getOrgName(ctx)), body)
	if err != nil {
		log.Printf("[notify:consent] smtp send failed: %v", err)
	}
	return err
}

func (r *Router) SendRescheduleRequest(ctx context.Context, toEmail, patientName string, startAt time.Time) error {
	dateStr := startAt.Format("02/01/2006")
	timeStr := startAt.Format("15:04")
	subject := "Docco — Solicitud de reprogramación de cita"
	body := fmt.Sprintf(
		"El paciente %s ha solicitado reprogramar su cita del %s a las %s.\n\nPor favor contáctalo para coordinar un nuevo horario.",
		patientName, dateStr, timeStr,
	)
	htmlBody := fmt.Sprintf(`
<p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#1e293b;">Solicitud de reprogramación</p>
<p style="margin:0 0 8px;font-size:14px;color:#334155;">El paciente <strong>%s</strong> ha solicitado reprogramar su cita del <strong>%s</strong> a las <strong>%s</strong>.</p>
<p style="margin:0;font-size:14px;color:#64748b;">Por favor contáctalo para coordinar un nuevo horario.</p>`,
		html.EscapeString(patientName), dateStr, timeStr)
	log.Printf("[notify:reschedule-request] to=%s patient=%s start=%s", toEmail, patientName, startAt)
	if !r.getSettings(ctx).SendEmail {
		return nil
	}
	sender := r.cfg.SESSenderEmail
	if sender == "" {
		sender = "no-reply@aloai.me"
	}
	err := r.sendMail(ctx, sender, toEmail, subject, buildHTMLEmail(subject, htmlBody, r.getOrgName(ctx)), body)
	if err != nil {
		log.Printf("[notify:reschedule-request] smtp send failed: %v", err)
	}
	return err
}

func (r *Router) allowed(ctx context.Context, channel string) bool {
	s := r.getSettings(ctx)
	switch channel {
	case "sms":
		return s.SendSMS
	case "email":
		return s.SendEmail
	default:
		return false
	}
}

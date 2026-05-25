package config

import (
	"os"
	"strconv"
)

type Config struct {
	Environment          string
	AppointmentTable     string
	PatientTable         string
	ConsentTable         string
	ConsentTemplateTable string
	UserTable            string
	OdontogramTable      string
	TreatmentPlanTable   string
	PaymentTable         string
	BudgetTable             string
	PlatformSettingsTable   string
	PlatformAdminEmail      string
	BootstrapSecret      string
	FrontendBaseURL      string
	SESSenderEmail       string
	SendSMS              bool
	SendEmail            bool
	UseInMemory          bool
	AWSProfile           string
	IsLambda             bool
	BedrockModelID       string
	DoccoEnabled         bool
	ClinicTZ             string
	SMTPHost             string
	SMTPPort             int
	SMTPUser             string
	SMTPPass             string
	// WhatsApp
	WhatsAppEnabled      bool
	WhatsAppConfigTable  string
	EvolutionAPIURL      string
	EvolutionAPIKey      string
	WhatsAppModelID      string
	WhatsAppQueueURL     string
	APIGatewayURL        string
	WhatsAppAuditEnabled bool
	WhatsAppAuditBucket  string
}

func Load() Config {
	// Detect if running in Lambda environment
	isLambda := os.Getenv("AWS_LAMBDA_FUNCTION_NAME") != ""

	// Use in-memory storage for local development unless explicitly disabled
	useInMemory := !isLambda && getEnv("USE_DYNAMODB", "false") != "true"

	awsProfile := getEnv("AWS_PROFILE", "")
	if !isLambda && awsProfile == "" {
		awsProfile = "aloai"
	}

	return Config{
		Environment:          getEnv("ENVIRONMENT", "dev"),
		AppointmentTable:     getEnv("APPOINTMENT_TABLE", "clinical-appointments"),
		PatientTable:         getEnv("PATIENT_TABLE", "clinical-patients"),
		ConsentTable:         getEnv("CONSENT_TABLE", "clinical-consents"),
		ConsentTemplateTable: getEnv("CONSENT_TEMPLATE_TABLE", "clinical-consent-templates"),
		UserTable:            getEnv("USER_TABLE", "clinical-users"),
		OdontogramTable:      getEnv("ODONTOGRAM_TABLE", "clinical-odontograms"),
		TreatmentPlanTable:   getEnv("TREATMENT_PLAN_TABLE", "clinical-treatment-plans"),
		PaymentTable:         getEnv("PAYMENT_TABLE", "clinical-payments"),
		BudgetTable:           getEnv("BUDGET_TABLE", "clinical-budgets"),
		PlatformSettingsTable: getEnv("PLATFORM_SETTINGS_TABLE", "clinical-platform-settings"),
		PlatformAdminEmail:    getEnv("PLATFORM_ADMIN_EMAIL", ""),
		BootstrapSecret:      getEnv("BOOTSTRAP_SECRET", ""),
		FrontendBaseURL:      getEnv("FRONTEND_BASE_URL", "https://localhost:5173"),
		SESSenderEmail:       getEnv("SES_SENDER_EMAIL", "mserranolm@gmail.com"),
		SendSMS:              getEnv("SEND_SMS", "false") == "true",
		SendEmail:            getEnv("SEND_EMAIL", "false") == "true",
		UseInMemory:          useInMemory,
		AWSProfile:           awsProfile,
		IsLambda:             isLambda,
		BedrockModelID:       getEnv("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0"),
		DoccoEnabled:         getEnv("DOCCO_ENABLED", "true") == "true",
		ClinicTZ:             getEnv("CLINIC_TZ", "America/Caracas"),
		SMTPHost:             getEnv("SMTP_HOST", "smtp.resend.com"),
		SMTPPort:             getEnvInt("SMTP_PORT", 587),
		SMTPUser:             getEnv("SMTP_USER", "resend"),
		SMTPPass:             getEnv("SMTP_PASS", ""),
		WhatsAppEnabled:      getEnv("WHATSAPP_ENABLED", "false") == "true",
		WhatsAppConfigTable:  getEnv("WHATSAPP_CONFIG_TABLE", "clinical-whatsapp-config"),
		EvolutionAPIURL:      getEnv("EVOLUTION_API_URL", ""),
		EvolutionAPIKey:      getEnv("EVOLUTION_API_KEY", ""),
		WhatsAppModelID:      getEnv("WHATSAPP_MODEL_ID", "us.anthropic.claude-sonnet-4-6"),
		WhatsAppQueueURL:     getEnv("WHATSAPP_QUEUE_URL", ""),
		APIGatewayURL:        getEnv("API_GATEWAY_URL", ""),
		WhatsAppAuditEnabled: getEnv("WHATSAPP_AUDIT_ENABLED", "false") == "true",
		WhatsAppAuditBucket:  getEnv("WHATSAPP_AUDIT_BUCKET", ""),
	}
}

func (c Config) IsLocal() bool {
	return !c.IsLambda
}

func (c Config) ShouldUseDynamoDB() bool {
	return !c.UseInMemory
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if value, ok := os.LookupEnv(key); ok {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return fallback
}

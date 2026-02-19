package config

import "os"

type Config struct {
	Environment        string
	AppointmentTable   string
	PatientTable       string
	ConsentTable       string
	UserTable          string
	OdontogramTable    string
	TreatmentPlanTable string
	PlatformAdminEmail string
	BootstrapSecret    string
	FrontendBaseURL    string
	SESSenderEmail     string
	SendSMS            bool
	SendEmail          bool
	UseInMemory        bool
	AWSProfile         string
	IsLambda           bool
}

func Load() Config {
	// Detect if running in Lambda environment
	isLambda := os.Getenv("AWS_LAMBDA_FUNCTION_NAME") != ""

	// Use in-memory storage for local development unless explicitly disabled
	useInMemory := !isLambda && getEnv("USE_DYNAMODB", "false") != "true"

	// AWS Profile for local development (SSO profile)
	awsProfile := getEnv("AWS_PROFILE", "")

	return Config{
		Environment:        getEnv("ENVIRONMENT", "dev"),
		AppointmentTable:   getEnv("APPOINTMENT_TABLE", "clinical-appointments"),
		PatientTable:       getEnv("PATIENT_TABLE", "clinical-patients"),
		ConsentTable:       getEnv("CONSENT_TABLE", "clinical-consents"),
		UserTable:          getEnv("USER_TABLE", "clinical-users"),
		OdontogramTable:    getEnv("ODONTOGRAM_TABLE", "clinical-odontograms"),
		TreatmentPlanTable: getEnv("TREATMENT_PLAN_TABLE", "clinical-treatment-plans"),
		PlatformAdminEmail: getEnv("PLATFORM_ADMIN_EMAIL", ""),
		BootstrapSecret:    getEnv("BOOTSTRAP_SECRET", ""),
		FrontendBaseURL:    getEnv("FRONTEND_BASE_URL", "https://localhost:5173"),
		SESSenderEmail:     getEnv("SES_SENDER_EMAIL", "no-reply@vozlyai.aski-tech.net"),
		SendSMS:            getEnv("SEND_SMS", "false") == "true",
		SendEmail:          getEnv("SEND_EMAIL", "false") == "true",
		UseInMemory:        useInMemory,
		AWSProfile:         awsProfile,
		IsLambda:           isLambda,
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

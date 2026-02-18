package config

import "os"

type Config struct {
	Environment      string
	AppointmentTable string
	PatientTable     string
	ConsentTable     string
	SendSMS          bool
	SendEmail        bool
	UseInMemory      bool
	AWSProfile       string
	IsLambda         bool
}

func Load() Config {
	// Detect if running in Lambda environment
	isLambda := os.Getenv("AWS_LAMBDA_FUNCTION_NAME") != ""

	// Use in-memory storage for local development unless explicitly disabled
	useInMemory := !isLambda && getEnv("USE_DYNAMODB", "false") != "true"

	// AWS Profile for local development (SSO profile)
	awsProfile := getEnv("AWS_PROFILE", "")

	return Config{
		Environment:      getEnv("ENVIRONMENT", "dev"),
		AppointmentTable: getEnv("APPOINTMENT_TABLE", "clinical-appointments"),
		PatientTable:     getEnv("PATIENT_TABLE", "clinical-patients"),
		ConsentTable:     getEnv("CONSENT_TABLE", "clinical-consents"),
		SendSMS:          getEnv("SEND_SMS", "true") == "true",
		SendEmail:        getEnv("SEND_EMAIL", "true") == "true",
		UseInMemory:      useInMemory,
		AWSProfile:       awsProfile,
		IsLambda:         isLambda,
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

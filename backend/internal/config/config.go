package config

import "os"

type Config struct {
	Environment      string
	AppointmentTable string
	PatientTable     string
	ConsentTable     string
	SendSMS          bool
	SendEmail        bool
}

func Load() Config {
	return Config{
		Environment:      getEnv("ENVIRONMENT", "dev"),
		AppointmentTable: getEnv("APPOINTMENT_TABLE", "clinical-appointments"),
		PatientTable:     getEnv("PATIENT_TABLE", "clinical-patients"),
		ConsentTable:     getEnv("CONSENT_TABLE", "clinical-consents"),
		SendSMS:          getEnv("SEND_SMS", "true") == "true",
		SendEmail:        getEnv("SEND_EMAIL", "true") == "true",
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

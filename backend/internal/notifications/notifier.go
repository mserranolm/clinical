package notifications

import (
	"context"
	"fmt"
	"log"

	"clinical-backend/internal/config"
)

type Notifier interface {
	SendAppointmentReminder(ctx context.Context, patientID, channel, message string) error
	SendConsentRequest(ctx context.Context, patientID, channel, message string) error
	SendDoctorDailySummary(ctx context.Context, doctorID, channel, message string) error
}

type Router struct {
	sendSMS   bool
	sendEmail bool
}

func NewRouter(cfg config.Config) *Router {
	return &Router{sendSMS: cfg.SendSMS, sendEmail: cfg.SendEmail}
}

func (r *Router) SendAppointmentReminder(_ context.Context, patientID, channel, message string) error {
	if !r.allowed(channel) {
		return fmt.Errorf("channel %s disabled", channel)
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

package service

import (
	"context"
	"fmt"
	"time"

	"clinical-backend/internal/notifications"
)

const reminderCooldown = 3 * time.Minute

// SendReminderAnytime resends the appointment confirmation email (with confirm + consent links).
// Rate-limited to once every 3 minutes using ReminderSentAt.
func (s *AppointmentService) SendReminderAnytime(ctx context.Context, appointmentID, channel string) error {
	item, err := s.repo.GetByID(ctx, appointmentID)
	if err != nil {
		return err
	}

	if item.ReminderSentAt != nil && time.Since(*item.ReminderSentAt) < reminderCooldown {
		remaining := reminderCooldown - time.Since(*item.ReminderSentAt)
		return fmt.Errorf("espera %d segundos antes de reenviar otro recordatorio", int(remaining.Seconds())+1)
	}

	if item.ConfirmToken == "" {
		token, terr := generateAppointmentToken()
		if terr == nil {
			item.ConfirmToken = token
		}
	}

	if s.notifier != nil {
		email, name := s.patientEmail(ctx, item.PatientID)
		if email == "" {
			return fmt.Errorf("el paciente no tiene email registrado")
		}
		ctx, orgID := s.ensureOrgContext(ctx, item.DoctorID)
		var consentLinks []notifications.ConsentLink
		if s.consents != nil && orgID != "" {
			if list, cerr := s.consents.CreateConsentsForAppointment(ctx, item.ID, orgID, item.PatientID, item.DoctorID, email, name, item.StartAt); cerr == nil {
				for _, c := range list {
					if c.AcceptToken != "" {
						consentLinks = append(consentLinks, notifications.ConsentLink{Title: c.Title, Token: c.AcceptToken})
					}
				}
			}
		}
		if err := s.notifier.SendAppointmentCreated(ctx, email, name, item, consentLinks); err != nil {
			return err
		}
		if phone := s.patientPhone(ctx, item.PatientID); phone != "" {
			_ = s.notifier.SendAppointmentCreatedSMS(ctx, phone, name, item)
		}
	}

	now := time.Now().UTC()
	item.ReminderSentAt = &now
	_, err = s.repo.Update(ctx, item)
	return err
}

package service

import (
	"context"
	"fmt"
	"time"
)

const reminderCooldown = 3 * time.Minute

// SendReminderAnytime resends the appointment confirmation email (solo enlace de confirmación de cita).
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
		// Módulo de consentimiento deshabilitado: el reenvío solo incluye el enlace de confirmación.
		if err := s.notifier.SendAppointmentCreated(ctx, email, name, item, nil); err != nil {
			return err
		}
	}

	now := time.Now().UTC()
	item.ReminderSentAt = &now
	_, err = s.repo.Update(ctx, item)
	return err
}

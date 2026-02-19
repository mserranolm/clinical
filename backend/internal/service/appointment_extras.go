package service

import (
	"context"
	"fmt"
	"time"
)

// SendReminderAnytime resends a reminder without enforcing the 24h window.
func (s *AppointmentService) SendReminderAnytime(ctx context.Context, appointmentID, channel string) error {
	item, err := s.repo.GetByID(ctx, appointmentID)
	if err != nil {
		return err
	}
	msg := fmt.Sprintf("Recordatorio de cita médica el %s. Responde para confirmar.", item.StartAt.Format(time.RFC1123))
	if err := s.notifier.SendAppointmentReminder(ctx, item.PatientID, channel, msg); err != nil {
		return err
	}
	now := time.Now().UTC()
	item.ReminderSentAt = &now
	_, err = s.repo.Update(ctx, item)
	return err
}

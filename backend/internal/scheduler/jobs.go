package scheduler

import (
	"context"
	"log"
	"time"

	"clinical-backend/internal/service"
)

type ReminderJobs struct {
	appointments *service.AppointmentService
}

func NewReminderJobs(appointments *service.AppointmentService) *ReminderJobs {
	return &ReminderJobs{appointments: appointments}
}

func (j *ReminderJobs) Run24hReminder(ctx context.Context, appointmentID, channel string) error {
	return j.appointments.Send24hReminder(ctx, appointmentID, channel)
}

func (j *ReminderJobs) RunDoctorEndOfDayReminder(ctx context.Context, doctorID, channel string) error {
	return j.appointments.SendDoctorCloseDayReminder(ctx, doctorID, channel)
}

func ShouldTrigger24hReminder(startAt time.Time, now time.Time) bool {
	hours := startAt.Sub(now).Hours()
	return hours >= 23.9 && hours <= 24.1
}

func LogScheduleEvent(name string, payload map[string]string) {
	log.Printf("[schedule:%s] payload=%v", name, payload)
}

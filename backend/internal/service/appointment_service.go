package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"clinical-backend/internal/domain"
	"clinical-backend/internal/notifications"
	"clinical-backend/internal/store"
)

type AppointmentService struct {
	repo        store.AppointmentRepository
	patientRepo store.PatientRepository
	authRepo    store.AuthRepository
	notifier    notifications.Notifier
	consents    *ConsentService
}

func NewAppointmentService(repo store.AppointmentRepository, notifier notifications.Notifier, opts ...func(*AppointmentService)) *AppointmentService {
	svc := &AppointmentService{repo: repo, notifier: notifier}
	for _, o := range opts {
		o(svc)
	}
	return svc
}

func WithPatientRepo(r store.PatientRepository) func(*AppointmentService) {
	return func(s *AppointmentService) { s.patientRepo = r }
}

func WithAuthRepo(r store.AuthRepository) func(*AppointmentService) {
	return func(s *AppointmentService) { s.authRepo = r }
}

func WithConsentService(cs *ConsentService) func(*AppointmentService) {
	return func(s *AppointmentService) { s.consents = cs }
}

func (s *AppointmentService) patientEmail(ctx context.Context, patientID string) (email, name string) {
	if s.patientRepo == nil {
		return "", ""
	}
	p, err := s.patientRepo.GetByID(ctx, patientID)
	if err != nil {
		return "", ""
	}
	return p.Email, p.FirstName + " " + p.LastName
}

// ensureOrgContext returns ctx with OrgID set and the orgID to use for consent templates.
// If context already has OrgID, returns as-is. Otherwise tries to resolve from doctor (DoctorID = user ID).
func (s *AppointmentService) ensureOrgContext(ctx context.Context, doctorID string) (context.Context, string) {
	orgID := store.OrgIDFromContext(ctx)
	if strings.TrimSpace(orgID) != "" {
		return ctx, orgID
	}
	if strings.TrimSpace(doctorID) == "" || s.authRepo == nil {
		return ctx, ""
	}
	u, err := s.authRepo.GetUserByID(ctx, doctorID)
	if err != nil {
		log.Printf("[appointment] ensureOrgContext: could not get user for doctor %s: %v", doctorID, err)
		return ctx, ""
	}
	orgID = strings.TrimSpace(u.OrgID)
	if orgID != "" {
		ctx = store.ContextWithOrgID(ctx, orgID)
	}
	return ctx, orgID
}

type CreateAppointmentInput struct {
	DoctorID        string  `json:"doctorId"`
	PatientID       string  `json:"patientId"`
	StartAt         string  `json:"startAt"`
	EndAt           string  `json:"endAt"`
	DurationMinutes int     `json:"durationMinutes"`
	TreatmentPlan   string  `json:"treatmentPlan"`
	PaymentAmount   float64 `json:"paymentAmount"`
	PaymentMethod   string  `json:"paymentMethod"`
}

func (s *AppointmentService) Create(ctx context.Context, in CreateAppointmentInput) (domain.Appointment, error) {
	if in.DoctorID == "" || in.PatientID == "" || in.StartAt == "" {
		return domain.Appointment{}, fmt.Errorf("doctorId, patientId and startAt are required")
	}
	startAt, err := time.Parse(time.RFC3339, in.StartAt)
	if err != nil {
		return domain.Appointment{}, fmt.Errorf("invalid startAt")
	}
	// Determine duration: prefer DurationMinutes, fallback to EndAt, default 30 min
	durationMinutes := in.DurationMinutes
	if durationMinutes <= 0 {
		durationMinutes = 30
	}
	var endAt time.Time
	if in.EndAt != "" {
		parsed, err := time.Parse(time.RFC3339, in.EndAt)
		if err != nil {
			return domain.Appointment{}, fmt.Errorf("invalid endAt")
		}
		endAt = parsed
		durationMinutes = int(endAt.Sub(startAt).Minutes())
	} else {
		endAt = startAt.Add(time.Duration(durationMinutes) * time.Minute)
	}
	// Resolve clinic timezone for human-friendly messages
	loc := time.Local
	if tz := os.Getenv("CLINIC_TZ"); tz != "" {
		if l, lerr := time.LoadLocation(tz); lerr == nil {
			loc = l
		}
	}

	// Validate for overlapping appointments
	existingAppointments, err := s.repo.ListByDoctorAndDay(ctx, in.DoctorID, startAt)
	if err != nil {
		return domain.Appointment{}, fmt.Errorf("could not verify existing appointments: %w", err)
	}

	for _, existing := range existingAppointments {
		if existing.Status == "cancelled" {
			continue
		}
		if startAt.Before(existing.EndAt) && endAt.After(existing.StartAt) {
			return domain.Appointment{}, fmt.Errorf("el horario de %s a %s ya está ocupado", startAt.In(loc).Format("15:04"), endAt.In(loc).Format("15:04"))
		}
	}

	confirmToken, _ := generateAppointmentToken()
	appt := domain.Appointment{
		ID:              buildID("apt"),
		DoctorID:        in.DoctorID,
		PatientID:       in.PatientID,
		StartAt:         startAt.UTC(),
		EndAt:           endAt.UTC(),
		DurationMinutes: durationMinutes,
		Status:          "scheduled",
		TreatmentPlan:   in.TreatmentPlan,
		PaymentAmount:   in.PaymentAmount,
		PaymentMethod:   in.PaymentMethod,
		ConfirmToken:    confirmToken,
	}
	created, err := s.repo.Create(ctx, appt)
	if err != nil {
		return domain.Appointment{}, err
	}
	if email, name := s.patientEmail(ctx, created.PatientID); email != "" {
		if s.notifier != nil {
			ctx, orgID := s.ensureOrgContext(ctx, created.DoctorID)
			var consentLinks []notifications.ConsentLink
			if s.consents != nil && orgID != "" {
				if list, cerr := s.consents.CreateConsentsForAppointment(ctx, created.ID, orgID, created.PatientID, created.DoctorID, email, name, created.StartAt.In(loc)); cerr == nil {
					for _, c := range list {
						if c.AcceptToken != "" {
							consentLinks = append(consentLinks, notifications.ConsentLink{Title: c.Title, Token: c.AcceptToken})
						}
					}
				}
			}
			if len(consentLinks) == 0 && orgID != "" {
				log.Printf("[appointment] create: no consent templates active for org %s — configure plantillas de consentimiento (asistencia + tratamiento)", orgID)
			}
			_ = s.notifier.SendAppointmentCreated(ctx, email, name, created, consentLinks)
		}
	}
	return created, nil
}

func (s *AppointmentService) GetByID(ctx context.Context, id string) (domain.Appointment, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *AppointmentService) ListByPatient(ctx context.Context, patientID string) ([]domain.Appointment, error) {
	return s.repo.ListByPatient(ctx, patientID)
}

func (s *AppointmentService) ListByDoctorAndDate(ctx context.Context, doctorID, date string) ([]domain.Appointment, error) {
	day := time.Now().UTC()
	if date != "" {
		parsed, err := time.Parse("2006-01-02", date)
		if err != nil {
			return nil, fmt.Errorf("invalid date format use YYYY-MM-DD")
		}
		day = parsed
	}
	return s.repo.ListByDoctorAndDay(ctx, doctorID, day)
}

func (s *AppointmentService) Confirm(ctx context.Context, appointmentID string) (domain.Appointment, error) {
	item, err := s.repo.GetByID(ctx, appointmentID)
	if err != nil {
		return domain.Appointment{}, err
	}
	now := time.Now().UTC()
	item.Status = "confirmed"
	item.PatientConfirmedAt = &now
	updated, err := s.repo.Update(ctx, item)
	if err != nil {
		return domain.Appointment{}, err
	}
	if s.notifier != nil {
		loc := time.Local
		if tz := os.Getenv("CLINIC_TZ"); tz != "" {
			if l, lerr := time.LoadLocation(tz); lerr == nil {
				loc = l
			}
		}
		if email, name := s.patientEmail(ctx, updated.PatientID); email != "" {
			_ = s.notifier.SendAppointmentEvent(ctx, email, name, "confirmed", updated.StartAt.In(loc), updated.EndAt.In(loc))
		}
	}
	return updated, nil
}

func (s *AppointmentService) CloseDayForAppointment(ctx context.Context, appointmentID, evolutionNotes string, paymentAmount float64, paymentMethod, treatmentPlan string) (domain.Appointment, error) {
	item, err := s.repo.GetByID(ctx, appointmentID)
	if err != nil {
		return domain.Appointment{}, err
	}
	now := time.Now().UTC()
	item.Status = "completed"
	item.DoctorDailyClosedAt = &now
	item.EvolutionNotes = evolutionNotes
	if paymentAmount > 0 {
		item.PaymentAmount = paymentAmount
	}
	if paymentMethod != "" {
		item.PaymentMethod = paymentMethod
	}
	if strings.TrimSpace(treatmentPlan) != "" {
		item.TreatmentPlan = treatmentPlan
	}
	updated, err := s.repo.Update(ctx, item)
	if err != nil {
		return domain.Appointment{}, err
	}
	if s.notifier != nil {
		loc := time.Local
		if tz := os.Getenv("CLINIC_TZ"); tz != "" {
			if l, lerr := time.LoadLocation(tz); lerr == nil {
				loc = l
			}
		}
		if email, name := s.patientEmail(ctx, updated.PatientID); email != "" {
			_ = s.notifier.SendAppointmentEvent(ctx, email, name, "completed", updated.StartAt.In(loc), updated.EndAt.In(loc))
			if strings.TrimSpace(updated.TreatmentPlan) != "" {
				_ = s.notifier.SendTreatmentPlanSummary(ctx, email, name, updated.TreatmentPlan, updated.StartAt.In(loc))
			}
		}
	}
	return updated, nil
}

func (s *AppointmentService) Send24hReminder(ctx context.Context, appointmentID, channel string) error {
	item, err := s.repo.GetByID(ctx, appointmentID)
	if err != nil {
		return err
	}
	if time.Until(item.StartAt).Hours() > 24.1 || time.Until(item.StartAt).Hours() < 23.9 {
		return fmt.Errorf("appointment is not in 24h window")
	}
	// Mismo email que creación/reenvío: confirmación + todos los consentimientos (asistencia y tratamiento)
	if s.notifier != nil {
		email, name := s.patientEmail(ctx, item.PatientID)
		if email != "" {
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
			if len(consentLinks) == 0 && orgID != "" {
				log.Printf("[appointment] 24h reminder: no consent templates active for org %s", orgID)
			}
			_ = s.notifier.SendAppointmentCreated(ctx, email, name, item, consentLinks)
		}
	}
	now := time.Now().UTC()
	item.ReminderSentAt = &now
	_, err = s.repo.Update(ctx, item)
	return err
}

func (s *AppointmentService) SendDoctorCloseDayReminder(ctx context.Context, doctorID, channel string) error {
	message := "Recuerda cerrar tu agenda al final del día y registrar evolución/pago de cada cita."
	return s.notifier.SendDoctorDailySummary(ctx, doctorID, channel, message)
}

type UpdateAppointmentInput struct {
	DoctorID      string   `json:"doctorId"`
	PatientID     string   `json:"patientId"`
	StartAt       string   `json:"startAt"`
	EndAt         string   `json:"endAt"`
	Status        string   `json:"status"`
	TreatmentPlan string   `json:"treatmentPlan"`
	PaymentAmount float64  `json:"paymentAmount"`
	PaymentMethod string   `json:"paymentMethod"`
	ImageKeys     []string `json:"imageKeys"`
}

func (s *AppointmentService) UpdateAppointment(ctx context.Context, id string, in UpdateAppointmentInput) (domain.Appointment, error) {
	appt, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.Appointment{}, err
	}
	loc := time.Local
	if tz := os.Getenv("CLINIC_TZ"); tz != "" {
		if l, lerr := time.LoadLocation(tz); lerr == nil {
			loc = l
		}
	}
	prevStatus := appt.Status
	prevStart := appt.StartAt
	if in.StartAt != "" {
		t, err := time.Parse(time.RFC3339, in.StartAt)
		if err != nil {
			return domain.Appointment{}, fmt.Errorf("invalid startAt")
		}
		appt.StartAt = t.UTC()
	}
	if in.EndAt != "" {
		t, err := time.Parse(time.RFC3339, in.EndAt)
		if err != nil {
			return domain.Appointment{}, fmt.Errorf("invalid endAt")
		}
		appt.EndAt = t.UTC()
	}
	if in.Status != "" {
		appt.Status = in.Status
	}
	if in.TreatmentPlan != "" {
		appt.TreatmentPlan = in.TreatmentPlan
	}
	if in.PaymentAmount > 0 {
		appt.PaymentAmount = in.PaymentAmount
	}
	if in.PaymentMethod != "" {
		appt.PaymentMethod = in.PaymentMethod
	}
	if len(in.ImageKeys) > 0 {
		appt.ImageKeys = append(appt.ImageKeys, in.ImageKeys...)
	}
	updated, err := s.repo.Update(ctx, appt)
	if err != nil {
		return domain.Appointment{}, err
	}
	if s.notifier != nil {
		if email, name := s.patientEmail(ctx, updated.PatientID); email != "" {
			eventType := "updated"
			if in.Status == "cancelled" && prevStatus != "cancelled" {
				eventType = "cancelled"
			} else if in.StartAt != "" && !updated.StartAt.Equal(prevStart) {
				eventType = "moved"
			}
			_ = s.notifier.SendAppointmentEvent(ctx, email, name, eventType, updated.StartAt.In(loc), updated.EndAt.In(loc))
		}
	}
	return updated, nil
}

func (s *AppointmentService) Delete(ctx context.Context, id string) error {
	if _, err := s.repo.GetByID(ctx, id); err != nil {
		return err
	}
	return s.repo.Delete(ctx, id)
}

type RegisterPaymentInput struct {
	Paid          bool    `json:"paid"`
	PaymentMethod string  `json:"paymentMethod"`
	PaymentAmount float64 `json:"paymentAmount"`
}

func (s *AppointmentService) RegisterPayment(ctx context.Context, id string, in RegisterPaymentInput) (domain.Appointment, error) {
	appt, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.Appointment{}, fmt.Errorf("appointment not found")
	}
	appt.PaymentPaid = in.Paid
	if in.PaymentMethod != "" {
		appt.PaymentMethod = in.PaymentMethod
	}
	if in.PaymentAmount > 0 {
		appt.PaymentAmount = in.PaymentAmount
	}
	if in.Paid {
		appt.Status = "completed"
	}
	return s.repo.Update(ctx, appt)
}

func (s *AppointmentService) ConfirmByToken(ctx context.Context, token string) (domain.Appointment, error) {
	appt, err := s.repo.GetByConfirmToken(ctx, token)
	if err != nil {
		return domain.Appointment{}, fmt.Errorf("enlace inválido o expirado")
	}
	if appt.Status == "confirmed" || appt.Status == "completed" {
		return appt, nil // idempotent
	}
	now := time.Now().UTC()
	appt.Status = "confirmed"
	appt.PatientConfirmedAt = &now
	return s.repo.Update(ctx, appt)
}

func generateAppointmentToken() (string, error) {
	b := make([]byte, 20)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

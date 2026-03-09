package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"clinical-backend/internal/domain"
	"clinical-backend/internal/store"
)

type PaymentService struct {
	repo     store.PaymentRepository
	patients store.PatientRepository
	users    store.AuthRepository
}

func NewPaymentService(repo store.PaymentRepository, opts ...func(*PaymentService)) *PaymentService {
	s := &PaymentService{repo: repo}
	for _, o := range opts {
		o(s)
	}
	return s
}

func WithPaymentPatientRepo(r store.PatientRepository) func(*PaymentService) {
	return func(s *PaymentService) { s.patients = r }
}

func WithPaymentUserRepo(r store.AuthRepository) func(*PaymentService) {
	return func(s *PaymentService) { s.users = r }
}

type CreatePaymentInput struct {
	AppointmentID string  `json:"appointmentId"`
	PatientID     string  `json:"patientId"`
	DoctorID      string  `json:"doctorId"`
	Amount        float64 `json:"amount"`
	PaymentType   string  `json:"paymentType"`   // "pago_completo", "abono"
	PaymentMethod string  `json:"paymentMethod"` // efectivo, transferencia, etc.
	Currency      string  `json:"currency"`      // USD, VES
	Notes         string  `json:"notes"`
}

func (s *PaymentService) CreatePayment(ctx context.Context, in CreatePaymentInput) (domain.PaymentRecord, error) {
	if in.PatientID == "" {
		return domain.PaymentRecord{}, fmt.Errorf("patientId is required")
	}
	if in.Amount <= 0 {
		return domain.PaymentRecord{}, fmt.Errorf("amount must be positive")
	}
	currency := in.Currency
	if currency == "" {
		currency = "USD"
	}
	paymentType := in.PaymentType
	if paymentType == "" {
		paymentType = "pago_completo"
	}

	p := domain.PaymentRecord{
		ID:            buildID("pay"),
		AppointmentID: in.AppointmentID,
		PatientID:     in.PatientID,
		DoctorID:      in.DoctorID,
		Amount:        in.Amount,
		PaymentType:   paymentType,
		PaymentMethod: in.PaymentMethod,
		Currency:      currency,
		Notes:         in.Notes,
		CreatedAt:     time.Now().UTC(),
	}

	// Enrich with names at write time
	if s.patients != nil && in.PatientID != "" {
		if pat, err := s.patients.GetByID(ctx, in.PatientID); err == nil {
			p.PatientName = strings.TrimSpace(pat.FirstName + " " + pat.LastName)
		}
	}
	if s.users != nil && in.DoctorID != "" {
		if u, err := s.users.GetUserByID(ctx, in.DoctorID); err == nil {
			p.DoctorName = u.Name
		}
	}

	return s.repo.Create(ctx, p)
}

func (s *PaymentService) ListPaymentsByOrg(ctx context.Context, limit int) ([]domain.PaymentRecord, error) {
	payments, err := s.repo.ListByOrg(ctx, limit)
	if err != nil {
		return nil, err
	}
	s.enrichPayments(ctx, payments)
	return payments, nil
}

func (s *PaymentService) ListPaymentsByPatient(ctx context.Context, patientID string) ([]domain.PaymentRecord, error) {
	payments, err := s.repo.ListByPatient(ctx, patientID)
	if err != nil {
		return nil, err
	}
	s.enrichPayments(ctx, payments)
	return payments, nil
}

// enrichPayments fills PatientName and DoctorName when missing, using cached lookups.
func (s *PaymentService) enrichPayments(ctx context.Context, payments []domain.PaymentRecord) {
	if len(payments) == 0 {
		return
	}

	patientCache := map[string]string{}
	doctorCache := map[string]string{}

	for i := range payments {
		p := &payments[i]

		if p.PatientName == "" && s.patients != nil && p.PatientID != "" {
			if name, ok := patientCache[p.PatientID]; ok {
				p.PatientName = name
			} else {
				if pat, err := s.patients.GetByID(ctx, p.PatientID); err == nil {
					name = strings.TrimSpace(pat.FirstName + " " + pat.LastName)
				}
				patientCache[p.PatientID] = name
				p.PatientName = name
			}
		}

		if p.DoctorName == "" && s.users != nil && p.DoctorID != "" {
			if name, ok := doctorCache[p.DoctorID]; ok {
				p.DoctorName = name
			} else {
				if u, err := s.users.GetUserByID(ctx, p.DoctorID); err == nil {
					name = u.Name
				}
				doctorCache[p.DoctorID] = name
				p.DoctorName = name
			}
		}
	}
}

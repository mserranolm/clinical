package service

import (
	"context"
	"fmt"
	"time"

	"clinical-backend/internal/domain"
	"clinical-backend/internal/store"
)

type PaymentService struct {
	repo store.PaymentRepository
}

func NewPaymentService(repo store.PaymentRepository) *PaymentService {
	return &PaymentService{repo: repo}
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
	return s.repo.Create(ctx, p)
}

func (s *PaymentService) ListPaymentsByOrg(ctx context.Context, limit int) ([]domain.PaymentRecord, error) {
	return s.repo.ListByOrg(ctx, limit)
}

func (s *PaymentService) ListPaymentsByPatient(ctx context.Context, patientID string) ([]domain.PaymentRecord, error) {
	return s.repo.ListByPatient(ctx, patientID)
}

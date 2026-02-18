package service

import (
	"context"
	"fmt"
	"time"

	"clinical-backend/internal/domain"
	"clinical-backend/internal/notifications"
	"clinical-backend/internal/store"
)

type ConsentService struct {
	repo     store.ConsentRepository
	notifier notifications.Notifier
}

func NewConsentService(repo store.ConsentRepository, notifier notifications.Notifier) *ConsentService {
	return &ConsentService{repo: repo, notifier: notifier}
}

type CreateConsentInput struct {
	PatientID      string `json:"patientId"`
	DoctorID       string `json:"doctorId"`
	Title          string `json:"title"`
	Content        string `json:"content"`
	DeliveryMethod string `json:"deliveryMethod"`
}

func (s *ConsentService) CreateAndSend(ctx context.Context, in CreateConsentInput) (domain.Consent, error) {
	if in.PatientID == "" || in.DoctorID == "" || in.Title == "" || in.Content == "" {
		return domain.Consent{}, fmt.Errorf("patientId, doctorId, title and content are required")
	}
	if in.DeliveryMethod == "" {
		in.DeliveryMethod = "email"
	}
	consent := domain.Consent{
		ID:             buildID("cns"),
		PatientID:      in.PatientID,
		DoctorID:       in.DoctorID,
		Title:          in.Title,
		Content:        in.Content,
		DeliveryMethod: in.DeliveryMethod,
		Status:         "sent",
		CreatedAt:      time.Now().UTC(),
	}
	created, err := s.repo.Create(ctx, consent)
	if err != nil {
		return domain.Consent{}, err
	}
	msg := fmt.Sprintf("Consentimiento informado: %s", in.Title)
	if err := s.notifier.SendConsentRequest(ctx, in.PatientID, in.DeliveryMethod, msg); err != nil {
		return domain.Consent{}, err
	}
	return created, nil
}

func (s *ConsentService) Accept(ctx context.Context, consentID string) (domain.Consent, error) {
	consent, err := s.repo.GetByID(ctx, consentID)
	if err != nil {
		return domain.Consent{}, err
	}
	now := time.Now().UTC()
	consent.Status = "accepted"
	consent.AcceptedAt = &now
	return s.repo.Update(ctx, consent)
}

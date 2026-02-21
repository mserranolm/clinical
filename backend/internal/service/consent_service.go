package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"clinical-backend/internal/domain"
	"clinical-backend/internal/notifications"
	"clinical-backend/internal/store"
)

type ConsentService struct {
	repo         store.ConsentRepository
	templateRepo store.ConsentTemplateRepository
	notifier     notifications.Notifier
}

func NewConsentService(repo store.ConsentRepository, templateRepo store.ConsentTemplateRepository, notifier notifications.Notifier) *ConsentService {
	return &ConsentService{repo: repo, templateRepo: templateRepo, notifier: notifier}
}

// ── Template management ──────────────────────────────────────────────────────

type CreateConsentTemplateInput struct {
	OrgID     string `json:"orgId"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	IsActive  bool   `json:"isActive"`
	CreatedBy string `json:"createdBy"`
}

type UpdateConsentTemplateInput struct {
	Title    string `json:"title"`
	Content  string `json:"content"`
	IsActive *bool  `json:"isActive"`
}

func (s *ConsentService) CreateTemplate(ctx context.Context, in CreateConsentTemplateInput) (domain.ConsentTemplate, error) {
	if in.OrgID == "" || in.Title == "" || in.Content == "" {
		return domain.ConsentTemplate{}, fmt.Errorf("orgId, title and content are required")
	}
	now := time.Now().UTC()
	t := domain.ConsentTemplate{
		ID:        buildID("ctpl"),
		OrgID:     in.OrgID,
		Title:     in.Title,
		Content:   in.Content,
		IsActive:  in.IsActive,
		CreatedBy: in.CreatedBy,
		CreatedAt: now,
		UpdatedAt: now,
	}
	return s.templateRepo.Create(ctx, t)
}

func (s *ConsentService) UpdateTemplate(ctx context.Context, id string, in UpdateConsentTemplateInput) (domain.ConsentTemplate, error) {
	t, err := s.templateRepo.GetByID(ctx, id)
	if err != nil {
		return domain.ConsentTemplate{}, err
	}
	if in.Title != "" {
		t.Title = in.Title
	}
	if in.Content != "" {
		t.Content = in.Content
	}
	if in.IsActive != nil {
		t.IsActive = *in.IsActive
	}
	t.UpdatedAt = time.Now().UTC()
	return s.templateRepo.Update(ctx, t)
}

func (s *ConsentService) GetTemplate(ctx context.Context, id string) (domain.ConsentTemplate, error) {
	return s.templateRepo.GetByID(ctx, id)
}

func (s *ConsentService) ListTemplates(ctx context.Context, orgID string) ([]domain.ConsentTemplate, error) {
	items, err := s.templateRepo.ListByOrg(ctx, orgID)
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []domain.ConsentTemplate{}
	}
	return items, nil
}

// ── Consent instance management ──────────────────────────────────────────────

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
	token, err := generateToken()
	if err != nil {
		return domain.Consent{}, err
	}
	consent := domain.Consent{
		ID:             buildID("cns"),
		PatientID:      in.PatientID,
		DoctorID:       in.DoctorID,
		Title:          in.Title,
		Content:        in.Content,
		DeliveryMethod: in.DeliveryMethod,
		Status:         "sent",
		AcceptToken:    token,
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

// CreateForAppointment creates a consent linked to an appointment and sends the email with accept link.
func (s *ConsentService) CreateForAppointment(ctx context.Context, appointmentID, orgID, patientID, doctorID, patientEmail, patientName string, startAt time.Time) (domain.Consent, error) {
	tmpl, err := s.templateRepo.GetActiveByOrg(ctx, orgID)
	if err != nil {
		// No active template — skip silently
		return domain.Consent{}, nil
	}
	token, err := generateToken()
	if err != nil {
		return domain.Consent{}, err
	}
	consent := domain.Consent{
		ID:             buildID("cns"),
		PatientID:      patientID,
		DoctorID:       doctorID,
		AppointmentID:  appointmentID,
		TemplateID:     tmpl.ID,
		Title:          tmpl.Title,
		Content:        tmpl.Content,
		DeliveryMethod: "email",
		Status:         "pending",
		AcceptToken:    token,
		CreatedAt:      time.Now().UTC(),
	}
	created, err := s.repo.Create(ctx, consent)
	if err != nil {
		return domain.Consent{}, err
	}
	_ = s.notifier.SendConsentWithAppointment(ctx, patientEmail, patientName, created, startAt)
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

// AcceptByToken accepts a consent by its public accept token and returns the consent + appointmentID.
func (s *ConsentService) AcceptByToken(ctx context.Context, token string) (domain.Consent, error) {
	consent, err := s.repo.GetByToken(ctx, token)
	if err != nil {
		return domain.Consent{}, fmt.Errorf("enlace inválido o expirado")
	}
	if consent.Status == "accepted" {
		return consent, nil // idempotent
	}
	now := time.Now().UTC()
	consent.Status = "accepted"
	consent.AcceptedAt = &now
	return s.repo.Update(ctx, consent)
}

func (s *ConsentService) GetByAppointmentID(ctx context.Context, appointmentID string) (domain.Consent, error) {
	return s.repo.GetByAppointmentID(ctx, appointmentID)
}

// ── helpers ──────────────────────────────────────────────────────────────────

func generateToken() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

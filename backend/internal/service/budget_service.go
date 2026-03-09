package service

import (
	"context"
	"fmt"
	"time"

	"clinical-backend/internal/domain"
	"clinical-backend/internal/store"
)

type BudgetService struct {
	repo store.BudgetRepository
}

func NewBudgetService(repo store.BudgetRepository) *BudgetService {
	return &BudgetService{repo: repo}
}

type CreateBudgetInput struct {
	PatientID  string             `json:"patientId"`
	DoctorID   string             `json:"doctorId"`
	Title      string             `json:"title"`
	Items      []domain.BudgetItem `json:"items"`
	Currency   string             `json:"currency"`
	Status     string             `json:"status"`
	Notes      string             `json:"notes"`
	ValidUntil *time.Time         `json:"validUntil,omitempty"`
}

func (s *BudgetService) CreateBudget(ctx context.Context, in CreateBudgetInput) (domain.Budget, error) {
	if in.PatientID == "" || in.Title == "" {
		return domain.Budget{}, fmt.Errorf("patientId and title are required")
	}
	currency := in.Currency
	if currency == "" {
		currency = "USD"
	}
	status := in.Status
	if status == "" {
		status = "draft"
	}

	// Ensure items have IDs and compute totals
	var total float64
	items := make([]domain.BudgetItem, len(in.Items))
	for i, item := range in.Items {
		if item.ID == "" {
			item.ID = buildID("bgi")
		}
		item.Total = float64(item.Quantity) * item.UnitPrice
		if item.Status == "" {
			item.Status = "pending"
		}
		items[i] = item
		total += item.Total
	}

	now := time.Now().UTC()
	b := domain.Budget{
		ID:          buildID("bgt"),
		PatientID:   in.PatientID,
		DoctorID:    in.DoctorID,
		Title:       in.Title,
		Items:       items,
		TotalAmount: total,
		Currency:    currency,
		Status:      status,
		Notes:       in.Notes,
		ValidUntil:  in.ValidUntil,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	return s.repo.Create(ctx, b)
}

func (s *BudgetService) GetBudget(ctx context.Context, id string) (domain.Budget, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *BudgetService) ListBudgetsByPatient(ctx context.Context, patientID string) ([]domain.Budget, error) {
	return s.repo.ListByPatient(ctx, patientID)
}

type UpdateBudgetInput struct {
	Title      string             `json:"title"`
	Items      []domain.BudgetItem `json:"items"`
	Currency   string             `json:"currency"`
	Status     string             `json:"status"`
	Notes      string             `json:"notes"`
	ValidUntil *time.Time         `json:"validUntil,omitempty"`
}

func (s *BudgetService) UpdateBudget(ctx context.Context, id string, in UpdateBudgetInput) (domain.Budget, error) {
	b, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.Budget{}, fmt.Errorf("budget not found: %w", err)
	}
	if in.Title != "" {
		b.Title = in.Title
	}
	if in.Items != nil {
		var total float64
		items := make([]domain.BudgetItem, len(in.Items))
		for i, item := range in.Items {
			if item.ID == "" {
				item.ID = buildID("bgi")
			}
			item.Total = float64(item.Quantity) * item.UnitPrice
			if item.Status == "" {
				item.Status = "pending"
			}
			items[i] = item
			total += item.Total
		}
		b.Items = items
		b.TotalAmount = total
	}
	if in.Currency != "" {
		b.Currency = in.Currency
	}
	if in.Status != "" {
		b.Status = in.Status
	}
	if in.Notes != "" {
		b.Notes = in.Notes
	}
	if in.ValidUntil != nil {
		b.ValidUntil = in.ValidUntil
	}
	b.UpdatedAt = time.Now().UTC()
	return s.repo.Update(ctx, b)
}

func (s *BudgetService) DeleteBudget(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

package service

import (
	"context"
	"fmt"
	"time"

	"clinical-backend/internal/domain"
	"clinical-backend/internal/store"
)

type PatientService struct {
	repo store.PatientRepository
}

func NewPatientService(repo store.PatientRepository) *PatientService {
	return &PatientService{repo: repo}
}

type CreatePatientInput struct {
	DoctorID           string                     `json:"doctorId"`
	Specialty          string                     `json:"specialty"`
	FirstName          string                     `json:"firstName"`
	LastName           string                     `json:"lastName"`
	DocumentID         string                     `json:"documentId"`
	Phone              string                     `json:"phone"`
	Email              string                     `json:"email"`
	BirthDate          string                     `json:"birthDate"`
	MedicalBackgrounds []domain.MedicalBackground `json:"medicalBackgrounds"`
	ImageKeys          []string                   `json:"imageKeys"`
}

func (s *PatientService) Onboard(ctx context.Context, in CreatePatientInput) (domain.Patient, error) {
	if in.DoctorID == "" || in.FirstName == "" || in.LastName == "" {
		return domain.Patient{}, fmt.Errorf("doctorId, firstName and lastName are required")
	}

	specialty := domain.SpecialtyOdontology
	if in.Specialty != "" {
		specialty = domain.Specialty(in.Specialty)
	}

	patient := domain.Patient{
		ID:                 buildID("pat"),
		DoctorID:           in.DoctorID,
		Specialty:          specialty,
		FirstName:          in.FirstName,
		LastName:           in.LastName,
		DocumentID:         in.DocumentID,
		Phone:              in.Phone,
		Email:              in.Email,
		BirthDate:          in.BirthDate,
		MedicalBackgrounds: in.MedicalBackgrounds,
		ImageKeys:          in.ImageKeys,
		CreatedAt:          time.Now().UTC(),
	}
	return s.repo.Create(ctx, patient)
}

func (s *PatientService) GetByID(ctx context.Context, id string) (domain.Patient, error) {
	if id == "" {
		return domain.Patient{}, fmt.Errorf("patient id required")
	}
	return s.repo.GetByID(ctx, id)
}

func (s *PatientService) ListByDoctor(ctx context.Context, doctorID string) ([]domain.Patient, error) {
	return s.repo.ListByDoctor(ctx, doctorID)
}

func (s *PatientService) Search(ctx context.Context, doctorID, query string) ([]domain.Patient, error) {
	if query == "" {
		return nil, fmt.Errorf("query is required")
	}
	return s.repo.SearchByQuery(ctx, doctorID, query)
}

type UpdatePatientInput struct {
	FirstName          string                     `json:"firstName"`
	LastName           string                     `json:"lastName"`
	DocumentID         string                     `json:"documentId"`
	Phone              string                     `json:"phone"`
	Email              string                     `json:"email"`
	BirthDate          string                     `json:"birthDate"`
	MedicalBackgrounds []domain.MedicalBackground `json:"medicalBackgrounds"`
}

func (s *PatientService) Update(ctx context.Context, patientID string, in UpdatePatientInput) (domain.Patient, error) {
	patient, err := s.repo.GetByID(ctx, patientID)
	if err != nil {
		return domain.Patient{}, fmt.Errorf("patient not found: %w", err)
	}

	if in.FirstName != "" {
		patient.FirstName = in.FirstName
	}
	if in.LastName != "" {
		patient.LastName = in.LastName
	}
	if in.DocumentID != "" {
		patient.DocumentID = in.DocumentID
	}
	if in.Phone != "" {
		patient.Phone = in.Phone
	}
	if in.Email != "" {
		patient.Email = in.Email
	}
	if in.BirthDate != "" {
		patient.BirthDate = in.BirthDate
	}
	if in.MedicalBackgrounds != nil {
		patient.MedicalBackgrounds = in.MedicalBackgrounds
	}

	now := time.Now().UTC()
	patient.UpdatedAt = &now

	return s.repo.Update(ctx, patient)
}

func (s *PatientService) Delete(ctx context.Context, patientID string) error {
	return s.repo.Delete(ctx, patientID)
}

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

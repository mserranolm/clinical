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
	// Extended fields (Feature 3)
	DocumentType            string  `json:"documentType,omitempty"`
	SecondName              string  `json:"secondName,omitempty"`
	SecondLastName          string  `json:"secondLastName,omitempty"`
	Occupation              string  `json:"occupation,omitempty"`
	Insurance               string  `json:"insurance,omitempty"`
	HomePhone               string  `json:"homePhone,omitempty"`
	EmergencyContact        string  `json:"emergencyContact,omitempty"`
	EmergencyPhone          string  `json:"emergencyPhone,omitempty"`
	BirthCountry            string  `json:"birthCountry,omitempty"`
	ResidenceCountry        string  `json:"residenceCountry,omitempty"`
	ResidenceAddress        string  `json:"residenceAddress,omitempty"`
	Gender                  string  `json:"gender,omitempty"`
	CivilStatus             string  `json:"civilStatus,omitempty"`
	HeightCm                int     `json:"heightCm,omitempty"`
	WeightKg                float64 `json:"weightKg,omitempty"`
	BloodType               string  `json:"bloodType,omitempty"`
	PatientNotes            string  `json:"patientNotes,omitempty"`
	HasRepresentative       bool    `json:"hasRepresentative,omitempty"`
	RepresentativeRelation  string  `json:"representativeRelation,omitempty"`
	RepresentativeName      string  `json:"representativeName,omitempty"`
	RepresentativeDocType   string  `json:"representativeDocType,omitempty"`
	RepresentativeDocId     string  `json:"representativeDocId,omitempty"`
	RepresentativePhone     string  `json:"representativePhone,omitempty"`
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
		ID:                      buildID("pat"),
		DoctorID:                in.DoctorID,
		Specialty:               specialty,
		FirstName:               in.FirstName,
		LastName:                in.LastName,
		DocumentID:              in.DocumentID,
		Phone:                   in.Phone,
		Email:                   in.Email,
		BirthDate:               in.BirthDate,
		MedicalBackgrounds:      in.MedicalBackgrounds,
		ImageKeys:               in.ImageKeys,
		CreatedAt:               time.Now().UTC(),
		DocumentType:            in.DocumentType,
		SecondName:              in.SecondName,
		SecondLastName:          in.SecondLastName,
		Occupation:              in.Occupation,
		Insurance:               in.Insurance,
		HomePhone:               in.HomePhone,
		EmergencyContact:        in.EmergencyContact,
		EmergencyPhone:          in.EmergencyPhone,
		BirthCountry:            in.BirthCountry,
		ResidenceCountry:        in.ResidenceCountry,
		ResidenceAddress:        in.ResidenceAddress,
		Gender:                  in.Gender,
		CivilStatus:             in.CivilStatus,
		HeightCm:                in.HeightCm,
		WeightKg:                in.WeightKg,
		BloodType:               in.BloodType,
		PatientNotes:            in.PatientNotes,
		HasRepresentative:       in.HasRepresentative,
		RepresentativeRelation:  in.RepresentativeRelation,
		RepresentativeName:      in.RepresentativeName,
		RepresentativeDocType:   in.RepresentativeDocType,
		RepresentativeDocId:     in.RepresentativeDocId,
		RepresentativePhone:     in.RepresentativePhone,
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
	// Extended fields (Feature 3)
	DocumentType            string  `json:"documentType,omitempty"`
	SecondName              string  `json:"secondName,omitempty"`
	SecondLastName          string  `json:"secondLastName,omitempty"`
	Occupation              string  `json:"occupation,omitempty"`
	Insurance               string  `json:"insurance,omitempty"`
	HomePhone               string  `json:"homePhone,omitempty"`
	EmergencyContact        string  `json:"emergencyContact,omitempty"`
	EmergencyPhone          string  `json:"emergencyPhone,omitempty"`
	BirthCountry            string  `json:"birthCountry,omitempty"`
	ResidenceCountry        string  `json:"residenceCountry,omitempty"`
	ResidenceAddress        string  `json:"residenceAddress,omitempty"`
	Gender                  string  `json:"gender,omitempty"`
	CivilStatus             string  `json:"civilStatus,omitempty"`
	HeightCm                int     `json:"heightCm,omitempty"`
	WeightKg                float64 `json:"weightKg,omitempty"`
	BloodType               string  `json:"bloodType,omitempty"`
	PatientNotes            string  `json:"patientNotes,omitempty"`
	HasRepresentative       bool    `json:"hasRepresentative,omitempty"`
	RepresentativeRelation  string  `json:"representativeRelation,omitempty"`
	RepresentativeName      string  `json:"representativeName,omitempty"`
	RepresentativeDocType   string  `json:"representativeDocType,omitempty"`
	RepresentativeDocId     string  `json:"representativeDocId,omitempty"`
	RepresentativePhone     string  `json:"representativePhone,omitempty"`
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
	if in.DocumentType != "" {
		patient.DocumentType = in.DocumentType
	}
	if in.SecondName != "" {
		patient.SecondName = in.SecondName
	}
	if in.SecondLastName != "" {
		patient.SecondLastName = in.SecondLastName
	}
	if in.Occupation != "" {
		patient.Occupation = in.Occupation
	}
	if in.Insurance != "" {
		patient.Insurance = in.Insurance
	}
	if in.HomePhone != "" {
		patient.HomePhone = in.HomePhone
	}
	if in.EmergencyContact != "" {
		patient.EmergencyContact = in.EmergencyContact
	}
	if in.EmergencyPhone != "" {
		patient.EmergencyPhone = in.EmergencyPhone
	}
	if in.BirthCountry != "" {
		patient.BirthCountry = in.BirthCountry
	}
	if in.ResidenceCountry != "" {
		patient.ResidenceCountry = in.ResidenceCountry
	}
	if in.ResidenceAddress != "" {
		patient.ResidenceAddress = in.ResidenceAddress
	}
	if in.Gender != "" {
		patient.Gender = in.Gender
	}
	if in.CivilStatus != "" {
		patient.CivilStatus = in.CivilStatus
	}
	if in.HeightCm > 0 {
		patient.HeightCm = in.HeightCm
	}
	if in.WeightKg > 0 {
		patient.WeightKg = in.WeightKg
	}
	if in.BloodType != "" {
		patient.BloodType = in.BloodType
	}
	if in.PatientNotes != "" {
		patient.PatientNotes = in.PatientNotes
	}
	patient.HasRepresentative = in.HasRepresentative
	if in.RepresentativeRelation != "" {
		patient.RepresentativeRelation = in.RepresentativeRelation
	}
	if in.RepresentativeName != "" {
		patient.RepresentativeName = in.RepresentativeName
	}
	if in.RepresentativeDocType != "" {
		patient.RepresentativeDocType = in.RepresentativeDocType
	}
	if in.RepresentativeDocId != "" {
		patient.RepresentativeDocId = in.RepresentativeDocId
	}
	if in.RepresentativePhone != "" {
		patient.RepresentativePhone = in.RepresentativePhone
	}

	now := time.Now().UTC()
	patient.UpdatedAt = &now

	return s.repo.Update(ctx, patient)
}

func (s *PatientService) Delete(ctx context.Context, patientID string) error {
	return s.repo.Delete(ctx, patientID)
}

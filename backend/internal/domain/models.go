package domain

import "time"

type Specialty string

const (
	SpecialtyOdontology Specialty = "odontology"
)

type Patient struct {
	ID                 string             `json:"id"`
	DoctorID           string             `json:"doctorId"`
	Specialty          Specialty          `json:"specialty"`
	FirstName          string             `json:"firstName"`
	LastName           string             `json:"lastName"`
	DocumentID         string             `json:"documentId"`
	Phone              string             `json:"phone"`
	Email              string             `json:"email"`
	BirthDate          string             `json:"birthDate"`
	MedicalBackgrounds []MedicalBackground `json:"medicalBackgrounds"`
	ImageKeys          []string           `json:"imageKeys"`
	CreatedAt          time.Time          `json:"createdAt"`
}

type MedicalBackground struct {
	Type        string `json:"type"`
	Description string `json:"description"`
}

type Appointment struct {
	ID                   string    `json:"id"`
	DoctorID             string    `json:"doctorId"`
	PatientID            string    `json:"patientId"`
	StartAt              time.Time `json:"startAt"`
	EndAt                time.Time `json:"endAt"`
	Status               string    `json:"status"`
	EvolutionNotes       string    `json:"evolutionNotes"`
	TreatmentPlan        string    `json:"treatmentPlan"`
	PaymentAmount        float64   `json:"paymentAmount"`
	PaymentMethod        string    `json:"paymentMethod"`
	ReminderSentAt       *time.Time `json:"reminderSentAt,omitempty"`
	PatientConfirmedAt   *time.Time `json:"patientConfirmedAt,omitempty"`
	DoctorDailyClosedAt  *time.Time `json:"doctorDailyClosedAt,omitempty"`
}

type Consent struct {
	ID             string    `json:"id"`
	PatientID      string    `json:"patientId"`
	DoctorID       string    `json:"doctorId"`
	Title          string    `json:"title"`
	Content        string    `json:"content"`
	DeliveryMethod string    `json:"deliveryMethod"`
	Status         string    `json:"status"`
	AcceptedAt     *time.Time `json:"acceptedAt,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
}

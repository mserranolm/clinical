package store

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"clinical-backend/internal/domain"
)

type PatientRepository interface {
	Create(ctx context.Context, patient domain.Patient) (domain.Patient, error)
	GetByID(ctx context.Context, id string) (domain.Patient, error)
}

type AppointmentRepository interface {
	Create(ctx context.Context, appointment domain.Appointment) (domain.Appointment, error)
	GetByID(ctx context.Context, id string) (domain.Appointment, error)
	ListByDoctorAndDay(ctx context.Context, doctorID string, day time.Time) ([]domain.Appointment, error)
	Update(ctx context.Context, appointment domain.Appointment) (domain.Appointment, error)
}

type ConsentRepository interface {
	Create(ctx context.Context, consent domain.Consent) (domain.Consent, error)
	Update(ctx context.Context, consent domain.Consent) (domain.Consent, error)
	GetByID(ctx context.Context, id string) (domain.Consent, error)
}

type AuthUser struct {
	ID           string
	Name         string
	Email        string
	PasswordHash string
	CreatedAt    time.Time
}

type PasswordResetToken struct {
	Token     string
	UserID    string
	ExpiresAt time.Time
	Used      bool
}

type AuthRepository interface {
	CreateUser(ctx context.Context, user AuthUser) (AuthUser, error)
	GetUserByEmail(ctx context.Context, email string) (AuthUser, error)
	UpdateUserPassword(ctx context.Context, userID, passwordHash string) error
	SaveResetToken(ctx context.Context, token PasswordResetToken) (PasswordResetToken, error)
	GetResetToken(ctx context.Context, token string) (PasswordResetToken, error)
	MarkResetTokenUsed(ctx context.Context, token string) error
}

type InMemoryRepositories struct {
	Patients     PatientRepository
	Appointments AppointmentRepository
	Consents     ConsentRepository
	Users        AuthRepository
}

func NewInMemoryRepositories() *InMemoryRepositories {
	return &InMemoryRepositories{
		Patients:     &memoryPatientRepo{items: map[string]domain.Patient{}},
		Appointments: &memoryAppointmentRepo{items: map[string]domain.Appointment{}},
		Consents:     &memoryConsentRepo{items: map[string]domain.Consent{}},
		Users:        &memoryAuthRepo{usersByID: map[string]AuthUser{}, emailIndex: map[string]string{}, resetTokens: map[string]PasswordResetToken{}},
	}
}

type memoryPatientRepo struct {
	mu    sync.RWMutex
	items map[string]domain.Patient
}

func (r *memoryPatientRepo) Create(_ context.Context, patient domain.Patient) (domain.Patient, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.items[patient.ID] = patient
	return patient, nil
}

func (r *memoryPatientRepo) GetByID(_ context.Context, id string) (domain.Patient, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	item, ok := r.items[id]
	if !ok {
		return domain.Patient{}, fmt.Errorf("patient not found")
	}
	return item, nil
}

type memoryAppointmentRepo struct {
	mu    sync.RWMutex
	items map[string]domain.Appointment
}

func (r *memoryAppointmentRepo) Create(_ context.Context, appointment domain.Appointment) (domain.Appointment, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.items[appointment.ID] = appointment
	return appointment, nil
}

func (r *memoryAppointmentRepo) GetByID(_ context.Context, id string) (domain.Appointment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	item, ok := r.items[id]
	if !ok {
		return domain.Appointment{}, fmt.Errorf("appointment not found")
	}
	return item, nil
}

func (r *memoryAppointmentRepo) ListByDoctorAndDay(_ context.Context, doctorID string, day time.Time) ([]domain.Appointment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var out []domain.Appointment
	y, m, d := day.Date()
	for _, item := range r.items {
		if item.DoctorID != doctorID {
			continue
		}
		iy, im, id := item.StartAt.Date()
		if iy == y && im == m && id == d {
			out = append(out, item)
		}
	}
	return out, nil
}

func (r *memoryAppointmentRepo) Update(_ context.Context, appointment domain.Appointment) (domain.Appointment, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.items[appointment.ID]; !ok {
		return domain.Appointment{}, fmt.Errorf("appointment not found")
	}
	r.items[appointment.ID] = appointment
	return appointment, nil
}

type memoryConsentRepo struct {
	mu    sync.RWMutex
	items map[string]domain.Consent
}

func (r *memoryConsentRepo) Create(_ context.Context, consent domain.Consent) (domain.Consent, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.items[consent.ID] = consent
	return consent, nil
}

func (r *memoryConsentRepo) Update(_ context.Context, consent domain.Consent) (domain.Consent, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.items[consent.ID]; !ok {
		return domain.Consent{}, fmt.Errorf("consent not found")
	}
	r.items[consent.ID] = consent
	return consent, nil
}

func (r *memoryConsentRepo) GetByID(_ context.Context, id string) (domain.Consent, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	item, ok := r.items[id]
	if !ok {
		return domain.Consent{}, fmt.Errorf("consent not found")
	}
	return item, nil
}

type memoryAuthRepo struct {
	mu          sync.RWMutex
	usersByID   map[string]AuthUser
	emailIndex  map[string]string
	resetTokens map[string]PasswordResetToken
}

func (r *memoryAuthRepo) CreateUser(_ context.Context, user AuthUser) (AuthUser, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	email := normalizeEmail(user.Email)
	if _, exists := r.emailIndex[email]; exists {
		return AuthUser{}, fmt.Errorf("email already exists")
	}
	user.Email = email
	r.usersByID[user.ID] = user
	r.emailIndex[email] = user.ID
	return user, nil
}

func (r *memoryAuthRepo) GetUserByEmail(_ context.Context, email string) (AuthUser, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	userID, ok := r.emailIndex[normalizeEmail(email)]
	if !ok {
		return AuthUser{}, fmt.Errorf("user not found")
	}
	user := r.usersByID[userID]
	return user, nil
}

func (r *memoryAuthRepo) UpdateUserPassword(_ context.Context, userID, passwordHash string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	user, ok := r.usersByID[userID]
	if !ok {
		return fmt.Errorf("user not found")
	}
	user.PasswordHash = passwordHash
	r.usersByID[userID] = user
	return nil
}

func (r *memoryAuthRepo) SaveResetToken(_ context.Context, token PasswordResetToken) (PasswordResetToken, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.resetTokens[token.Token] = token
	return token, nil
}

func (r *memoryAuthRepo) GetResetToken(_ context.Context, token string) (PasswordResetToken, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	item, ok := r.resetTokens[token]
	if !ok {
		return PasswordResetToken{}, fmt.Errorf("reset token not found")
	}
	return item, nil
}

func (r *memoryAuthRepo) MarkResetTokenUsed(_ context.Context, token string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	item, ok := r.resetTokens[token]
	if !ok {
		return fmt.Errorf("reset token not found")
	}
	item.Used = true
	r.resetTokens[token] = item
	return nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

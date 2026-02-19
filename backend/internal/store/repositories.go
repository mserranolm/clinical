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
	ListByDoctor(ctx context.Context, doctorID string) ([]domain.Patient, error)
	SearchByQuery(ctx context.Context, doctorID, query string) ([]domain.Patient, error)
	Update(ctx context.Context, patient domain.Patient) (domain.Patient, error)
	Delete(ctx context.Context, id string) error
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
	OrgID        string
	Name         string
	Email        string
	Role         string
	Status       string
	PasswordHash string
	CreatedAt    time.Time
}

type AuthSession struct {
	Token     string
	UserID    string
	OrgID     string
	Role      string
	ExpiresAt time.Time
}

type UserInvitation struct {
	Token     string
	OrgID     string
	Email     string
	Role      string
	InvitedBy string
	ExpiresAt time.Time
	Used      bool
}

type PasswordResetToken struct {
	Token     string
	UserID    string
	ExpiresAt time.Time
	Used      bool
}

type AuthRepository interface {
	CreateUser(ctx context.Context, user AuthUser) (AuthUser, error)
	GetUserByID(ctx context.Context, userID string) (AuthUser, error)
	GetUserByEmail(ctx context.Context, email string) (AuthUser, error)
	UpdateUserPassword(ctx context.Context, userID, passwordHash string) error
	UpdateUser(ctx context.Context, user AuthUser) (AuthUser, error)
	ListUsersByOrg(ctx context.Context, orgID string) ([]AuthUser, error)

	CreateSession(ctx context.Context, session AuthSession) (AuthSession, error)
	GetSession(ctx context.Context, token string) (AuthSession, error)
	DeleteSession(ctx context.Context, token string) error

	CreateInvitation(ctx context.Context, inv UserInvitation) (UserInvitation, error)
	GetInvitation(ctx context.Context, token string) (UserInvitation, error)
	MarkInvitationUsed(ctx context.Context, token string) error

	SaveResetToken(ctx context.Context, token PasswordResetToken) (PasswordResetToken, error)
	GetResetToken(ctx context.Context, token string) (PasswordResetToken, error)
	MarkResetTokenUsed(ctx context.Context, token string) error
}

// Odontogram repository interface
type OdontogramRepository interface {
	Create(ctx context.Context, odontogram domain.Odontogram) (domain.Odontogram, error)
	GetByPatientID(ctx context.Context, patientID string) (domain.Odontogram, error)
	GetByID(ctx context.Context, id string) (domain.Odontogram, error)
	Update(ctx context.Context, odontogram domain.Odontogram) (domain.Odontogram, error)
	AddTreatment(ctx context.Context, odontogramID string, treatment domain.ToothTreatment) error
	UpdateToothCondition(ctx context.Context, odontogramID string, toothNumber domain.ToothNumber, surfaces []domain.ToothSurfaceCondition) error
	GetTreatmentHistory(ctx context.Context, patientID string, limit int) ([]domain.ToothTreatment, error)
}

// Treatment plan repository interface
type TreatmentPlanRepository interface {
	Create(ctx context.Context, plan domain.TreatmentPlan) (domain.TreatmentPlan, error)
	GetByID(ctx context.Context, id string) (domain.TreatmentPlan, error)
	GetByPatientID(ctx context.Context, patientID string) ([]domain.TreatmentPlan, error)
	Update(ctx context.Context, plan domain.TreatmentPlan) (domain.TreatmentPlan, error)
	Delete(ctx context.Context, id string) error
	UpdateTreatmentStatus(ctx context.Context, planID, treatmentIndex string, status domain.PlannedTreatmentStatus, completedTreatmentID *string) error
}

type InMemoryRepositories struct {
	Patients       PatientRepository
	Appointments   AppointmentRepository
	Consents       ConsentRepository
	Users          AuthRepository
	Odontograms    OdontogramRepository
	TreatmentPlans TreatmentPlanRepository
}

func NewInMemoryRepositories() *InMemoryRepositories {
	return &InMemoryRepositories{
		Patients:       &memoryPatientRepo{items: map[string]domain.Patient{}},
		Appointments:   &memoryAppointmentRepo{items: map[string]domain.Appointment{}},
		Consents:       &memoryConsentRepo{items: map[string]domain.Consent{}},
		Users:          &memoryAuthRepo{usersByID: map[string]AuthUser{}, emailIndex: map[string]string{}, usersByOrg: map[string]map[string]struct{}{}, sessions: map[string]AuthSession{}, invitations: map[string]UserInvitation{}, resetTokens: map[string]PasswordResetToken{}},
		Odontograms:    &memoryOdontogramRepo{items: map[string]domain.Odontogram{}, byPatient: map[string]string{}},
		TreatmentPlans: &memoryTreatmentPlanRepo{items: map[string]domain.TreatmentPlan{}, byPatient: map[string][]string{}},
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

func (r *memoryPatientRepo) ListByDoctor(_ context.Context, doctorID string) ([]domain.Patient, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var results []domain.Patient
	for _, p := range r.items {
		if doctorID == "" || p.DoctorID == doctorID {
			results = append(results, p)
		}
	}
	return results, nil
}

func (r *memoryPatientRepo) SearchByQuery(_ context.Context, doctorID, query string) ([]domain.Patient, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	q := strings.ToLower(strings.TrimSpace(query))
	var results []domain.Patient
	for _, p := range r.items {
		if doctorID != "" && p.DoctorID != doctorID {
			continue
		}
		if q == "" ||
			strings.Contains(strings.ToLower(p.FirstName), q) ||
			strings.Contains(strings.ToLower(p.LastName), q) ||
			strings.Contains(strings.ToLower(p.FirstName+" "+p.LastName), q) ||
			strings.Contains(strings.ToLower(p.DocumentID), q) ||
			strings.Contains(strings.ToLower(p.Email), q) ||
			strings.Contains(strings.ReplaceAll(p.Phone, " ", ""), strings.ReplaceAll(q, " ", "")) {
			results = append(results, p)
		}
	}
	return results, nil
}

func (r *memoryPatientRepo) Update(_ context.Context, patient domain.Patient) (domain.Patient, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.items[patient.ID]; !ok {
		return domain.Patient{}, fmt.Errorf("patient not found")
	}
	r.items[patient.ID] = patient
	return patient, nil
}

func (r *memoryPatientRepo) Delete(_ context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.items[id]; !ok {
		return fmt.Errorf("patient not found")
	}
	delete(r.items, id)
	return nil
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
	usersByOrg  map[string]map[string]struct{}
	sessions    map[string]AuthSession
	invitations map[string]UserInvitation
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
	if user.Role == "" {
		user.Role = "admin"
	}
	if user.Status == "" {
		user.Status = "active"
	}
	r.usersByID[user.ID] = user
	r.emailIndex[email] = user.ID
	if user.OrgID != "" {
		if r.usersByOrg == nil {
			r.usersByOrg = map[string]map[string]struct{}{}
		}
		if _, ok := r.usersByOrg[user.OrgID]; !ok {
			r.usersByOrg[user.OrgID] = map[string]struct{}{}
		}
		r.usersByOrg[user.OrgID][user.ID] = struct{}{}
	}
	return user, nil
}

func (r *memoryAuthRepo) GetUserByID(_ context.Context, userID string) (AuthUser, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	user, ok := r.usersByID[userID]
	if !ok {
		return AuthUser{}, fmt.Errorf("user not found")
	}
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

func (r *memoryAuthRepo) UpdateUser(_ context.Context, user AuthUser) (AuthUser, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.usersByID[user.ID]; !ok {
		return AuthUser{}, fmt.Errorf("user not found")
	}
	user.Email = normalizeEmail(user.Email)
	r.usersByID[user.ID] = user
	return user, nil
}

func (r *memoryAuthRepo) ListUsersByOrg(_ context.Context, orgID string) ([]AuthUser, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	ids, ok := r.usersByOrg[orgID]
	if !ok {
		return []AuthUser{}, nil
	}
	res := make([]AuthUser, 0, len(ids))
	for id := range ids {
		res = append(res, r.usersByID[id])
	}
	return res, nil
}

func (r *memoryAuthRepo) CreateSession(_ context.Context, session AuthSession) (AuthSession, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.sessions == nil {
		r.sessions = map[string]AuthSession{}
	}
	r.sessions[session.Token] = session
	return session, nil
}

func (r *memoryAuthRepo) GetSession(_ context.Context, token string) (AuthSession, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.sessions == nil {
		return AuthSession{}, fmt.Errorf("session not found")
	}
	s, ok := r.sessions[token]
	if !ok {
		return AuthSession{}, fmt.Errorf("session not found")
	}
	return s, nil
}

func (r *memoryAuthRepo) DeleteSession(_ context.Context, token string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.sessions != nil {
		delete(r.sessions, token)
	}
	return nil
}

func (r *memoryAuthRepo) CreateInvitation(_ context.Context, inv UserInvitation) (UserInvitation, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.invitations == nil {
		r.invitations = map[string]UserInvitation{}
	}
	r.invitations[inv.Token] = inv
	return inv, nil
}

func (r *memoryAuthRepo) GetInvitation(_ context.Context, token string) (UserInvitation, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.invitations == nil {
		return UserInvitation{}, fmt.Errorf("invitation not found")
	}
	inv, ok := r.invitations[token]
	if !ok {
		return UserInvitation{}, fmt.Errorf("invitation not found")
	}
	return inv, nil
}

func (r *memoryAuthRepo) MarkInvitationUsed(_ context.Context, token string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.invitations == nil {
		return fmt.Errorf("invitation not found")
	}
	inv, ok := r.invitations[token]
	if !ok {
		return fmt.Errorf("invitation not found")
	}
	inv.Used = true
	r.invitations[token] = inv
	return nil
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

// In-memory odontogram repository
type memoryOdontogramRepo struct {
	mu        sync.RWMutex
	items     map[string]domain.Odontogram
	byPatient map[string]string // patientID -> odontogramID
}

func (r *memoryOdontogramRepo) Create(_ context.Context, odontogram domain.Odontogram) (domain.Odontogram, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	odontogram.CreatedAt = time.Now()
	odontogram.UpdatedAt = time.Now()

	r.items[odontogram.ID] = odontogram
	r.byPatient[odontogram.PatientID] = odontogram.ID

	return odontogram, nil
}

func (r *memoryOdontogramRepo) GetByPatientID(_ context.Context, patientID string) (domain.Odontogram, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	odontogramID, ok := r.byPatient[patientID]
	if !ok {
		return domain.Odontogram{}, fmt.Errorf("odontogram not found for patient")
	}

	item, ok := r.items[odontogramID]
	if !ok {
		return domain.Odontogram{}, fmt.Errorf("odontogram not found")
	}

	return item, nil
}

func (r *memoryOdontogramRepo) GetByID(_ context.Context, id string) (domain.Odontogram, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	item, ok := r.items[id]
	if !ok {
		return domain.Odontogram{}, fmt.Errorf("odontogram not found")
	}

	return item, nil
}

func (r *memoryOdontogramRepo) Update(_ context.Context, odontogram domain.Odontogram) (domain.Odontogram, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.items[odontogram.ID]; !ok {
		return domain.Odontogram{}, fmt.Errorf("odontogram not found")
	}

	odontogram.UpdatedAt = time.Now()
	r.items[odontogram.ID] = odontogram

	return odontogram, nil
}

func (r *memoryOdontogramRepo) AddTreatment(_ context.Context, odontogramID string, treatment domain.ToothTreatment) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	odontogram, ok := r.items[odontogramID]
	if !ok {
		return fmt.Errorf("odontogram not found")
	}

	treatment.CreatedAt = time.Now()
	treatment.CompletedAt = time.Now()

	odontogram.TreatmentHistory = append(odontogram.TreatmentHistory, treatment)
	odontogram.UpdatedAt = time.Now()

	r.items[odontogramID] = odontogram

	return nil
}

func (r *memoryOdontogramRepo) UpdateToothCondition(_ context.Context, odontogramID string, toothNumber domain.ToothNumber, surfaces []domain.ToothSurfaceCondition) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	odontogram, ok := r.items[odontogramID]
	if !ok {
		return fmt.Errorf("odontogram not found")
	}

	// Find and update tooth
	for i, tooth := range odontogram.Teeth {
		if tooth.ToothNumber == toothNumber {
			tooth.Surfaces = surfaces
			tooth.LastUpdated = time.Now()
			odontogram.Teeth[i] = tooth
			break
		}
	}

	odontogram.UpdatedAt = time.Now()
	r.items[odontogramID] = odontogram

	return nil
}

func (r *memoryOdontogramRepo) GetTreatmentHistory(_ context.Context, patientID string, limit int) ([]domain.ToothTreatment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	odontogramID, ok := r.byPatient[patientID]
	if !ok {
		return []domain.ToothTreatment{}, nil
	}

	odontogram, ok := r.items[odontogramID]
	if !ok {
		return []domain.ToothTreatment{}, nil
	}

	treatments := odontogram.TreatmentHistory
	if limit > 0 && len(treatments) > limit {
		treatments = treatments[len(treatments)-limit:]
	}

	return treatments, nil
}

// In-memory treatment plan repository
type memoryTreatmentPlanRepo struct {
	mu        sync.RWMutex
	items     map[string]domain.TreatmentPlan
	byPatient map[string][]string // patientID -> []planID
}

func (r *memoryTreatmentPlanRepo) Create(_ context.Context, plan domain.TreatmentPlan) (domain.TreatmentPlan, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	plan.CreatedAt = time.Now()
	plan.UpdatedAt = time.Now()

	r.items[plan.ID] = plan

	if r.byPatient[plan.PatientID] == nil {
		r.byPatient[plan.PatientID] = []string{}
	}
	r.byPatient[plan.PatientID] = append(r.byPatient[plan.PatientID], plan.ID)

	return plan, nil
}

func (r *memoryTreatmentPlanRepo) GetByID(_ context.Context, id string) (domain.TreatmentPlan, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	item, ok := r.items[id]
	if !ok {
		return domain.TreatmentPlan{}, fmt.Errorf("treatment plan not found")
	}

	return item, nil
}

func (r *memoryTreatmentPlanRepo) GetByPatientID(_ context.Context, patientID string) ([]domain.TreatmentPlan, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	planIDs, ok := r.byPatient[patientID]
	if !ok {
		return []domain.TreatmentPlan{}, nil
	}

	var plans []domain.TreatmentPlan
	for _, planID := range planIDs {
		if plan, exists := r.items[planID]; exists {
			plans = append(plans, plan)
		}
	}

	return plans, nil
}

func (r *memoryTreatmentPlanRepo) Update(_ context.Context, plan domain.TreatmentPlan) (domain.TreatmentPlan, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.items[plan.ID]; !ok {
		return domain.TreatmentPlan{}, fmt.Errorf("treatment plan not found")
	}

	plan.UpdatedAt = time.Now()
	r.items[plan.ID] = plan

	return plan, nil
}

func (r *memoryTreatmentPlanRepo) Delete(_ context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	plan, ok := r.items[id]
	if !ok {
		return fmt.Errorf("treatment plan not found")
	}

	delete(r.items, id)

	// Remove from patient index
	patientPlans := r.byPatient[plan.PatientID]
	for i, planID := range patientPlans {
		if planID == id {
			r.byPatient[plan.PatientID] = append(patientPlans[:i], patientPlans[i+1:]...)
			break
		}
	}

	return nil
}

func (r *memoryTreatmentPlanRepo) UpdateTreatmentStatus(_ context.Context, planID, treatmentIndex string, status domain.PlannedTreatmentStatus, completedTreatmentID *string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	plan, ok := r.items[planID]
	if !ok {
		return fmt.Errorf("treatment plan not found")
	}

	// Parse treatment index (assuming it's a string representation of array index)
	for i := range plan.Treatments {
		if fmt.Sprintf("%d", i) == treatmentIndex {
			plan.Treatments[i].Status = status
			if completedTreatmentID != nil {
				plan.Treatments[i].CompletedTreatmentID = completedTreatmentID
			}
			break
		}
	}

	plan.UpdatedAt = time.Now()
	r.items[planID] = plan

	return nil
}

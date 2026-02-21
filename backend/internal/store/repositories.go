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
	ListAll(ctx context.Context) ([]domain.Patient, error)
	SearchByQuery(ctx context.Context, doctorID, query string) ([]domain.Patient, error)
	Update(ctx context.Context, patient domain.Patient) (domain.Patient, error)
	Delete(ctx context.Context, id string) error
}

type AppointmentRepository interface {
	Create(ctx context.Context, appointment domain.Appointment) (domain.Appointment, error)
	GetByID(ctx context.Context, id string) (domain.Appointment, error)
	GetByConfirmToken(ctx context.Context, token string) (domain.Appointment, error)
	ListByDoctorAndDay(ctx context.Context, doctorID string, day time.Time) ([]domain.Appointment, error)
	ListByPatient(ctx context.Context, patientID string) ([]domain.Appointment, error)
	Update(ctx context.Context, appointment domain.Appointment) (domain.Appointment, error)
	Delete(ctx context.Context, id string) error
	ScanAllPayments(ctx context.Context) ([]PaymentSummary, error)
	ScanOrgPayments(ctx context.Context, orgID string) ([]PaymentSummary, error)
}

type PaymentSummary struct {
	OrgID         string
	Status        string
	PaymentAmount float64
}

type ConsentRepository interface {
	Create(ctx context.Context, consent domain.Consent) (domain.Consent, error)
	Update(ctx context.Context, consent domain.Consent) (domain.Consent, error)
	GetByID(ctx context.Context, id string) (domain.Consent, error)
	GetByToken(ctx context.Context, token string) (domain.Consent, error)
	GetByAppointmentID(ctx context.Context, appointmentID string) (domain.Consent, error)
}

type ConsentTemplateRepository interface {
	Create(ctx context.Context, t domain.ConsentTemplate) (domain.ConsentTemplate, error)
	Update(ctx context.Context, t domain.ConsentTemplate) (domain.ConsentTemplate, error)
	GetByID(ctx context.Context, id string) (domain.ConsentTemplate, error)
	ListByOrg(ctx context.Context, orgID string) ([]domain.ConsentTemplate, error)
	GetActiveByOrg(ctx context.Context, orgID string) (domain.ConsentTemplate, error)
}

type AuthUser struct {
	ID                 string
	OrgID              string
	Name               string
	Email              string
	Phone              string
	Address            string
	Role               string
	Status             string
	PasswordHash       string
	MustChangePassword bool
	CreatedAt          time.Time
}

type AuthSession struct {
	Token     string
	UserID    string
	OrgID     string
	Role      string
	ExpiresAt time.Time
}

type UserInvitation struct {
	Token        string
	OrgID        string
	Email        string
	Role         string
	InvitedBy    string
	TempPassword string
	ExpiresAt    time.Time
	Used         bool
}

type OrgLimits struct {
	MaxDoctors    int `json:"maxDoctors"`
	MaxAssistants int `json:"maxAssistants"`
	MaxPatients   int `json:"maxPatients"`
}

type Organization struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	BusinessName  string     `json:"businessName"`
	TaxID         string     `json:"taxId"`
	Address       string     `json:"address"`
	Email         string     `json:"email"`
	Phone         string     `json:"phone"`
	Status        string     `json:"status"`
	PaymentStatus string     `json:"paymentStatus"`
	Limits        OrgLimits  `json:"limits"`
	Timezone      string     `json:"timezone,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     *time.Time `json:"updatedAt,omitempty"`
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
	DeleteUser(ctx context.Context, orgID, userID string) error
	ListUsersByOrg(ctx context.Context, orgID string) ([]AuthUser, error)
	CreateOrganization(ctx context.Context, org Organization) (Organization, error)
	GetOrganization(ctx context.Context, orgID string) (Organization, error)
	UpdateOrganization(ctx context.Context, org Organization) (Organization, error)
	DeleteOrganization(ctx context.Context, orgID string) error
	ListOrganizations(ctx context.Context) ([]Organization, error)

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
	Patients         PatientRepository
	Appointments     AppointmentRepository
	Consents         ConsentRepository
	ConsentTemplates ConsentTemplateRepository
	Users            AuthRepository
	Odontograms      OdontogramRepository
	TreatmentPlans   TreatmentPlanRepository
}

func NewInMemoryRepositories() *InMemoryRepositories {
	return &InMemoryRepositories{
		Patients:         &memoryPatientRepo{items: map[string]domain.Patient{}},
		Appointments:     &memoryAppointmentRepo{items: map[string]domain.Appointment{}},
		Consents:         &memoryConsentRepo{items: map[string]domain.Consent{}},
		ConsentTemplates: &memoryConsentTemplateRepo{items: map[string]domain.ConsentTemplate{}},
		Users:            &memoryAuthRepo{usersByID: map[string]AuthUser{}, emailIndex: map[string]string{}, usersByOrg: map[string]map[string]struct{}{}, sessions: map[string]AuthSession{}, invitations: map[string]UserInvitation{}, resetTokens: map[string]PasswordResetToken{}, orgs: map[string]Organization{}},
		Odontograms:      &memoryOdontogramRepo{items: map[string]domain.Odontogram{}, byPatient: map[string]string{}},
		TreatmentPlans:   &memoryTreatmentPlanRepo{items: map[string]domain.TreatmentPlan{}, byPatient: map[string][]string{}},
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

func (r *memoryPatientRepo) ListAll(_ context.Context) ([]domain.Patient, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	results := make([]domain.Patient, 0, len(r.items))
	for _, p := range r.items {
		results = append(results, p)
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

func (r *memoryAppointmentRepo) GetByConfirmToken(_ context.Context, token string) (domain.Appointment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, item := range r.items {
		if item.ConfirmToken == token {
			return item, nil
		}
	}
	return domain.Appointment{}, fmt.Errorf("appointment not found")
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

func (r *memoryAppointmentRepo) ListByPatient(_ context.Context, patientID string) ([]domain.Appointment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var out []domain.Appointment
	for _, item := range r.items {
		if item.PatientID == patientID {
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

func (r *memoryAppointmentRepo) Delete(_ context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.items[id]; !ok {
		return fmt.Errorf("appointment not found")
	}
	delete(r.items, id)
	return nil
}

func (r *memoryAppointmentRepo) ScanAllPayments(_ context.Context) ([]PaymentSummary, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]PaymentSummary, 0, len(r.items))
	for _, a := range r.items {
		out = append(out, PaymentSummary{OrgID: "default", Status: a.Status, PaymentAmount: a.PaymentAmount})
	}
	return out, nil
}

func (r *memoryAppointmentRepo) ScanOrgPayments(_ context.Context, orgID string) ([]PaymentSummary, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]PaymentSummary, 0, len(r.items))
	for _, a := range r.items {
		out = append(out, PaymentSummary{OrgID: orgID, Status: a.Status, PaymentAmount: a.PaymentAmount})
	}
	return out, nil
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

func (r *memoryConsentRepo) GetByToken(_ context.Context, token string) (domain.Consent, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, item := range r.items {
		if item.AcceptToken == token {
			return item, nil
		}
	}
	return domain.Consent{}, fmt.Errorf("consent not found")
}

func (r *memoryConsentRepo) GetByAppointmentID(_ context.Context, appointmentID string) (domain.Consent, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, item := range r.items {
		if item.AppointmentID == appointmentID {
			return item, nil
		}
	}
	return domain.Consent{}, fmt.Errorf("consent not found")
}

// In-memory consent template repository
type memoryConsentTemplateRepo struct {
	mu    sync.RWMutex
	items map[string]domain.ConsentTemplate
}

func (r *memoryConsentTemplateRepo) Create(_ context.Context, t domain.ConsentTemplate) (domain.ConsentTemplate, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.items[t.ID] = t
	return t, nil
}

func (r *memoryConsentTemplateRepo) Update(_ context.Context, t domain.ConsentTemplate) (domain.ConsentTemplate, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.items[t.ID]; !ok {
		return domain.ConsentTemplate{}, fmt.Errorf("consent template not found")
	}
	r.items[t.ID] = t
	return t, nil
}

func (r *memoryConsentTemplateRepo) GetByID(_ context.Context, id string) (domain.ConsentTemplate, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	item, ok := r.items[id]
	if !ok {
		return domain.ConsentTemplate{}, fmt.Errorf("consent template not found")
	}
	return item, nil
}

func (r *memoryConsentTemplateRepo) ListByOrg(_ context.Context, orgID string) ([]domain.ConsentTemplate, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var out []domain.ConsentTemplate
	for _, item := range r.items {
		if item.OrgID == orgID {
			out = append(out, item)
		}
	}
	return out, nil
}

func (r *memoryConsentTemplateRepo) GetActiveByOrg(_ context.Context, orgID string) (domain.ConsentTemplate, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, item := range r.items {
		if item.OrgID == orgID && item.IsActive {
			return item, nil
		}
	}
	return domain.ConsentTemplate{}, fmt.Errorf("no active consent template found")
}

type memoryAuthRepo struct {
	mu          sync.RWMutex
	usersByID   map[string]AuthUser
	emailIndex  map[string]string
	usersByOrg  map[string]map[string]struct{}
	sessions    map[string]AuthSession
	invitations map[string]UserInvitation
	resetTokens map[string]PasswordResetToken
	orgs        map[string]Organization
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

func (r *memoryAuthRepo) DeleteUser(_ context.Context, orgID, userID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	u, ok := r.usersByID[userID]
	if !ok {
		return fmt.Errorf("user not found")
	}
	delete(r.emailIndex, normalizeEmail(u.Email))
	delete(r.usersByID, userID)
	if ids, ok2 := r.usersByOrg[orgID]; ok2 {
		delete(ids, userID)
	}
	return nil
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

func (r *memoryAuthRepo) CreateOrganization(_ context.Context, org Organization) (Organization, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.orgs == nil {
		r.orgs = map[string]Organization{}
	}
	if _, exists := r.orgs[org.ID]; exists {
		return Organization{}, fmt.Errorf("organization already exists")
	}
	if org.Status == "" {
		org.Status = "active"
	}
	if org.PaymentStatus == "" {
		org.PaymentStatus = "current"
	}
	if org.Limits.MaxDoctors == 0 {
		org.Limits.MaxDoctors = 5
	}
	if org.Limits.MaxAssistants == 0 {
		org.Limits.MaxAssistants = 2
	}
	if org.Limits.MaxPatients == 0 {
		org.Limits.MaxPatients = 20
	}
	r.orgs[org.ID] = org
	return org, nil
}

func (r *memoryAuthRepo) UpdateOrganization(_ context.Context, org Organization) (Organization, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.orgs[org.ID]; !ok {
		return Organization{}, fmt.Errorf("organization not found")
	}
	now := time.Now()
	org.UpdatedAt = &now
	r.orgs[org.ID] = org
	return org, nil
}

func (r *memoryAuthRepo) DeleteOrganization(_ context.Context, orgID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.orgs[orgID]; !ok {
		return fmt.Errorf("organization not found")
	}
	delete(r.orgs, orgID)
	return nil
}

func (r *memoryAuthRepo) GetOrganization(_ context.Context, orgID string) (Organization, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	org, ok := r.orgs[orgID]
	if !ok {
		return Organization{}, fmt.Errorf("organization not found")
	}
	return org, nil
}

func (r *memoryAuthRepo) ListOrganizations(_ context.Context) ([]Organization, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	items := make([]Organization, 0, len(r.orgs))
	for _, org := range r.orgs {
		items = append(items, org)
	}
	return items, nil
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

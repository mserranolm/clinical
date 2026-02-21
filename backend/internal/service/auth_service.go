package service

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"clinical-backend/internal/notifications"
	"clinical-backend/internal/store"
)

type AuthService struct {
	repo            store.AuthRepository
	patientRepo     store.PatientRepository
	appointmentRepo store.AppointmentRepository
	notifier        notifications.Notifier
	frontendBaseURL string
}

func NewAuthService(repo store.AuthRepository, opts ...func(*AuthService)) *AuthService {
	svc := &AuthService{repo: repo}
	for _, o := range opts {
		o(svc)
	}
	return svc
}

func WithNotifier(n notifications.Notifier) func(*AuthService) {
	return func(s *AuthService) { s.notifier = n }
}

func WithFrontendBaseURL(url string) func(*AuthService) {
	return func(s *AuthService) { s.frontendBaseURL = url }
}

func WithAuthPatientRepo(r store.PatientRepository) func(*AuthService) {
	return func(s *AuthService) { s.patientRepo = r }
}

func WithAuthAppointmentRepo(r store.AppointmentRepository) func(*AuthService) {
	return func(s *AuthService) { s.appointmentRepo = r }
}

type Authenticated struct {
	User    store.AuthUser
	Session store.AuthSession
}

func (s *AuthService) Authenticate(ctx context.Context, token string) (Authenticated, error) {
	if strings.TrimSpace(token) == "" {
		return Authenticated{}, fmt.Errorf("missing token")
	}
	session, err := s.repo.GetSession(ctx, token)
	if err != nil {
		return Authenticated{}, fmt.Errorf("invalid token")
	}
	if time.Now().UTC().After(session.ExpiresAt) {
		_ = s.repo.DeleteSession(ctx, token)
		return Authenticated{}, fmt.Errorf("token expired")
	}
	user, err := s.repo.GetUserByID(ctx, session.UserID)
	if err != nil {
		return Authenticated{}, fmt.Errorf("invalid token")
	}
	if strings.ToLower(strings.TrimSpace(user.Status)) == "disabled" {
		return Authenticated{}, fmt.Errorf("user disabled")
	}
	return Authenticated{User: user, Session: session}, nil
}

type RegisterInput struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterOutput struct {
	UserID    string    `json:"userId"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"createdAt"`
}

func (s *AuthService) Register(ctx context.Context, in RegisterInput) (RegisterOutput, error) {
	if strings.TrimSpace(in.Name) == "" || strings.TrimSpace(in.Email) == "" || strings.TrimSpace(in.Password) == "" {
		return RegisterOutput{}, fmt.Errorf("name, email and password are required")
	}
	if len(in.Password) < 8 {
		return RegisterOutput{}, fmt.Errorf("password must have at least 8 characters")
	}

	user := store.AuthUser{
		ID:           buildID("usr"),
		OrgID:        "default",
		Role:         "admin",
		Status:       "active",
		Name:         strings.TrimSpace(in.Name),
		Email:        strings.ToLower(strings.TrimSpace(in.Email)),
		PasswordHash: hashPassword(in.Password),
		CreatedAt:    time.Now().UTC(),
	}
	created, err := s.repo.CreateUser(ctx, user)
	if err != nil {
		return RegisterOutput{}, err
	}
	return RegisterOutput{
		UserID:    created.ID,
		Name:      created.Name,
		Email:     created.Email,
		CreatedAt: created.CreatedAt,
	}, nil
}

type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginOutput struct {
	AccessToken        string `json:"accessToken"`
	UserID             string `json:"userId"`
	OrgID              string `json:"orgId"`
	Name               string `json:"name"`
	Email              string `json:"email"`
	Role               string `json:"role"`
	MustChangePassword bool   `json:"mustChangePassword"`
}

func (s *AuthService) Login(ctx context.Context, in LoginInput) (LoginOutput, error) {
	if strings.TrimSpace(in.Email) == "" || strings.TrimSpace(in.Password) == "" {
		return LoginOutput{}, fmt.Errorf("email and password are required")
	}

	user, err := s.repo.GetUserByEmail(ctx, in.Email)
	if err != nil {
		return LoginOutput{}, fmt.Errorf("invalid credentials")
	}
	if user.PasswordHash != hashPassword(in.Password) {
		return LoginOutput{}, fmt.Errorf("invalid credentials")
	}
	if strings.ToLower(strings.TrimSpace(user.Status)) == "disabled" {
		return LoginOutput{}, fmt.Errorf("user disabled")
	}
	token, err := randomToken(24)
	if err != nil {
		return LoginOutput{}, err
	}
	expiresAt := time.Now().UTC().Add(24 * time.Hour)
	_, err = s.repo.CreateSession(ctx, store.AuthSession{
		Token:     token,
		UserID:    user.ID,
		OrgID:     user.OrgID,
		Role:      user.Role,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		return LoginOutput{}, err
	}
	return LoginOutput{
		AccessToken:        token,
		UserID:             user.ID,
		OrgID:              user.OrgID,
		Name:               user.Name,
		Email:              user.Email,
		Role:               user.Role,
		MustChangePassword: user.MustChangePassword,
	}, nil
}

type ForgotPasswordInput struct {
	Email string `json:"email"`
}

type ForgotPasswordOutput struct {
	ResetToken string    `json:"resetToken"`
	ExpiresAt  time.Time `json:"expiresAt"`
}

func (s *AuthService) ForgotPassword(ctx context.Context, in ForgotPasswordInput) (ForgotPasswordOutput, error) {
	if strings.TrimSpace(in.Email) == "" {
		return ForgotPasswordOutput{}, fmt.Errorf("email is required")
	}

	user, err := s.repo.GetUserByEmail(ctx, in.Email)
	if err != nil {
		return ForgotPasswordOutput{}, fmt.Errorf("user not found")
	}

	token, err := randomToken(32)
	if err != nil {
		return ForgotPasswordOutput{}, err
	}
	expiresAt := time.Now().UTC().Add(30 * time.Minute)
	_, err = s.repo.SaveResetToken(ctx, store.PasswordResetToken{
		Token:     token,
		UserID:    user.ID,
		ExpiresAt: expiresAt,
		Used:      false,
	})
	if err != nil {
		return ForgotPasswordOutput{}, err
	}
	return ForgotPasswordOutput{ResetToken: token, ExpiresAt: expiresAt}, nil
}

type ResetPasswordInput struct {
	Token       string `json:"token"`
	NewPassword string `json:"newPassword"`
}

type BootstrapPlatformAdminInput struct {
	Secret   string
	Email    string
	Name     string
	Password string
}

type BootstrapPlatformAdminOutput struct {
	UserID string `json:"userId"`
	Email  string `json:"email"`
	Role   string `json:"role"`
}

type CreateOrganizationInput struct {
	Name         string `json:"name"`
	BusinessName string `json:"businessName"`
	TaxID        string `json:"taxId"`
	Address      string `json:"address"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
}

type UpdateOrganizationInput struct {
	Name          string `json:"name"`
	BusinessName  string `json:"businessName"`
	TaxID         string `json:"taxId"`
	Address       string `json:"address"`
	Email         string `json:"email"`
	Phone         string `json:"phone"`
	Status        string `json:"status"`
	PaymentStatus string `json:"paymentStatus"`
	MaxDoctors    int    `json:"maxDoctors"`
	MaxAssistants int    `json:"maxAssistants"`
	MaxPatients   int    `json:"maxPatients"`
}

type OrgLimitsDTO struct {
	MaxDoctors    int `json:"maxDoctors"`
	MaxAssistants int `json:"maxAssistants"`
	MaxPatients   int `json:"maxPatients"`
}

type OrganizationDTO struct {
	ID            string       `json:"id"`
	Name          string       `json:"name"`
	BusinessName  string       `json:"businessName"`
	TaxID         string       `json:"taxId"`
	Address       string       `json:"address"`
	Email         string       `json:"email"`
	Phone         string       `json:"phone"`
	Status        string       `json:"status"`
	PaymentStatus string       `json:"paymentStatus"`
	Limits        OrgLimitsDTO `json:"limits"`
	CreatedAt     time.Time    `json:"createdAt"`
	UpdatedAt     *time.Time   `json:"updatedAt,omitempty"`
}

type UserProfileDTO struct {
	ID        string       `json:"id"`
	OrgID     string       `json:"orgId"`
	Name      string       `json:"name"`
	Email     string       `json:"email"`
	Role      string       `json:"role"`
	Status    string       `json:"status"`
	OrgName   string       `json:"orgName"`
	OrgLimits OrgLimitsDTO `json:"orgLimits"`
}

type CreateOrgAdminInput struct {
	OrgID    string `json:"orgId"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type CreateOrgUserInput struct {
	OrgID    string `json:"orgId"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Address  string `json:"address"`
	Role     string `json:"role"`
	Password string `json:"password"`
}

func (s *AuthService) BootstrapPlatformAdmin(ctx context.Context, in BootstrapPlatformAdminInput) (BootstrapPlatformAdminOutput, error) {
	secret := strings.TrimSpace(os.Getenv("BOOTSTRAP_SECRET"))
	if secret == "" {
		return BootstrapPlatformAdminOutput{}, fmt.Errorf("bootstrap disabled")
	}
	if strings.TrimSpace(in.Secret) == "" || in.Secret != secret {
		return BootstrapPlatformAdminOutput{}, fmt.Errorf("invalid secret")
	}

	defaultEmail := strings.TrimSpace(os.Getenv("PLATFORM_ADMIN_EMAIL"))
	if strings.TrimSpace(in.Email) == "" {
		in.Email = defaultEmail
	}
	if strings.TrimSpace(in.Email) == "" {
		return BootstrapPlatformAdminOutput{}, fmt.Errorf("email is required")
	}
	if strings.TrimSpace(in.Name) == "" {
		in.Name = "Platform Admin"
	}
	if strings.TrimSpace(in.Password) == "" {
		return BootstrapPlatformAdminOutput{}, fmt.Errorf("password is required")
	}
	if len(in.Password) < 8 {
		return BootstrapPlatformAdminOutput{}, fmt.Errorf("password must have at least 8 characters")
	}

	// Idempotent: if exists, return it.
	if existing, err := s.repo.GetUserByEmail(ctx, in.Email); err == nil {
		if strings.ToLower(strings.TrimSpace(existing.Role)) != "platform_admin" {
			return BootstrapPlatformAdminOutput{}, fmt.Errorf("user exists with different role")
		}
		return BootstrapPlatformAdminOutput{UserID: existing.ID, Email: existing.Email, Role: existing.Role}, nil
	}

	user := store.AuthUser{
		ID:           buildID("usr"),
		OrgID:        "platform",
		Name:         strings.TrimSpace(in.Name),
		Email:        strings.ToLower(strings.TrimSpace(in.Email)),
		Role:         "platform_admin",
		Status:       "active",
		PasswordHash: hashPassword(in.Password),
		CreatedAt:    time.Now().UTC(),
	}
	created, err := s.repo.CreateUser(ctx, user)
	if err != nil {
		return BootstrapPlatformAdminOutput{}, err
	}
	return BootstrapPlatformAdminOutput{UserID: created.ID, Email: created.Email, Role: created.Role}, nil
}

func orgToDTO(org store.Organization) OrganizationDTO {
	return OrganizationDTO{
		ID:            org.ID,
		Name:          org.Name,
		BusinessName:  org.BusinessName,
		TaxID:         org.TaxID,
		Address:       org.Address,
		Email:         org.Email,
		Phone:         org.Phone,
		Status:        org.Status,
		PaymentStatus: org.PaymentStatus,
		Limits:        OrgLimitsDTO{MaxDoctors: org.Limits.MaxDoctors, MaxAssistants: org.Limits.MaxAssistants, MaxPatients: org.Limits.MaxPatients},
		CreatedAt:     org.CreatedAt,
		UpdatedAt:     org.UpdatedAt,
	}
}

func (s *AuthService) CreateOrganization(ctx context.Context, in CreateOrganizationInput) (OrganizationDTO, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return OrganizationDTO{}, fmt.Errorf("name is required")
	}
	org := store.Organization{
		ID:            buildID("org"),
		Name:          name,
		BusinessName:  strings.TrimSpace(in.BusinessName),
		TaxID:         strings.TrimSpace(in.TaxID),
		Address:       strings.TrimSpace(in.Address),
		Email:         strings.ToLower(strings.TrimSpace(in.Email)),
		Phone:         strings.TrimSpace(in.Phone),
		Status:        "active",
		PaymentStatus: "current",
		Limits:        store.OrgLimits{MaxDoctors: 5, MaxAssistants: 2, MaxPatients: 20},
		CreatedAt:     time.Now().UTC(),
	}
	created, err := s.repo.CreateOrganization(ctx, org)
	if err != nil {
		return OrganizationDTO{}, err
	}
	if s.notifier != nil && created.Email != "" {
		_ = s.notifier.SendOrgCreated(ctx, created.Email, created.Name, created.Name)
	}
	return orgToDTO(created), nil
}

func (s *AuthService) GetOrganization(ctx context.Context, orgID string) (OrganizationDTO, error) {
	org, err := s.repo.GetOrganization(ctx, orgID)
	if err != nil {
		return OrganizationDTO{}, err
	}
	return orgToDTO(org), nil
}

func (s *AuthService) UpdateOrganization(ctx context.Context, orgID string, in UpdateOrganizationInput) (OrganizationDTO, error) {
	org, err := s.repo.GetOrganization(ctx, orgID)
	if err != nil {
		return OrganizationDTO{}, fmt.Errorf("organization not found")
	}
	if v := strings.TrimSpace(in.Name); v != "" {
		org.Name = v
	}
	if v := strings.TrimSpace(in.BusinessName); v != "" {
		org.BusinessName = v
	}
	if v := strings.TrimSpace(in.TaxID); v != "" {
		org.TaxID = v
	}
	if v := strings.TrimSpace(in.Address); v != "" {
		org.Address = v
	}
	if v := strings.TrimSpace(in.Email); v != "" {
		org.Email = strings.ToLower(v)
	}
	if v := strings.TrimSpace(in.Phone); v != "" {
		org.Phone = v
	}
	if in.Status != "" {
		if in.Status != "active" && in.Status != "inactive" {
			return OrganizationDTO{}, fmt.Errorf("status must be active or inactive")
		}
		org.Status = in.Status
	}
	if in.PaymentStatus != "" {
		if in.PaymentStatus != "current" && in.PaymentStatus != "overdue" && in.PaymentStatus != "suspended" {
			return OrganizationDTO{}, fmt.Errorf("paymentStatus must be current, overdue or suspended")
		}
		org.PaymentStatus = in.PaymentStatus
	}
	if in.MaxDoctors > 0 {
		org.Limits.MaxDoctors = in.MaxDoctors
	}
	if in.MaxAssistants > 0 {
		org.Limits.MaxAssistants = in.MaxAssistants
	}
	if in.MaxPatients > 0 {
		org.Limits.MaxPatients = in.MaxPatients
	}
	updated, err := s.repo.UpdateOrganization(ctx, org)
	if err != nil {
		return OrganizationDTO{}, err
	}
	return orgToDTO(updated), nil
}

func (s *AuthService) DeleteOrganization(ctx context.Context, orgID string) error {
	if _, err := s.repo.GetOrganization(ctx, orgID); err != nil {
		return fmt.Errorf("organization not found")
	}
	return s.repo.DeleteOrganization(ctx, orgID)
}

func (s *AuthService) ListOrganizations(ctx context.Context) ([]OrganizationDTO, error) {
	items, err := s.repo.ListOrganizations(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]OrganizationDTO, 0, len(items))
	for _, org := range items {
		result = append(result, orgToDTO(org))
	}
	return result, nil
}

type PlatformStatsDTO struct {
	TotalOrgs          int     `json:"totalOrgs"`
	ActiveOrgs         int     `json:"activeOrgs"`
	TotalDoctors       int     `json:"totalDoctors"`
	TotalAssistants    int     `json:"totalAssistants"`
	TotalAdmins        int     `json:"totalAdmins"`
	TotalUsers         int     `json:"totalUsers"`
	TotalPatients      int     `json:"totalPatients"`
	TotalAppointments  int     `json:"totalAppointments"`
	TotalRevenue       float64 `json:"totalRevenue"`
	TotalConsultations int     `json:"totalConsultations"`
}

// OrgStatsDTO holds stats scoped to a single organization
type OrgStatsDTO struct {
	TotalDoctors       int     `json:"totalDoctors"`
	TotalAssistants    int     `json:"totalAssistants"`
	TotalAdmins        int     `json:"totalAdmins"`
	TotalUsers         int     `json:"totalUsers"`
	TotalPatients      int     `json:"totalPatients"`
	MaxDoctors         int     `json:"maxDoctors"`
	MaxAssistants      int     `json:"maxAssistants"`
	MaxPatients        int     `json:"maxPatients"`
	TotalRevenue       float64 `json:"totalRevenue"`
	PendingRevenue     float64 `json:"pendingRevenue"`
	TotalConsultations int     `json:"totalConsultations"`
}

// GetOrgStats returns stats for a specific org: user counts by role + real patient count.
func (s *AuthService) GetOrgStats(ctx context.Context, orgID string) (OrgStatsDTO, error) {
	users, err := s.repo.ListUsersByOrg(ctx, orgID)
	if err != nil {
		return OrgStatsDTO{}, fmt.Errorf("list users: %w", err)
	}

	var stats OrgStatsDTO
	for _, u := range users {
		if u.Status == "disabled" {
			continue
		}
		stats.TotalUsers++
		switch u.Role {
		case "doctor":
			stats.TotalDoctors++
		case "assistant":
			stats.TotalAssistants++
		case "admin":
			stats.TotalAdmins++
		}
	}

	// Count real patients from patient table filtered by orgID
	if s.patientRepo != nil {
		orgCtx := store.ContextWithOrgID(ctx, orgID)
		if patients, err := s.patientRepo.ListByDoctor(orgCtx, ""); err == nil {
			stats.TotalPatients = len(patients)
		}
	}

	// Attach org limits
	if org, err := s.repo.GetOrganization(ctx, orgID); err == nil {
		stats.MaxDoctors = org.Limits.MaxDoctors
		stats.MaxAssistants = org.Limits.MaxAssistants
		stats.MaxPatients = org.Limits.MaxPatients
	}

	// Payment stats
	if s.appointmentRepo != nil {
		orgCtx := store.ContextWithOrgID(ctx, orgID)
		if payments, err := s.appointmentRepo.ScanOrgPayments(orgCtx, orgID); err == nil {
			for _, p := range payments {
				stats.TotalConsultations++
				if p.Status == "completed" {
					stats.TotalRevenue += p.PaymentAmount
				} else if p.Status != "cancelled" {
					stats.PendingRevenue += p.PaymentAmount
				}
			}
		}
	}

	return stats, nil
}

func (s *AuthService) GetPlatformStats(ctx context.Context) (PlatformStatsDTO, error) {
	orgs, err := s.repo.ListOrganizations(ctx)
	if err != nil {
		return PlatformStatsDTO{}, err
	}
	stats := PlatformStatsDTO{TotalOrgs: len(orgs)}
	for _, org := range orgs {
		if org.Status == "active" {
			stats.ActiveOrgs++
		}
		users, err := s.repo.ListUsersByOrg(ctx, org.ID)
		if err != nil {
			continue
		}
		for _, u := range users {
			if u.Status == "disabled" {
				continue
			}
			stats.TotalUsers++
			switch u.Role {
			case "doctor":
				stats.TotalDoctors++
			case "assistant":
				stats.TotalAssistants++
			case "admin":
				stats.TotalAdmins++
			}
		}
	}
	if s.patientRepo != nil {
		if patients, err := s.patientRepo.ListAll(ctx); err == nil {
			stats.TotalPatients = len(patients)
		}
	}
	// Payment stats across all orgs
	if s.appointmentRepo != nil {
		if payments, err := s.appointmentRepo.ScanAllPayments(ctx); err == nil {
			for _, p := range payments {
				stats.TotalConsultations++
				stats.TotalRevenue += p.PaymentAmount
			}
		}
	}
	return stats, nil
}

func (s *AuthService) GetUserProfile(ctx context.Context, userID string) (UserProfileDTO, error) {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return UserProfileDTO{}, fmt.Errorf("user not found")
	}
	profile := UserProfileDTO{
		ID:     user.ID,
		OrgID:  user.OrgID,
		Name:   user.Name,
		Email:  user.Email,
		Role:   user.Role,
		Status: user.Status,
	}
	if org, err := s.repo.GetOrganization(ctx, user.OrgID); err == nil {
		profile.OrgName = org.Name
		profile.OrgLimits = OrgLimitsDTO{
			MaxDoctors:    org.Limits.MaxDoctors,
			MaxAssistants: org.Limits.MaxAssistants,
			MaxPatients:   org.Limits.MaxPatients,
		}
	}
	return profile, nil
}

func (s *AuthService) CreateOrgAdmin(ctx context.Context, in CreateOrgAdminInput) (store.AuthUser, error) {
	if strings.TrimSpace(in.OrgID) == "" {
		return store.AuthUser{}, fmt.Errorf("orgId is required")
	}
	if strings.TrimSpace(in.Email) == "" {
		return store.AuthUser{}, fmt.Errorf("email is required")
	}
	if len(in.Password) < 8 {
		return store.AuthUser{}, fmt.Errorf("password must have at least 8 characters")
	}
	if _, err := s.repo.GetOrganization(ctx, in.OrgID); err != nil {
		return store.AuthUser{}, fmt.Errorf("organization not found")
	}
	user := store.AuthUser{
		ID:           buildID("usr"),
		OrgID:        in.OrgID,
		Name:         strings.TrimSpace(in.Name),
		Email:        strings.ToLower(strings.TrimSpace(in.Email)),
		Role:         "admin",
		Status:       "active",
		PasswordHash: hashPassword(in.Password),
		CreatedAt:    time.Now().UTC(),
	}
	return s.repo.CreateUser(ctx, user)
}

func (s *AuthService) CreateOrgUser(ctx context.Context, in CreateOrgUserInput) (UserDTO, error) {
	if strings.TrimSpace(in.OrgID) == "" {
		return UserDTO{}, fmt.Errorf("orgId is required")
	}
	if strings.TrimSpace(in.Name) == "" {
		return UserDTO{}, fmt.Errorf("name is required")
	}
	if strings.TrimSpace(in.Email) == "" {
		return UserDTO{}, fmt.Errorf("email is required")
	}
	validRoles := map[string]bool{"admin": true, "doctor": true, "assistant": true, "patient": true}
	if !validRoles[in.Role] {
		return UserDTO{}, fmt.Errorf("invalid role")
	}
	if _, err := s.repo.GetOrganization(ctx, in.OrgID); err != nil {
		return UserDTO{}, fmt.Errorf("organization not found")
	}
	if err := s.checkRoleLimit(ctx, in.OrgID, in.Role); err != nil {
		return UserDTO{}, err
	}
	tempPassword, err := generateTempPassword()
	if err != nil {
		return UserDTO{}, err
	}
	user := store.AuthUser{
		ID:                 buildID("usr"),
		OrgID:              in.OrgID,
		Name:               strings.TrimSpace(in.Name),
		Email:              strings.ToLower(strings.TrimSpace(in.Email)),
		Phone:              strings.TrimSpace(in.Phone),
		Address:            strings.TrimSpace(in.Address),
		Role:               in.Role,
		Status:             "active",
		PasswordHash:       hashPassword(tempPassword),
		MustChangePassword: true,
		CreatedAt:          time.Now().UTC(),
	}
	created, err := s.repo.CreateUser(ctx, user)
	if err != nil {
		return UserDTO{}, err
	}
	if s.notifier != nil {
		base := s.frontendBaseURL
		if base == "" {
			base = os.Getenv("FRONTEND_BASE_URL")
		}
		loginURL := fmt.Sprintf("%s/login", strings.TrimRight(base, "/"))
		_ = s.notifier.SendWelcome(ctx, created.Email, created.Name, created.Role, tempPassword, loginURL)
	}
	return UserDTO{
		ID: created.ID, OrgID: created.OrgID, Name: created.Name,
		Email: created.Email, Phone: created.Phone, Address: created.Address,
		Role: created.Role, Status: created.Status, CreatedAt: created.CreatedAt,
	}, nil
}

type UserDTO struct {
	ID        string    `json:"id"`
	OrgID     string    `json:"orgId"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Phone     string    `json:"phone"`
	Address   string    `json:"address"`
	Role      string    `json:"role"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

type UpdateOrgUserInput struct {
	OrgID   string `json:"orgId"`
	UserID  string `json:"userId"`
	Name    string `json:"name,omitempty"`
	Email   string `json:"email,omitempty"`
	Phone   string `json:"phone,omitempty"`
	Address string `json:"address,omitempty"`
	Role    string `json:"role,omitempty"`
	Status  string `json:"status,omitempty"`
}

type InviteUserInput struct {
	OrgID     string `json:"orgId"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	InvitedBy string `json:"invitedBy"`
}

type InviteUserOutput struct {
	Token     string    `json:"token"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type AcceptInvitationInput struct {
	Token    string `json:"token"`
	Name     string `json:"name"`
	Phone    string `json:"phone"`
	Address  string `json:"address"`
	Password string `json:"password"`
}

func (s *AuthService) ListOrgUsers(ctx context.Context, orgID string) ([]UserDTO, error) {
	if strings.TrimSpace(orgID) == "" {
		return nil, fmt.Errorf("orgId is required")
	}
	users, err := s.repo.ListUsersByOrg(ctx, orgID)
	if err != nil {
		return nil, err
	}
	result := make([]UserDTO, 0, len(users))
	for _, u := range users {
		result = append(result, UserDTO{
			ID: u.ID, OrgID: u.OrgID, Name: u.Name,
			Email: u.Email, Phone: u.Phone, Address: u.Address,
			Role: u.Role, Status: u.Status, CreatedAt: u.CreatedAt,
		})
	}
	return result, nil
}

func (s *AuthService) UpdateOrgUser(ctx context.Context, in UpdateOrgUserInput) (UserDTO, error) {
	user, err := s.repo.GetUserByID(ctx, in.UserID)
	if err != nil {
		return UserDTO{}, fmt.Errorf("user not found")
	}
	if user.OrgID != in.OrgID {
		return UserDTO{}, fmt.Errorf("user does not belong to org")
	}
	if in.Name != "" {
		user.Name = strings.TrimSpace(in.Name)
	}
	if in.Email != "" {
		newEmail := strings.ToLower(strings.TrimSpace(in.Email))
		if newEmail != user.Email {
			if existing, err := s.repo.GetUserByEmail(ctx, newEmail); err == nil && existing.ID != user.ID {
				return UserDTO{}, fmt.Errorf("email already in use")
			}
			user.Email = newEmail
		}
	}
	if in.Phone != "" {
		user.Phone = strings.TrimSpace(in.Phone)
	}
	if in.Address != "" {
		user.Address = strings.TrimSpace(in.Address)
	}
	if in.Role != "" {
		validRoles := map[string]bool{"admin": true, "doctor": true, "assistant": true, "patient": true}
		if !validRoles[in.Role] {
			return UserDTO{}, fmt.Errorf("invalid role")
		}
		if in.Role != user.Role {
			if err := s.checkRoleLimit(ctx, in.OrgID, in.Role); err != nil {
				return UserDTO{}, err
			}
		}
		user.Role = in.Role
	}
	if in.Status != "" {
		if in.Status != "active" && in.Status != "disabled" {
			return UserDTO{}, fmt.Errorf("invalid status, must be active or disabled")
		}
		user.Status = in.Status
	}
	updated, err := s.repo.UpdateUser(ctx, user)
	if err != nil {
		return UserDTO{}, err
	}
	return UserDTO{
		ID: updated.ID, OrgID: updated.OrgID, Name: updated.Name,
		Email: updated.Email, Phone: updated.Phone, Address: updated.Address,
		Role: updated.Role, Status: updated.Status, CreatedAt: updated.CreatedAt,
	}, nil
}

func (s *AuthService) DeleteOrgUser(ctx context.Context, orgID, userID string) error {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found")
	}
	if user.OrgID != orgID {
		return fmt.Errorf("user does not belong to org")
	}
	return s.repo.DeleteUser(ctx, orgID, userID)
}

func (s *AuthService) checkRoleLimit(ctx context.Context, orgID, role string) error {
	org, err := s.repo.GetOrganization(ctx, orgID)
	if err != nil {
		return nil // no org found, skip limit check
	}
	var limit int
	switch role {
	case "doctor":
		limit = org.Limits.MaxDoctors
		if limit == 0 {
			limit = 5
		}
	case "assistant":
		limit = org.Limits.MaxAssistants
		if limit == 0 {
			limit = 2
		}
	default:
		return nil
	}
	users, err := s.repo.ListUsersByOrg(ctx, orgID)
	if err != nil {
		return err
	}
	count := 0
	for _, u := range users {
		if u.Role == role && u.Status != "disabled" {
			count++
		}
	}
	if count >= limit {
		return fmt.Errorf("role limit reached: max %d %s(s) per org", limit, role)
	}
	return nil
}

func (s *AuthService) InviteUser(ctx context.Context, in InviteUserInput) (InviteUserOutput, error) {
	if strings.TrimSpace(in.OrgID) == "" || strings.TrimSpace(in.Email) == "" || strings.TrimSpace(in.Role) == "" {
		return InviteUserOutput{}, fmt.Errorf("orgId, email and role are required")
	}
	validRoles := map[string]bool{"admin": true, "doctor": true, "assistant": true, "patient": true}
	if !validRoles[in.Role] {
		return InviteUserOutput{}, fmt.Errorf("invalid role")
	}
	if err := s.checkRoleLimit(ctx, in.OrgID, in.Role); err != nil {
		return InviteUserOutput{}, err
	}
	tempPassword, err := generateTempPassword()
	if err != nil {
		return InviteUserOutput{}, err
	}
	token, err := randomToken(32)
	if err != nil {
		return InviteUserOutput{}, err
	}
	expiresAt := time.Now().UTC().Add(72 * time.Hour)
	inv := store.UserInvitation{
		Token:        token,
		OrgID:        in.OrgID,
		Email:        strings.ToLower(strings.TrimSpace(in.Email)),
		Role:         in.Role,
		InvitedBy:    in.InvitedBy,
		TempPassword: hashPassword(tempPassword),
		ExpiresAt:    expiresAt,
		Used:         false,
	}
	created, err := s.repo.CreateInvitation(ctx, inv)
	if err != nil {
		return InviteUserOutput{}, err
	}
	if s.notifier != nil {
		base := s.frontendBaseURL
		if base == "" {
			base = os.Getenv("FRONTEND_BASE_URL")
		}
		inviteURL := fmt.Sprintf("%s/accept-invitation?token=%s", strings.TrimRight(base, "/"), created.Token)
		_ = s.notifier.SendInvitation(ctx, created.Email, inviteURL, created.Role, tempPassword)
	}
	return InviteUserOutput{Token: created.Token, Email: created.Email, Role: created.Role, ExpiresAt: created.ExpiresAt}, nil
}

func (s *AuthService) AcceptInvitation(ctx context.Context, in AcceptInvitationInput) (LoginOutput, error) {
	if strings.TrimSpace(in.Token) == "" {
		return LoginOutput{}, fmt.Errorf("token is required")
	}
	if len(in.Password) < 8 {
		return LoginOutput{}, fmt.Errorf("password must have at least 8 characters")
	}
	inv, err := s.repo.GetInvitation(ctx, in.Token)
	if err != nil {
		return LoginOutput{}, fmt.Errorf("invalid invitation token")
	}
	if inv.Used || time.Now().UTC().After(inv.ExpiresAt) {
		return LoginOutput{}, fmt.Errorf("invitation expired or already used")
	}
	user := store.AuthUser{
		ID:           buildID("usr"),
		OrgID:        inv.OrgID,
		Name:         strings.TrimSpace(in.Name),
		Email:        inv.Email,
		Phone:        strings.TrimSpace(in.Phone),
		Address:      strings.TrimSpace(in.Address),
		Role:         inv.Role,
		Status:       "active",
		PasswordHash: hashPassword(in.Password),
		CreatedAt:    time.Now().UTC(),
	}
	created, err := s.repo.CreateUser(ctx, user)
	if err != nil {
		return LoginOutput{}, err
	}
	if err := s.repo.MarkInvitationUsed(ctx, in.Token); err != nil {
		return LoginOutput{}, err
	}
	token, err := randomToken(24)
	if err != nil {
		return LoginOutput{}, err
	}
	_, err = s.repo.CreateSession(ctx, store.AuthSession{
		Token:     token,
		UserID:    created.ID,
		OrgID:     created.OrgID,
		Role:      created.Role,
		ExpiresAt: time.Now().UTC().Add(24 * time.Hour),
	})
	if err != nil {
		return LoginOutput{}, err
	}
	return LoginOutput{
		AccessToken: token,
		UserID:      created.ID,
		OrgID:       created.OrgID,
		Name:        created.Name,
		Email:       created.Email,
		Role:        created.Role,
	}, nil
}

type ChangePasswordInput struct {
	UserID      string `json:"userId"`
	OldPassword string `json:"oldPassword"`
	NewPassword string `json:"newPassword"`
}

func (s *AuthService) ChangePassword(ctx context.Context, in ChangePasswordInput) error {
	if len(in.NewPassword) < 8 {
		return fmt.Errorf("newPassword must have at least 8 characters")
	}
	user, err := s.repo.GetUserByID(ctx, in.UserID)
	if err != nil {
		return fmt.Errorf("user not found")
	}
	if user.PasswordHash != hashPassword(in.OldPassword) {
		return fmt.Errorf("invalid current password")
	}
	if err := s.repo.UpdateUserPassword(ctx, in.UserID, hashPassword(in.NewPassword)); err != nil {
		return err
	}
	// Clear the must-change flag
	user.MustChangePassword = false
	_, err = s.repo.UpdateUser(ctx, user)
	return err
}

func (s *AuthService) ResetPassword(ctx context.Context, in ResetPasswordInput) error {
	if strings.TrimSpace(in.Token) == "" || strings.TrimSpace(in.NewPassword) == "" {
		return fmt.Errorf("token and newPassword are required")
	}
	if len(in.NewPassword) < 8 {
		return fmt.Errorf("newPassword must have at least 8 characters")
	}

	resetToken, err := s.repo.GetResetToken(ctx, in.Token)
	if err != nil {
		return fmt.Errorf("invalid token")
	}
	if resetToken.Used || time.Now().UTC().After(resetToken.ExpiresAt) {
		return fmt.Errorf("token expired or already used")
	}

	if err := s.repo.UpdateUserPassword(ctx, resetToken.UserID, hashPassword(in.NewPassword)); err != nil {
		return err
	}
	return s.repo.MarkResetTokenUsed(ctx, in.Token)
}

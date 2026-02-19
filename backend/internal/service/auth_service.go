package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"strings"
	"time"

	"clinical-backend/internal/store"
)

type AuthService struct {
	repo store.AuthRepository
}

func NewAuthService(repo store.AuthRepository) *AuthService {
	return &AuthService{repo: repo}
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
	AccessToken string `json:"accessToken"`
	UserID      string `json:"userId"`
	OrgID       string `json:"orgId"`
	Name        string `json:"name"`
	Email       string `json:"email"`
	Role        string `json:"role"`
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
		AccessToken: token,
		UserID:      user.ID,
		OrgID:       user.OrgID,
		Name:        user.Name,
		Email:       user.Email,
		Role:        user.Role,
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

func hashPassword(password string) string {
	hash := sha256.Sum256([]byte(password))
	return hex.EncodeToString(hash[:])
}

func randomToken(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

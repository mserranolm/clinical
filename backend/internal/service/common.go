package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"
)

// generateTempPassword generates a secure temporary password
func generateTempPassword() (string, error) {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
	b := make([]byte, 12)
	for i := range b {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "", err
		}
		b[i] = charset[n.Int64()]
	}
	return string(b), nil
}

// hashPassword creates a SHA-256 hash of the password
func hashPassword(password string) string {
	hash := sha256.Sum256([]byte(password))
	return hex.EncodeToString(hash[:])
}

// randomToken generates a random token of specified size
func randomToken(size int) (string, error) {
	b := make([]byte, size)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// validateEmail performs basic email validation
func validateEmail(email string) bool {
	email = strings.TrimSpace(strings.ToLower(email))
	if !strings.Contains(email, "@") || !strings.Contains(email, ".") {
		return false
	}
	parts := strings.Split(email, "@")
	if len(parts) != 2 || len(parts[0]) == 0 || len(parts[1]) == 0 {
		return false
	}
	return true
}

// validatePassword validates password strength
func validatePassword(password string) error {
	if len(password) < 8 {
		return fmt.Errorf("password must be at least 8 characters long")
	}

	var (
		hasUpper   bool
		hasLower   bool
		hasNumber  bool
		hasSpecial bool
	)

	for _, char := range password {
		switch {
		case char >= 'A' && char <= 'Z':
			hasUpper = true
		case char >= 'a' && char <= 'z':
			hasLower = true
		case char >= '0' && char <= '9':
			hasNumber = true
		case strings.ContainsRune("!@#$%^&*()_+-=[]{}|;:,.<>?", char):
			hasSpecial = true
		}
	}

	if !hasUpper || !hasLower || !hasNumber {
		return fmt.Errorf("password must contain uppercase, lowercase, and numbers")
	}

	// hasSpecial is optional but tracked for future requirements
	_ = hasSpecial

	return nil
}

// sanitizeInput removes leading/trailing whitespace and normalizes
func sanitizeInput(input string) string {
	return strings.TrimSpace(input)
}

// isValidRole checks if the role is valid
func isValidRole(role string) bool {
	validRoles := map[string]bool{
		"admin":     true,
		"doctor":    true,
		"assistant": true,
		"patient":   true,
	}
	return validRoles[strings.ToLower(role)]
}

// isValidStatus checks if the status is valid
func isValidStatus(status string) bool {
	validStatuses := map[string]bool{
		"active":   true,
		"inactive": true,
		"disabled": true,
	}
	return validStatuses[strings.ToLower(status)]
}

// formatPhoneNumber formats phone number for consistency
func formatPhoneNumber(phone string) string {
	// Remove all non-digit characters
	phone = strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, phone)

	// Basic formatting for Colombian numbers
	if len(phone) == 10 && phone[0] == '3' {
		return fmt.Sprintf("+57 %s", phone)
	}

	return phone
}

// calculateAge calculates age from birth date
func calculateAge(birthDate time.Time) int {
	now := time.Now()
	years := now.Year() - birthDate.Year()
	if now.Month() < birthDate.Month() || (now.Month() == birthDate.Month() && now.Day() < birthDate.Day()) {
		years--
	}
	return years
}

// isValidTimeSlot checks if the time slot is valid (30-minute intervals)
func isValidTimeSlot(start, end time.Time) bool {
	duration := end.Sub(start)
	return duration == 30*time.Minute || duration == 60*time.Minute || duration == 90*time.Minute || duration == 120*time.Minute
}

// generateAppointmentID generates a unique appointment ID
func generateAppointmentID() string {
	timestamp := time.Now().UnixNano()
	random, _ := randomToken(4)
	return fmt.Sprintf("apt_%d_%s", timestamp, random)
}

// paginateResults helps with pagination
func paginateResults(page, limit int, total int64) (offset int, totalPages int) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}

	offset = (page - 1) * limit
	totalPages = int((total + int64(limit) - 1) / int64(limit))

	return offset, totalPages
}

// contains checks if a string exists in a slice
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// unique removes duplicates from a slice
func unique(slice []string) []string {
	keys := make(map[string]bool)
	result := []string{}

	for _, item := range slice {
		if !keys[item] {
			keys[item] = true
			result = append(result, item)
		}
	}

	return result
}

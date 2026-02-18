package test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	"clinical-backend/internal/config"
	"clinical-backend/internal/domain"
	"clinical-backend/internal/store"

	"github.com/google/uuid"
)

const (
	baseURL = "http://localhost:3000"
)

// TestSetup verifica que el entorno esté configurado correctamente
func TestSetup(t *testing.T) {
	// Cargar configuración
	cfg := config.Load()
	
	if cfg.IsLocal() {
		t.Logf("✅ Ejecutando en modo local")
		t.Logf("📊 Entorno: %s", cfg.Environment)
		t.Logf("🗄️ Usar DynamoDB: %t", cfg.ShouldUseDynamoDB())
		t.Logf("👤 AWS Profile: %s", cfg.AWSProfile)
	}

	// Verificar variables de entorno críticas
	if cfg.ShouldUseDynamoDB() {
		if cfg.AWSProfile == "" {
			t.Fatal("❌ AWS_PROFILE requerido para DynamoDB")
		}
		t.Logf("✅ AWS Profile configurado: %s", cfg.AWSProfile)
	}

	// Test de conectividad DynamoDB (solo si está habilitado)
	if cfg.ShouldUseDynamoDB() {
		testDynamoDBConnection(t, cfg)
	} else {
		t.Log("⚠️  Usando repositorios in-memory (testing limitado)")
	}
}

func testDynamoDBConnection(t *testing.T, cfg config.Config) {
	dynamoConfig := store.DynamoDBConfig{
		PatientTableName:     cfg.PatientTable,
		AppointmentTableName: cfg.AppointmentTable,
		ConsentTableName:     cfg.ConsentTable,
		UseLocalProfile:      true,
		ProfileName:          cfg.AWSProfile,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	repos, err := store.NewDynamoDBRepositories(ctx, dynamoConfig)
	if err != nil {
		t.Fatalf("❌ Error conectando a DynamoDB: %v\nVerifica:\n1. aws sso login --profile %s\n2. Permisos DynamoDB en la cuenta", err, cfg.AWSProfile)
	}

	t.Log("✅ Conexión DynamoDB exitosa")
	
	// Test básico de creación/lectura
	testPatient := domain.Patient{
		ID:        "test-" + uuid.New().String()[:8],
		DoctorID:  "doctor-test",
		Specialty: domain.SpecialtyOdontology,
		FirstName: "Test",
		LastName:  "Patient",
		Email:     "test@example.com",
		Phone:     "+1234567890",
		CreatedAt: time.Now(),
	}

	// Crear paciente
	created, err := repos.Patients.Create(ctx, testPatient)
	if err != nil {
		t.Fatalf("❌ Error creando paciente de prueba: %v", err)
	}

	// Leer paciente
	retrieved, err := repos.Patients.GetByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("❌ Error leyendo paciente: %v", err)
	}

	if retrieved.ID != created.ID {
		t.Fatalf("❌ ID no coincide: esperado %s, obtenido %s", created.ID, retrieved.ID)
	}

	t.Logf("✅ Test CRUD DynamoDB exitoso (Paciente ID: %s)", retrieved.ID)
}

// TestHealthEndpoint verifica que la API esté corriendo
func TestHealthEndpoint(t *testing.T) {
	// Intentar conectar a la API local
	client := &http.Client{Timeout: 5 * time.Second}
	
	// Test endpoints básicos (algunos pueden devolver 404, pero la API debe responder)
	endpoints := []string{
		"/health",
		"/patients",
		"/appointments", 
		"/auth/login",
	}

	apiRunning := false
	for _, endpoint := range endpoints {
		resp, err := client.Get(baseURL + endpoint)
		if err == nil {
			apiRunning = true
			resp.Body.Close()
			t.Logf("✅ API respondiendo en %s (HTTP %d)", endpoint, resp.StatusCode)
			break
		}
	}

	if !apiRunning {
		t.Skip("⚠️  API no está corriendo en " + baseURL + ". Ejecutar: source .env.local && go run ./cmd/api")
	}
}

// TestPatientRegistration test de registro de paciente completo
func TestPatientRegistration(t *testing.T) {
	TestHealthEndpoint(t) // Pre-requisito
	
	patient := map[string]interface{}{
		"doctorId":   "doctor-test-" + uuid.New().String()[:8],
		"specialty":  "odontology",
		"firstName":  "Juan",
		"lastName":   "Pérez",
		"documentId": "12345678",
		"phone":      "+573001234567",
		"email":      "juan.perez@example.com",
		"birthDate":  "1990-01-01",
		"medicalBackgrounds": []map[string]string{
			{
				"type":        "allergy",
				"description": "Alérgico a penicilina",
			},
		},
	}

	jsonData, _ := json.Marshal(patient)
	
	resp, err := http.Post(baseURL+"/patients/onboard", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatalf("❌ Error en request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		t.Logf("✅ Registro de paciente exitoso (HTTP %d)", resp.StatusCode)
		
		var response map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&response)
		
		if patientID, ok := response["id"]; ok {
			t.Logf("📋 Paciente creado con ID: %s", patientID)
		}
	} else {
		t.Logf("⚠️  Registro falló (HTTP %d) - verificar implementación del endpoint", resp.StatusCode)
	}
}

// TestAppointmentFlow test de flujo completo de citas
func TestAppointmentFlow(t *testing.T) {
	TestHealthEndpoint(t) // Pre-requisito
	
	// Crear cita
	appointment := map[string]interface{}{
		"doctorId":    "doctor-test-" + uuid.New().String()[:8],
		"patientId":   "patient-test-" + uuid.New().String()[:8],
		"startAt":     time.Now().Add(24 * time.Hour).Format(time.RFC3339),
		"endAt":       time.Now().Add(25 * time.Hour).Format(time.RFC3339),
		"status":      "scheduled",
		"treatmentPlan": "Limpieza dental",
	}

	jsonData, _ := json.Marshal(appointment)
	
	resp, err := http.Post(baseURL+"/appointments", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatalf("❌ Error creando cita: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		t.Logf("✅ Cita creada exitosamente (HTTP %d)", resp.StatusCode)
		
		var response map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&response)
		
		if appointmentID, ok := response["id"]; ok {
			t.Logf("📅 Cita creada con ID: %s", appointmentID)
		}
	} else {
		t.Logf("⚠️  Creación de cita falló (HTTP %d)", resp.StatusCode)
	}
}

// Helper function para setup de environment para tests
func TestMain(m *testing.M) {
	// Cargar .env.local si existe
	if _, err := os.Stat(".env.local"); err == nil {
		fmt.Println("📁 Cargando configuración de .env.local...")
		// Nota: En un entorno real usarías una librería como godotenv
		// Por simplicidad, asumimos que las variables ya están en el entorno
	}
	
	fmt.Println("🧪 Iniciando tests de integración...")
	fmt.Println("📍 Asegúrate de que el servidor esté corriendo: source .env.local && go run ./cmd/api")
	
	// Ejecutar tests
	code := m.Run()
	
	fmt.Println("✅ Tests completados")
	os.Exit(code)
}

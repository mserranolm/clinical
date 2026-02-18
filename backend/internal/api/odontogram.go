package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"clinical-backend/internal/domain"
	"clinical-backend/internal/service"

	"github.com/aws/aws-lambda-go/events"
)

type OdontogramHandler struct {
	odontogramService    *service.OdontogramService
	treatmentPlanService *service.TreatmentPlanService
}

func NewOdontogramHandler(
	odontogramService *service.OdontogramService,
	treatmentPlanService *service.TreatmentPlanService,
) *OdontogramHandler {
	return &OdontogramHandler{
		odontogramService:    odontogramService,
		treatmentPlanService: treatmentPlanService,
	}
}

// CreateOdontogram creates a new odontogram for a patient
// POST /odontogram
func (h *OdontogramHandler) CreateOdontogram(ctx context.Context, request events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var req struct {
		PatientID string `json:"patientId"`
		DoctorID  string `json:"doctorId"`
	}

	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		return response(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	if req.PatientID == "" || req.DoctorID == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "patientId and doctorId are required"})
	}

	odontogram, err := h.odontogramService.CreateOdontogram(ctx, req.PatientID, req.DoctorID)
	if err != nil {
		return response(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return response(http.StatusCreated, odontogram)
}

// GetOdontogramByPatient retrieves odontogram for a patient
// GET /odontogram/patient/{patientId}
func (h *OdontogramHandler) GetOdontogramByPatient(ctx context.Context, request events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	patientID, ok := request.PathParameters["patientId"]
	if !ok || patientID == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "patientId is required"})
	}

	odontogram, err := h.odontogramService.GetOdontogramByPatient(ctx, patientID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return response(http.StatusNotFound, map[string]string{"error": "Odontogram not found for patient"})
		}
		return response(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return response(http.StatusOK, odontogram)
}

// UpdateToothCondition updates the condition of specific tooth surfaces
// PUT /odontogram/{odontogramId}/tooth/{toothNumber}
func (h *OdontogramHandler) UpdateToothCondition(ctx context.Context, request events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	odontogramID, ok := request.PathParameters["odontogramId"]
	if !ok || odontogramID == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "odontogramId is required"})
	}

	toothNumberStr, ok := request.PathParameters["toothNumber"]
	if !ok || toothNumberStr == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "toothNumber is required"})
	}

	toothNumberInt, err := strconv.Atoi(toothNumberStr)
	if err != nil {
		return response(http.StatusBadRequest, map[string]string{"error": "Invalid tooth number"})
	}
	toothNumber := domain.ToothNumber(toothNumberInt)

	var req struct {
		DoctorID string                         `json:"doctorId"`
		Surfaces []domain.ToothSurfaceCondition `json:"surfaces"`
	}

	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		return response(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	if req.DoctorID == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "doctorId is required"})
	}

	err = h.odontogramService.UpdateToothCondition(ctx, odontogramID, toothNumber, req.Surfaces, req.DoctorID)
	if err != nil {
		return response(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return response(http.StatusOK, map[string]string{"message": "Tooth condition updated successfully"})
}

// RecordTreatment records a completed treatment
// POST /odontogram/treatment
func (h *OdontogramHandler) RecordTreatment(ctx context.Context, request events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var treatment domain.ToothTreatment

	if err := json.Unmarshal([]byte(request.Body), &treatment); err != nil {
		return response(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	// Validate required fields
	if treatment.ToothNumber == 0 || treatment.TreatmentCode == "" || treatment.DoctorID == "" || treatment.AppointmentID == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "toothNumber, treatmentCode, doctorId, and appointmentId are required"})
	}

	err := h.odontogramService.RecordTreatment(ctx, treatment)
	if err != nil {
		return response(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return response(http.StatusCreated, map[string]string{"message": "Treatment recorded successfully"})
}

// GetTreatmentHistory retrieves treatment history for a patient
// GET /odontogram/patient/{patientId}/treatments
func (h *OdontogramHandler) GetTreatmentHistory(ctx context.Context, request events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	patientID, ok := request.PathParameters["patientId"]
	if !ok || patientID == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "patientId is required"})
	}

	// Optional limit parameter
	limit := 50 // default
	if limitStr := request.QueryStringParameters["limit"]; limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	treatments, err := h.odontogramService.GetTreatmentHistory(ctx, patientID, limit)
	if err != nil {
		return response(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return response(http.StatusOK, map[string]interface{}{
		"treatments": treatments,
		"total":      len(treatments),
	})
}

// GetToothHistory gets complete history for a specific tooth
// GET /odontogram/patient/{patientId}/tooth/{toothNumber}/history
func (h *OdontogramHandler) GetToothHistory(ctx context.Context, request events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	patientID, ok := request.PathParameters["patientId"]
	if !ok || patientID == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "patientId is required"})
	}

	toothNumberStr, ok := request.PathParameters["toothNumber"]
	if !ok || toothNumberStr == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "toothNumber is required"})
	}

	toothNumberInt, err := strconv.Atoi(toothNumberStr)
	if err != nil {
		return response(http.StatusBadRequest, map[string]string{"error": "Invalid tooth number"})
	}
	toothNumber := domain.ToothNumber(toothNumberInt)

	treatments, err := h.odontogramService.GetToothHistory(ctx, patientID, toothNumber)
	if err != nil {
		return response(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return response(http.StatusOK, map[string]interface{}{
		"toothNumber": toothNumber,
		"treatments":  treatments,
		"total":       len(treatments),
	})
}

// Treatment Plan Endpoints

// CreateTreatmentPlan creates a new treatment plan
// POST /treatment-plans
func (h *OdontogramHandler) CreateTreatmentPlan(ctx context.Context, request events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var plan domain.TreatmentPlan

	if err := json.Unmarshal([]byte(request.Body), &plan); err != nil {
		return response(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	// Validate required fields (odontogramId is optional, we'll find it by patientId)
	if plan.PatientID == "" || plan.DoctorID == "" || plan.Title == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "patientId, doctorId, and title are required"})
	}

	// If odontogramId is not provided, try to find the patient's odontogram
	if plan.OdontogramID == "" {
		odontogram, err := h.odontogramService.GetOdontogramByPatient(ctx, plan.PatientID)
		if err != nil {
			return response(http.StatusBadRequest, map[string]string{"error": "No odontogram found for patient. Create an odontogram first or provide odontogramId"})
		}
		plan.OdontogramID = odontogram.ID
	}

	createdPlan, err := h.treatmentPlanService.CreateTreatmentPlan(ctx, plan)
	if err != nil {
		return response(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return response(http.StatusCreated, createdPlan)
}

// GetTreatmentPlan retrieves a treatment plan by ID
// GET /treatment-plans/{planId}
func (h *OdontogramHandler) GetTreatmentPlan(ctx context.Context, request events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	planID, ok := request.PathParameters["planId"]
	if !ok || planID == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "planId is required"})
	}

	plan, err := h.treatmentPlanService.GetTreatmentPlan(ctx, planID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return response(http.StatusNotFound, map[string]string{"error": "Treatment plan not found"})
		}
		return response(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return response(http.StatusOK, plan)
}

// GetPatientTreatmentPlans retrieves all treatment plans for a patient
// GET /treatment-plans/patient/{patientId}
func (h *OdontogramHandler) GetPatientTreatmentPlans(ctx context.Context, request events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	patientID, ok := request.PathParameters["patientId"]
	if !ok || patientID == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "patientId is required"})
	}

	plans, err := h.treatmentPlanService.GetPatientTreatmentPlans(ctx, patientID)
	if err != nil {
		return response(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return response(http.StatusOK, map[string]interface{}{
		"treatmentPlans": plans,
		"total":          len(plans),
	})
}

// UpdateTreatmentPlan updates an existing treatment plan
// PUT /treatment-plans/{planId}
func (h *OdontogramHandler) UpdateTreatmentPlan(ctx context.Context, request events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	planID, ok := request.PathParameters["planId"]
	if !ok || planID == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "planId is required"})
	}

	var plan domain.TreatmentPlan
	if err := json.Unmarshal([]byte(request.Body), &plan); err != nil {
		return response(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	plan.ID = planID // Ensure ID matches path parameter

	updatedPlan, err := h.treatmentPlanService.UpdateTreatmentPlan(ctx, plan)
	if err != nil {
		return response(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return response(http.StatusOK, updatedPlan)
}

// ApproveTreatmentPlan approves a treatment plan
// POST /treatment-plans/{planId}/approve
func (h *OdontogramHandler) ApproveTreatmentPlan(ctx context.Context, request events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	planID, ok := request.PathParameters["planId"]
	if !ok || planID == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "planId is required"})
	}

	err := h.treatmentPlanService.ApproveTreatmentPlan(ctx, planID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return response(http.StatusNotFound, map[string]string{"error": "Treatment plan not found"})
		}
		return response(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return response(http.StatusOK, map[string]string{"message": "Treatment plan approved successfully"})
}

// StartTreatmentPlan starts execution of a treatment plan
// POST /treatment-plans/{planId}/start
func (h *OdontogramHandler) StartTreatmentPlan(ctx context.Context, request events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	planID, ok := request.PathParameters["planId"]
	if !ok || planID == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "planId is required"})
	}

	err := h.treatmentPlanService.StartTreatmentPlan(ctx, planID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return response(http.StatusNotFound, map[string]string{"error": "Treatment plan not found"})
		}
		return response(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return response(http.StatusOK, map[string]string{"message": "Treatment plan started successfully"})
}

// MarkTreatmentCompleted marks a planned treatment as completed
// POST /treatment-plans/{planId}/treatments/{treatmentIndex}/complete
func (h *OdontogramHandler) MarkTreatmentCompleted(ctx context.Context, request events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	planID, ok := request.PathParameters["planId"]
	if !ok || planID == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "planId is required"})
	}

	treatmentIndexStr, ok := request.PathParameters["treatmentIndex"]
	if !ok || treatmentIndexStr == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "treatmentIndex is required"})
	}

	treatmentIndex, err := strconv.Atoi(treatmentIndexStr)
	if err != nil {
		return response(http.StatusBadRequest, map[string]string{"error": "Invalid treatment index"})
	}

	var req struct {
		CompletedTreatmentID string `json:"completedTreatmentId"`
	}

	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		return response(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	if req.CompletedTreatmentID == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "completedTreatmentId is required"})
	}

	err = h.treatmentPlanService.MarkTreatmentCompleted(ctx, planID, treatmentIndex, req.CompletedTreatmentID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return response(http.StatusNotFound, map[string]string{"error": "Treatment plan not found"})
		}
		if strings.Contains(err.Error(), "invalid") {
			return response(http.StatusBadRequest, map[string]string{"error": err.Error()})
		}
		return response(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return response(http.StatusOK, map[string]string{"message": "Treatment marked as completed"})
}

// GenerateTreatmentPlanFromOdontogram generates a treatment plan from odontogram findings
// POST /treatment-plans/generate-from-odontogram
func (h *OdontogramHandler) GenerateTreatmentPlanFromOdontogram(ctx context.Context, request events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var req struct {
		OdontogramID string `json:"odontogramId"`
		DoctorID     string `json:"doctorId"`
		Title        string `json:"title"`
	}

	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		return response(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	if req.OdontogramID == "" || req.DoctorID == "" || req.Title == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "odontogramId, doctorId, and title are required"})
	}

	plan, err := h.treatmentPlanService.GenerateTreatmentPlanFromFindings(ctx, req.OdontogramID, req.DoctorID, req.Title)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return response(http.StatusNotFound, map[string]string{"error": "Odontogram not found"})
		}
		if strings.Contains(err.Error(), "no treatments needed") {
			return response(http.StatusBadRequest, map[string]string{"error": err.Error()})
		}
		return response(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return response(http.StatusCreated, plan)
}

// GenerateInitialAssessment creates initial dental assessment
// POST /odontogram/{odontogramId}/assessment
func (h *OdontogramHandler) GenerateInitialAssessment(ctx context.Context, request events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	odontogramID, ok := request.PathParameters["odontogramId"]
	if !ok || odontogramID == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "odontogramId is required"})
	}

	var req struct {
		DoctorID string                                    `json:"doctorId"`
		Findings map[string][]domain.ToothSurfaceCondition `json:"findings"` // Using string keys for JSON
	}

	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		return response(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	if req.DoctorID == "" {
		return response(http.StatusBadRequest, map[string]string{"error": "doctorId is required"})
	}

	// Convert string keys to ToothNumber
	findings := make(map[domain.ToothNumber][]domain.ToothSurfaceCondition)
	for toothStr, surfaces := range req.Findings {
		toothNum, err := strconv.Atoi(toothStr)
		if err != nil {
			return response(http.StatusBadRequest, map[string]string{"error": fmt.Sprintf("Invalid tooth number: %s", toothStr)})
		}
		findings[domain.ToothNumber(toothNum)] = surfaces
	}

	err := h.odontogramService.GenerateInitialAssessment(ctx, odontogramID, findings, req.DoctorID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return response(http.StatusNotFound, map[string]string{"error": "Odontogram not found"})
		}
		return response(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return response(http.StatusOK, map[string]string{"message": "Initial assessment completed successfully"})
}

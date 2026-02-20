package service

import (
	"context"
	"fmt"
	"time"

	"clinical-backend/internal/domain"
	"clinical-backend/internal/store"

	"github.com/google/uuid"
)

// OdontogramService provides business logic for dental charts
type OdontogramService struct {
	repo        store.OdontogramRepository
	patientRepo store.PatientRepository
	planRepo    store.TreatmentPlanRepository
}

// NewOdontogramService creates a new odontogram service
func NewOdontogramService(
	repo store.OdontogramRepository,
	patientRepo store.PatientRepository,
	planRepo store.TreatmentPlanRepository,
) *OdontogramService {
	return &OdontogramService{
		repo:        repo,
		patientRepo: patientRepo,
		planRepo:    planRepo,
	}
}

// CreateOdontogram creates a new odontogram for a patient
func (s *OdontogramService) CreateOdontogram(ctx context.Context, patientID, doctorID string) (domain.Odontogram, error) {
	// Verify patient exists
	_, err := s.patientRepo.GetByID(ctx, patientID)
	if err != nil {
		return domain.Odontogram{}, fmt.Errorf("patient not found: %w", err)
	}

	// Check if odontogram already exists
	existing, err := s.repo.GetByPatientID(ctx, patientID)
	if err == nil {
		return existing, nil // Return existing odontogram
	}

	// Create new odontogram with all 32 teeth initialized
	odontogram := domain.Odontogram{
		ID:           uuid.New().String(),
		PatientID:    patientID,
		DoctorID:     doctorID,
		Teeth:        s.initializeAllTeeth(),
		LastExamDate: time.Now(),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	return s.repo.Create(ctx, odontogram)
}

// GetOdontogramByPatient retrieves the odontogram for a specific patient
func (s *OdontogramService) GetOdontogramByPatient(ctx context.Context, patientID string) (domain.Odontogram, error) {
	return s.repo.GetByPatientID(ctx, patientID)
}

// GetOdontogramByID retrieves an odontogram by its ID
func (s *OdontogramService) GetOdontogramByID(ctx context.Context, id string) (domain.Odontogram, error) {
	return s.repo.GetByID(ctx, id)
}

// UpdateOdontogram updates an existing odontogram
func (s *OdontogramService) UpdateOdontogram(ctx context.Context, odn domain.Odontogram) (domain.Odontogram, error) {
	odn.UpdatedAt = time.Now()
	odn.LastExamDate = time.Now()
	return s.repo.Update(ctx, odn)
}

// UpdateToothCondition updates the condition of specific tooth surfaces
func (s *OdontogramService) UpdateToothCondition(ctx context.Context, odontogramID string, toothNumber domain.ToothNumber, surfaces []domain.ToothSurfaceCondition, doctorID string) error {
	// Add doctor info to surface conditions
	now := time.Now()
	for i := range surfaces {
		surfaces[i].LastModified = now
		surfaces[i].ModifiedBy = doctorID
	}

	return s.repo.UpdateToothCondition(ctx, odontogramID, toothNumber, surfaces)
}

// RecordTreatment records a completed treatment
func (s *OdontogramService) RecordTreatment(ctx context.Context, treatment domain.ToothTreatment) error {
	treatment.ID = uuid.New().String()
	treatment.CreatedAt = time.Now()
	treatment.CompletedAt = time.Now()

	// Get odontogram to verify it exists
	odontogram, err := s.repo.GetByPatientID(ctx, treatment.DoctorID)
	if err != nil {
		return fmt.Errorf("odontogram not found: %w", err)
	}

	return s.repo.AddTreatment(ctx, odontogram.ID, treatment)
}

// GetTreatmentHistory retrieves treatment history for a patient
func (s *OdontogramService) GetTreatmentHistory(ctx context.Context, patientID string, limit int) ([]domain.ToothTreatment, error) {
	return s.repo.GetTreatmentHistory(ctx, patientID, limit)
}

// GenerateInitialAssessment creates an initial dental assessment
func (s *OdontogramService) GenerateInitialAssessment(ctx context.Context, odontogramID string, findings map[domain.ToothNumber][]domain.ToothSurfaceCondition, doctorID string) error {
	now := time.Now()

	for toothNumber, surfaces := range findings {
		// Add metadata to each surface condition
		for i := range surfaces {
			surfaces[i].LastModified = now
			surfaces[i].ModifiedBy = doctorID
		}

		err := s.repo.UpdateToothCondition(ctx, odontogramID, toothNumber, surfaces)
		if err != nil {
			return fmt.Errorf("failed to update tooth %d: %w", toothNumber, err)
		}
	}

	return nil
}

// GetToothHistory gets the complete history of a specific tooth
func (s *OdontogramService) GetToothHistory(ctx context.Context, patientID string, toothNumber domain.ToothNumber) ([]domain.ToothTreatment, error) {
	allTreatments, err := s.repo.GetTreatmentHistory(ctx, patientID, 0)
	if err != nil {
		return nil, err
	}

	var toothTreatments []domain.ToothTreatment
	for _, treatment := range allTreatments {
		if treatment.ToothNumber == toothNumber {
			toothTreatments = append(toothTreatments, treatment)
		}
	}

	return toothTreatments, nil
}

// initializeAllTeeth creates the initial state for all 32 adult teeth
func (s *OdontogramService) initializeAllTeeth() []domain.ToothInfo {
	allTeeth := []domain.ToothNumber{
		// Upper right (Quadrant 1)
		domain.Tooth11, domain.Tooth12, domain.Tooth13, domain.Tooth14,
		domain.Tooth15, domain.Tooth16, domain.Tooth17, domain.Tooth18,
		// Upper left (Quadrant 2)
		domain.Tooth21, domain.Tooth22, domain.Tooth23, domain.Tooth24,
		domain.Tooth25, domain.Tooth26, domain.Tooth27, domain.Tooth28,
		// Lower left (Quadrant 3)
		domain.Tooth31, domain.Tooth32, domain.Tooth33, domain.Tooth34,
		domain.Tooth35, domain.Tooth36, domain.Tooth37, domain.Tooth38,
		// Lower right (Quadrant 4)
		domain.Tooth41, domain.Tooth42, domain.Tooth43, domain.Tooth44,
		domain.Tooth45, domain.Tooth46, domain.Tooth47, domain.Tooth48,
	}

	var teeth []domain.ToothInfo
	now := time.Now()

	for _, toothNumber := range allTeeth {
		// Initialize all surfaces as healthy
		surfaces := []domain.ToothSurfaceCondition{
			{
				Surface:      domain.SurfaceOcclusal,
				Condition:    domain.ConditionHealthy,
				Severity:     0,
				LastModified: now,
			},
			{
				Surface:      domain.SurfaceVestibular,
				Condition:    domain.ConditionHealthy,
				Severity:     0,
				LastModified: now,
			},
			{
				Surface:      domain.SurfaceLingual,
				Condition:    domain.ConditionHealthy,
				Severity:     0,
				LastModified: now,
			},
			{
				Surface:      domain.SurfaceMesial,
				Condition:    domain.ConditionHealthy,
				Severity:     0,
				LastModified: now,
			},
			{
				Surface:      domain.SurfaceDistal,
				Condition:    domain.ConditionHealthy,
				Severity:     0,
				LastModified: now,
			},
		}

		tooth := domain.ToothInfo{
			ToothNumber: toothNumber,
			Surfaces:    surfaces,
			IsPresent:   true, // Assume all teeth present initially
			LastUpdated: now,
		}

		teeth = append(teeth, tooth)
	}

	return teeth
}

// Treatment Plan Service
type TreatmentPlanService struct {
	planRepo       store.TreatmentPlanRepository
	odontogramRepo store.OdontogramRepository
	patientRepo    store.PatientRepository
}

// NewTreatmentPlanService creates a new treatment plan service
func NewTreatmentPlanService(
	planRepo store.TreatmentPlanRepository,
	odontogramRepo store.OdontogramRepository,
	patientRepo store.PatientRepository,
) *TreatmentPlanService {
	return &TreatmentPlanService{
		planRepo:       planRepo,
		odontogramRepo: odontogramRepo,
		patientRepo:    patientRepo,
	}
}

// CreateTreatmentPlan creates a new treatment plan
func (s *TreatmentPlanService) CreateTreatmentPlan(ctx context.Context, plan domain.TreatmentPlan) (domain.TreatmentPlan, error) {
	// Verify patient exists
	_, err := s.patientRepo.GetByID(ctx, plan.PatientID)
	if err != nil {
		return domain.TreatmentPlan{}, fmt.Errorf("patient not found: %w", err)
	}

	// Verify odontogram exists
	_, err = s.odontogramRepo.GetByID(ctx, plan.OdontogramID)
	if err != nil {
		return domain.TreatmentPlan{}, fmt.Errorf("odontogram not found: %w", err)
	}

	plan.ID = uuid.New().String()
	plan.CreatedAt = time.Now()
	plan.UpdatedAt = time.Now()

	if plan.Status == "" {
		plan.Status = domain.PlanStatusDraft
	}

	// Calculate totals from planned treatments
	var totalCost float64
	var totalTime int

	for i, treatment := range plan.Treatments {
		totalCost += treatment.EstimatedCost
		totalTime += treatment.EstimatedTime

		// Initialize status if not set
		if treatment.Status == "" {
			plan.Treatments[i].Status = domain.PlannedStatusPending
		}
	}

	plan.TotalCost = totalCost
	plan.EstimatedTime = totalTime

	return s.planRepo.Create(ctx, plan)
}

// GetTreatmentPlan retrieves a treatment plan by ID
func (s *TreatmentPlanService) GetTreatmentPlan(ctx context.Context, planID string) (domain.TreatmentPlan, error) {
	return s.planRepo.GetByID(ctx, planID)
}

// GetPatientTreatmentPlans retrieves all treatment plans for a patient
func (s *TreatmentPlanService) GetPatientTreatmentPlans(ctx context.Context, patientID string) ([]domain.TreatmentPlan, error) {
	return s.planRepo.GetByPatientID(ctx, patientID)
}

// UpdateTreatmentPlan updates an existing treatment plan
func (s *TreatmentPlanService) UpdateTreatmentPlan(ctx context.Context, plan domain.TreatmentPlan) (domain.TreatmentPlan, error) {
	// Recalculate totals
	var totalCost float64
	var totalTime int

	for _, treatment := range plan.Treatments {
		totalCost += treatment.EstimatedCost
		totalTime += treatment.EstimatedTime
	}

	plan.TotalCost = totalCost
	plan.EstimatedTime = totalTime
	plan.UpdatedAt = time.Now()

	return s.planRepo.Update(ctx, plan)
}

// MarkTreatmentCompleted marks a planned treatment as completed
func (s *TreatmentPlanService) MarkTreatmentCompleted(ctx context.Context, planID string, treatmentIndex int, completedTreatmentID string) error {
	plan, err := s.planRepo.GetByID(ctx, planID)
	if err != nil {
		return err
	}

	if treatmentIndex < 0 || treatmentIndex >= len(plan.Treatments) {
		return fmt.Errorf("invalid treatment index")
	}

	return s.planRepo.UpdateTreatmentStatus(
		ctx,
		planID,
		fmt.Sprintf("%d", treatmentIndex),
		domain.PlannedStatusCompleted,
		&completedTreatmentID,
	)
}

// ApproveTreatmentPlan approves a treatment plan for execution
func (s *TreatmentPlanService) ApproveTreatmentPlan(ctx context.Context, planID string) error {
	plan, err := s.planRepo.GetByID(ctx, planID)
	if err != nil {
		return err
	}

	plan.Status = domain.PlanStatusApproved
	plan.UpdatedAt = time.Now()

	if plan.StartDate == nil {
		now := time.Now()
		plan.StartDate = &now
	}

	_, err = s.planRepo.Update(ctx, plan)
	return err
}

// StartTreatmentPlan marks a treatment plan as in progress
func (s *TreatmentPlanService) StartTreatmentPlan(ctx context.Context, planID string) error {
	plan, err := s.planRepo.GetByID(ctx, planID)
	if err != nil {
		return err
	}

	plan.Status = domain.PlanStatusInProgress
	plan.UpdatedAt = time.Now()

	if plan.StartDate == nil {
		now := time.Now()
		plan.StartDate = &now
	}

	_, err = s.planRepo.Update(ctx, plan)
	return err
}

// GenerateTreatmentPlanFromFindings creates a treatment plan based on odontogram findings
func (s *TreatmentPlanService) GenerateTreatmentPlanFromFindings(ctx context.Context, odontogramID, doctorID, title string) (domain.TreatmentPlan, error) {
	// Get odontogram
	odontogram, err := s.odontogramRepo.GetByID(ctx, odontogramID)
	if err != nil {
		return domain.TreatmentPlan{}, err
	}

	var plannedTreatments []domain.PlannedTreatment
	priority := 1

	// Analyze each tooth for needed treatments
	for _, tooth := range odontogram.Teeth {
		for _, surface := range tooth.Surfaces {
			if surface.Condition != domain.ConditionHealthy {
				treatment := s.suggestTreatmentForCondition(tooth.ToothNumber, &surface.Surface, surface.Condition, priority)
				if treatment != nil {
					plannedTreatments = append(plannedTreatments, *treatment)
					priority++
				}
			}
		}
	}

	if len(plannedTreatments) == 0 {
		return domain.TreatmentPlan{}, fmt.Errorf("no treatments needed - all teeth are healthy")
	}

	plan := domain.TreatmentPlan{
		PatientID:    odontogram.PatientID,
		DoctorID:     doctorID,
		OdontogramID: odontogramID,
		Title:        title,
		Description:  "Plan de tratamiento generado automáticamente basado en hallazgos del odontograma",
		Treatments:   plannedTreatments,
		Priority:     domain.PriorityMedium,
		Status:       domain.PlanStatusProposed,
	}

	return s.CreateTreatmentPlan(ctx, plan)
}

// suggestTreatmentForCondition suggests appropriate treatment based on tooth condition
func (s *TreatmentPlanService) suggestTreatmentForCondition(toothNumber domain.ToothNumber, surface *domain.ToothSurface, condition domain.ToothCondition, priority int) *domain.PlannedTreatment {
	var treatmentCode domain.TreatmentCode
	var description string
	var estimatedCost float64
	var estimatedTime int

	switch condition {
	case domain.ConditionCaries:
		treatmentCode = domain.CodeFilling
		description = fmt.Sprintf("Obturación diente %d", toothNumber)
		estimatedCost = 50.00
		estimatedTime = 45

	case domain.ConditionFracture:
		treatmentCode = domain.CodeCrown
		description = fmt.Sprintf("Corona para diente fracturado %d", toothNumber)
		estimatedCost = 300.00
		estimatedTime = 90

	case domain.ConditionMissing:
		treatmentCode = domain.CodeImplant
		description = fmt.Sprintf("Implante para diente ausente %d", toothNumber)
		estimatedCost = 1200.00
		estimatedTime = 120

	default:
		return nil // No treatment needed
	}

	surfaceDesc := ""
	if surface != nil {
		surfaceDesc = fmt.Sprintf(" superficie %s", *surface)
		description += surfaceDesc
	}

	return &domain.PlannedTreatment{
		ToothNumber:   toothNumber,
		Surface:       surface,
		TreatmentCode: treatmentCode,
		Description:   description,
		EstimatedCost: estimatedCost,
		EstimatedTime: estimatedTime,
		Priority:      priority,
		Status:        domain.PlannedStatusPending,
	}
}

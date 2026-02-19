package domain

import "time"

type Specialty string

const (
	SpecialtyOdontology Specialty = "odontology"
)

type Patient struct {
	ID                 string              `json:"id"`
	DoctorID           string              `json:"doctorId"`
	Specialty          Specialty           `json:"specialty"`
	FirstName          string              `json:"firstName"`
	LastName           string              `json:"lastName"`
	DocumentID         string              `json:"documentId"`
	Phone              string              `json:"phone"`
	Email              string              `json:"email"`
	BirthDate          string              `json:"birthDate"`
	MedicalBackgrounds []MedicalBackground `json:"medicalBackgrounds"`
	ImageKeys          []string            `json:"imageKeys"`
	CreatedAt          time.Time           `json:"createdAt"`
	UpdatedAt          *time.Time          `json:"updatedAt,omitempty"`
}

type MedicalBackground struct {
	Type        string `json:"type"`
	Description string `json:"description"`
}

type Appointment struct {
	ID                  string     `json:"id"`
	DoctorID            string     `json:"doctorId"`
	PatientID           string     `json:"patientId"`
	StartAt             time.Time  `json:"startAt"`
	EndAt               time.Time  `json:"endAt"`
	Status              string     `json:"status"`
	EvolutionNotes      string     `json:"evolutionNotes"`
	TreatmentPlan       string     `json:"treatmentPlan"`
	PaymentAmount       float64    `json:"paymentAmount"`
	PaymentMethod       string     `json:"paymentMethod"`
	ReminderSentAt      *time.Time `json:"reminderSentAt,omitempty"`
	PatientConfirmedAt  *time.Time `json:"patientConfirmedAt,omitempty"`
	DoctorDailyClosedAt *time.Time `json:"doctorDailyClosedAt,omitempty"`
}

type Consent struct {
	ID             string     `json:"id"`
	PatientID      string     `json:"patientId"`
	DoctorID       string     `json:"doctorId"`
	Title          string     `json:"title"`
	Content        string     `json:"content"`
	DeliveryMethod string     `json:"deliveryMethod"`
	Status         string     `json:"status"`
	AcceptedAt     *time.Time `json:"acceptedAt,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
}

// Odontograma Digital Structures

type ToothNumber int

const (
	// Numeración dental internacional (FDI)
	// Cuadrante 1 (superior derecho)
	Tooth11 ToothNumber = 11 // Incisivo central
	Tooth12 ToothNumber = 12 // Incisivo lateral
	Tooth13 ToothNumber = 13 // Canino
	Tooth14 ToothNumber = 14 // Primer premolar
	Tooth15 ToothNumber = 15 // Segundo premolar
	Tooth16 ToothNumber = 16 // Primer molar
	Tooth17 ToothNumber = 17 // Segundo molar
	Tooth18 ToothNumber = 18 // Tercer molar

	// Cuadrante 2 (superior izquierdo)
	Tooth21 ToothNumber = 21
	Tooth22 ToothNumber = 22
	Tooth23 ToothNumber = 23
	Tooth24 ToothNumber = 24
	Tooth25 ToothNumber = 25
	Tooth26 ToothNumber = 26
	Tooth27 ToothNumber = 27
	Tooth28 ToothNumber = 28

	// Cuadrante 3 (inferior izquierdo)
	Tooth31 ToothNumber = 31
	Tooth32 ToothNumber = 32
	Tooth33 ToothNumber = 33
	Tooth34 ToothNumber = 34
	Tooth35 ToothNumber = 35
	Tooth36 ToothNumber = 36
	Tooth37 ToothNumber = 37
	Tooth38 ToothNumber = 38

	// Cuadrante 4 (inferior derecho)
	Tooth41 ToothNumber = 41
	Tooth42 ToothNumber = 42
	Tooth43 ToothNumber = 43
	Tooth44 ToothNumber = 44
	Tooth45 ToothNumber = 45
	Tooth46 ToothNumber = 46
	Tooth47 ToothNumber = 47
	Tooth48 ToothNumber = 48
)

type ToothSurface string

const (
	SurfaceOcclusal   ToothSurface = "oclusal"    // Superficie de masticación
	SurfaceVestibular ToothSurface = "vestibular" // Superficie hacia labios/mejillas
	SurfaceLingual    ToothSurface = "lingual"    // Superficie hacia lengua
	SurfaceMesial     ToothSurface = "mesial"     // Superficie hacia línea media
	SurfaceDistal     ToothSurface = "distal"     // Superficie alejada de línea media
)

type ToothCondition string

const (
	ConditionHealthy    ToothCondition = "healthy"    // Sano
	ConditionCaries     ToothCondition = "caries"     // Caries
	ConditionFilled     ToothCondition = "filled"     // Obturado
	ConditionCrown      ToothCondition = "crown"      // Corona
	ConditionExtracted  ToothCondition = "extracted"  // Extraído
	ConditionImplant    ToothCondition = "implant"    // Implante
	ConditionEndodontic ToothCondition = "endodontic" // Endodoncia
	ConditionFracture   ToothCondition = "fracture"   // Fracturado
	ConditionMissing    ToothCondition = "missing"    // Ausente
)

type TreatmentCode string

const (
	// Códigos de tratamiento más comunes
	CodeProphylaxis  TreatmentCode = "D1110" // Profilaxis
	CodeFilling      TreatmentCode = "D2140" // Obturación
	CodeExtraction   TreatmentCode = "D7140" // Extracción
	CodeRootCanal    TreatmentCode = "D3310" // Endodoncia
	CodeCrown        TreatmentCode = "D2750" // Corona
	CodeImplant      TreatmentCode = "D6010" // Implante
	CodeBridge       TreatmentCode = "D6240" // Puente
	CodeWhitening    TreatmentCode = "D9972" // Blanqueamiento
	CodeOrthodontics TreatmentCode = "D8080" // Ortodoncia
	CodePeriodontal  TreatmentCode = "D4341" // Raspado
)

// Condición de una superficie específica de un diente
type ToothSurfaceCondition struct {
	Surface       ToothSurface   `json:"surface"`
	Condition     ToothCondition `json:"condition"`
	Severity      int            `json:"severity"`                // 1-5, severidad del problema
	Notes         string         `json:"notes"`                   // Notas específicas
	TreatmentCode *TreatmentCode `json:"treatmentCode,omitempty"` // Código si hay tratamiento
	LastModified  time.Time      `json:"lastModified"`
	ModifiedBy    string         `json:"modifiedBy"` // Doctor que modificó
}

// Información completa de un diente
type ToothInfo struct {
	ToothNumber  ToothNumber             `json:"toothNumber"`
	Surfaces     []ToothSurfaceCondition `json:"surfaces"`
	GeneralNotes string                  `json:"generalNotes"` // Notas generales del diente
	IsPresent    bool                    `json:"isPresent"`    // Si el diente está presente
	LastUpdated  time.Time               `json:"lastUpdated"`
}

// Registro de tratamiento realizado
type ToothTreatment struct {
	ID              string         `json:"id"`
	ToothNumber     ToothNumber    `json:"toothNumber"`
	Surface         *ToothSurface  `json:"surface,omitempty"` // null si es tratamiento general
	TreatmentCode   TreatmentCode  `json:"treatmentCode"`
	Description     string         `json:"description"`
	DoctorID        string         `json:"doctorId"`
	AppointmentID   string         `json:"appointmentId"`
	Cost            float64        `json:"cost"`
	Materials       []string       `json:"materials"`       // Materiales utilizados
	Duration        int            `json:"duration"`        // Duración en minutos
	BeforeCondition ToothCondition `json:"beforeCondition"` // Estado antes
	AfterCondition  ToothCondition `json:"afterCondition"`  // Estado después
	Photos          []string       `json:"photos"`          // URLs de fotos
	XRays           []string       `json:"xrays"`           // URLs de radiografías
	CompletedAt     time.Time      `json:"completedAt"`
	CreatedAt       time.Time      `json:"createdAt"`
}

// Odontograma completo de un paciente
type Odontogram struct {
	ID               string           `json:"id"`
	PatientID        string           `json:"patientId"`
	DoctorID         string           `json:"doctorId"`
	Teeth            []ToothInfo      `json:"teeth"`                  // Estado actual de todos los dientes
	TreatmentHistory []ToothTreatment `json:"treatmentHistory"`       // Historial de tratamientos
	GeneralNotes     string           `json:"generalNotes"`           // Observaciones generales
	LastExamDate     time.Time        `json:"lastExamDate"`           // Última revisión
	NextExamDate     *time.Time       `json:"nextExamDate,omitempty"` // Próxima revisión
	CreatedAt        time.Time        `json:"createdAt"`
	UpdatedAt        time.Time        `json:"updatedAt"`
}

// Plan de tratamiento odontológico
type TreatmentPlan struct {
	ID            string              `json:"id"`
	PatientID     string              `json:"patientId"`
	DoctorID      string              `json:"doctorId"`
	OdontogramID  string              `json:"odontogramId"`
	Title         string              `json:"title"`
	Description   string              `json:"description"`
	Treatments    []PlannedTreatment  `json:"treatments"`
	TotalCost     float64             `json:"totalCost"`
	EstimatedTime int                 `json:"estimatedTime"` // Total en minutos
	Priority      TreatmentPriority   `json:"priority"`
	Status        TreatmentPlanStatus `json:"status"`
	StartDate     *time.Time          `json:"startDate,omitempty"`
	EndDate       *time.Time          `json:"endDate,omitempty"`
	Notes         string              `json:"notes"`
	CreatedAt     time.Time           `json:"createdAt"`
	UpdatedAt     time.Time           `json:"updatedAt"`
}

type PlannedTreatment struct {
	ToothNumber          ToothNumber            `json:"toothNumber"`
	Surface              *ToothSurface          `json:"surface,omitempty"`
	TreatmentCode        TreatmentCode          `json:"treatmentCode"`
	Description          string                 `json:"description"`
	EstimatedCost        float64                `json:"estimatedCost"`
	EstimatedTime        int                    `json:"estimatedTime"` // En minutos
	Priority             int                    `json:"priority"`      // Orden de ejecución
	Prerequisites        []string               `json:"prerequisites"` // IDs de tratamientos que deben hacerse antes
	Status               PlannedTreatmentStatus `json:"status"`
	CompletedTreatmentID *string                `json:"completedTreatmentId,omitempty"` // ID del tratamiento real
}

type TreatmentPriority string

const (
	PriorityUrgent   TreatmentPriority = "urgent"   // Urgente
	PriorityHigh     TreatmentPriority = "high"     // Alta
	PriorityMedium   TreatmentPriority = "medium"   // Media
	PriorityLow      TreatmentPriority = "low"      // Baja
	PriorityElective TreatmentPriority = "elective" // Electiva
)

type TreatmentPlanStatus string

const (
	PlanStatusDraft      TreatmentPlanStatus = "draft"       // Borrador
	PlanStatusProposed   TreatmentPlanStatus = "proposed"    // Propuesto
	PlanStatusApproved   TreatmentPlanStatus = "approved"    // Aprobado
	PlanStatusInProgress TreatmentPlanStatus = "in_progress" // En progreso
	PlanStatusCompleted  TreatmentPlanStatus = "completed"   // Completado
	PlanStatusCancelled  TreatmentPlanStatus = "cancelled"   // Cancelado
)

type PlannedTreatmentStatus string

const (
	PlannedStatusPending   PlannedTreatmentStatus = "pending"   // Pendiente
	PlannedStatusScheduled PlannedTreatmentStatus = "scheduled" // Agendado
	PlannedStatusCompleted PlannedTreatmentStatus = "completed" // Completado
	PlannedStatusSkipped   PlannedTreatmentStatus = "skipped"   // Omitido
)

package service

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"clinical-backend/internal/bedrock"
	"clinical-backend/internal/domain"
	"clinical-backend/internal/store"
)

// ChatMessage represents a single turn in a conversation.
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatRequest is the incoming payload from the frontend.
type ChatRequest struct {
	Message             string        `json:"message"`
	ConversationHistory []ChatMessage `json:"conversationHistory,omitempty"`
}

// ChatResponse is the outgoing payload to the frontend.
type ChatResponse struct {
	Reply     string `json:"reply"`
	Timestamp string `json:"timestamp"`
}

// clinicalContext holds the data gathered from DynamoDB for the system prompt.
type clinicalContext struct {
	TodayAppointments    []domain.Appointment
	TomorrowAppointments []domain.Appointment
	Patients             []domain.Patient
	Payments             []domain.PaymentRecord
	Today                time.Time
	Tomorrow             time.Time
}

// rateLimitEntry tracks per-user request timestamps for a simple sliding window.
type rateLimitEntry struct {
	mu         sync.Mutex
	timestamps []time.Time
}

// ChatService handles the Docco chatbot logic.
type ChatService struct {
	appointmentRepo store.AppointmentRepository
	patientRepo     store.PatientRepository
	paymentRepo     store.PaymentRepository
	bedrockClient   *bedrock.Client
	tz              *time.Location

	rateMu   sync.Mutex
	rateMap  map[string]*rateLimitEntry
	maxPerMin int
}

// NewChatService creates a ChatService.
func NewChatService(
	appointments store.AppointmentRepository,
	patients store.PatientRepository,
	payments store.PaymentRepository,
	bedrockClient *bedrock.Client,
	tz *time.Location,
) *ChatService {
	maxPerMin := 20
	if v := os.Getenv("DOCCO_RATE_LIMIT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			maxPerMin = n
		}
	}
	return &ChatService{
		appointmentRepo: appointments,
		patientRepo:     patients,
		paymentRepo:     payments,
		bedrockClient:   bedrockClient,
		tz:              tz,
		rateMap:         make(map[string]*rateLimitEntry),
		maxPerMin:       maxPerMin,
	}
}

// ProcessMessage is the main entry point for a chat request.
func (s *ChatService) ProcessMessage(ctx context.Context, orgID, userID, role, userName string, req ChatRequest) (*ChatResponse, error) {
	if os.Getenv("DOCCO_ENABLED") == "false" {
		return &ChatResponse{Reply: "Docco no está disponible en este momento.", Timestamp: time.Now().Format(time.RFC3339)}, nil
	}

	if !s.checkRateLimit(userID) {
		return &ChatResponse{
			Reply:     "Has enviado muchos mensajes. Espera un momento antes de continuar.",
			Timestamp: time.Now().Format(time.RFC3339),
		}, nil
	}

	start := time.Now()
	ctxWithOrg := store.ContextWithOrgID(ctx, orgID)

	cctx := s.gatherContext(ctxWithOrg, orgID, userID, role)

	systemPrompt := s.buildSystemPrompt(cctx, orgID, userName, role)

	msgs := make([]bedrock.Message, 0, len(req.ConversationHistory)+1)
	for _, m := range req.ConversationHistory {
		msgs = append(msgs, bedrock.Message{Role: m.Role, Content: m.Content})
	}
	msgs = append(msgs, bedrock.Message{Role: "user", Content: req.Message})

	reply, err := s.bedrockClient.Invoke(ctx, systemPrompt, msgs)
	if err != nil {
		log.Printf("[DOCCO] user=%s org=%s role=%s latency_ms=%d error=%v", userID, orgID, role, time.Since(start).Milliseconds(), err)
		return &ChatResponse{
			Reply:     "Lo siento, estoy teniendo problemas para procesar tu consulta en este momento. Por favor intenta de nuevo en unos segundos.",
			Timestamp: time.Now().Format(time.RFC3339),
		}, nil
	}

	log.Printf("[DOCCO] user=%s org=%s role=%s latency_ms=%d", userID, orgID, role, time.Since(start).Milliseconds())

	return &ChatResponse{Reply: reply, Timestamp: time.Now().Format(time.RFC3339)}, nil
}

// checkRateLimit returns false if the user has exceeded the rate limit.
func (s *ChatService) checkRateLimit(userID string) bool {
	s.rateMu.Lock()
	entry, ok := s.rateMap[userID]
	if !ok {
		entry = &rateLimitEntry{}
		s.rateMap[userID] = entry
	}
	s.rateMu.Unlock()

	entry.mu.Lock()
	defer entry.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-time.Minute)
	filtered := entry.timestamps[:0]
	for _, t := range entry.timestamps {
		if t.After(cutoff) {
			filtered = append(filtered, t)
		}
	}
	entry.timestamps = filtered

	if len(entry.timestamps) >= s.maxPerMin {
		return false
	}
	entry.timestamps = append(entry.timestamps, now)
	return true
}

// gatherContext queries DynamoDB concurrently.
func (s *ChatService) gatherContext(ctx context.Context, orgID, userID, role string) clinicalContext {
	now := time.Now().In(s.tz)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, s.tz)
	tomorrow := today.Add(24 * time.Hour)

	var (
		wg   sync.WaitGroup
		mu   sync.Mutex
		cctx clinicalContext
	)
	cctx.Today = today
	cctx.Tomorrow = tomorrow

	// Citas de hoy
	wg.Add(1)
	go func() {
		defer wg.Done()
		appts, err := s.appointmentRepo.ListByDoctorAndDay(ctx, userID, today)
		if err == nil {
			mu.Lock()
			cctx.TodayAppointments = appts
			mu.Unlock()
		}
	}()

	// Citas de mañana
	wg.Add(1)
	go func() {
		defer wg.Done()
		appts, err := s.appointmentRepo.ListByDoctorAndDay(ctx, userID, tomorrow)
		if err == nil {
			mu.Lock()
			cctx.TomorrowAppointments = appts
			mu.Unlock()
		}
	}()

	// Pacientes
	wg.Add(1)
	go func() {
		defer wg.Done()
		var patients []domain.Patient
		var err error
		if role == "admin" || role == "platform_admin" {
			patients, err = s.patientRepo.ListAll(ctx)
		} else {
			patients, err = s.patientRepo.ListByDoctor(ctx, userID)
		}
		if err == nil {
			mu.Lock()
			// Cap at 30 for prompt size
			if len(patients) > 30 {
				patients = patients[:30]
			}
			cctx.Patients = patients
			mu.Unlock()
		}
	}()

	// Pagos recientes
	wg.Add(1)
	go func() {
		defer wg.Done()
		payments, err := s.paymentRepo.ListByOrg(ctx, 20)
		if err == nil {
			mu.Lock()
			cctx.Payments = payments
			mu.Unlock()
		}
	}()

	wg.Wait()
	return cctx
}

// buildSystemPrompt constructs the system prompt with real data.
func (s *ChatService) buildSystemPrompt(cctx clinicalContext, orgID, userName, role string) string {
	var b strings.Builder

	fmt.Fprintf(&b, `Eres Docco, el asistente virtual del sistema clínico dental. Tu personalidad es amigable, profesional y eficiente.

REGLAS:
- Responde SOLO con la información que se te proporciona en el contexto. No inventes datos.
- Si no tienes datos para responder, dilo amablemente: "No tengo esa información disponible en este momento."
- Responde en el mismo idioma que el usuario (generalmente español).
- Sé conciso pero completo. Usa formato legible con listas cuando sea apropiado.
- Cuando listes citas, incluye: hora, nombre del paciente, motivo si existe.
- Cuando menciones pagos, incluye montos y método de pago.
- NUNCA reveles información de otros doctores u organizaciones.
- Formato de hora: 12h (ej: 2:00 PM). Zona horaria: America/Caracas.

DATOS DEL USUARIO ACTUAL:
- Nombre: %s
- Rol: %s
- Organización: %s

`, userName, role, orgID)

	todayStr := cctx.Today.Format("02/01/2006")
	tomorrowStr := cctx.Tomorrow.Format("02/01/2006")

	fmt.Fprintf(&b, "CITAS DE HOY (%s):\n", todayStr)
	if len(cctx.TodayAppointments) == 0 {
		b.WriteString("No hay citas programadas para hoy.\n")
	} else {
		for _, a := range cctx.TodayAppointments {
			hora := a.StartAt.In(s.tz).Format("3:04 PM")
			reason := a.Reason
			if reason == "" {
				reason = a.EvolutionNotes
			}
			if reason != "" {
				fmt.Fprintf(&b, "- %s | Paciente ID: %s | Motivo: %s | Estado: %s\n", hora, a.PatientID, reason, a.Status)
			} else {
				fmt.Fprintf(&b, "- %s | Paciente ID: %s | Estado: %s\n", hora, a.PatientID, a.Status)
			}
		}
	}
	b.WriteString("\n")

	fmt.Fprintf(&b, "CITAS DE MAÑANA (%s):\n", tomorrowStr)
	if len(cctx.TomorrowAppointments) == 0 {
		b.WriteString("No hay citas programadas para mañana.\n")
	} else {
		for _, a := range cctx.TomorrowAppointments {
			hora := a.StartAt.In(s.tz).Format("3:04 PM")
			reason := a.Reason
			if reason == "" {
				reason = a.EvolutionNotes
			}
			if reason != "" {
				fmt.Fprintf(&b, "- %s | Paciente ID: %s | Motivo: %s | Estado: %s\n", hora, a.PatientID, reason, a.Status)
			} else {
				fmt.Fprintf(&b, "- %s | Paciente ID: %s | Estado: %s\n", hora, a.PatientID, a.Status)
			}
		}
	}
	b.WriteString("\n")

	fmt.Fprintf(&b, "PACIENTES (hasta 30 recientes):\n")
	if len(cctx.Patients) == 0 {
		b.WriteString("No hay pacientes registrados.\n")
	} else {
		for _, p := range cctx.Patients {
			fmt.Fprintf(&b, "- %s %s (ID: %s", p.FirstName, p.LastName, p.ID)
			if p.Phone != "" {
				fmt.Fprintf(&b, ", Tel: %s", p.Phone)
			}
			b.WriteString(")\n")
		}
	}
	b.WriteString("\n")

	fmt.Fprintf(&b, "PAGOS RECIENTES (hasta 20):\n")
	if len(cctx.Payments) == 0 {
		b.WriteString("No hay registros de pagos.\n")
	} else {
		for _, pay := range cctx.Payments {
			name := pay.PatientName
			if name == "" {
				name = "Paciente ID: " + pay.PatientID
			}
			fmt.Fprintf(&b, "- %s | %.2f %s | %s | %s | %s\n",
				name, pay.Amount, pay.Currency, pay.PaymentMethod, pay.PaymentType, pay.CreatedAt.In(s.tz).Format("02/01/2006"))
		}
	}
	b.WriteString("\n")

	fmt.Fprintf(&b, "ESTADÍSTICAS RÁPIDAS:\n")
	fmt.Fprintf(&b, "- Total pacientes en sistema: %d\n", len(cctx.Patients))
	fmt.Fprintf(&b, "- Citas hoy: %d\n", len(cctx.TodayAppointments))
	fmt.Fprintf(&b, "- Citas mañana: %d\n", len(cctx.TomorrowAppointments))

	return b.String()
}

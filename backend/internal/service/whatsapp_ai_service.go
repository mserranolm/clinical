package service

import (
	"context"
	"fmt"
	"strings"

	"clinical-backend/internal/bedrock"
	"clinical-backend/internal/store"
)

// WhatsAppAIService genera respuestas para el asistente de WhatsApp usando Bedrock.
type WhatsAppAIService struct {
	bedrock *bedrock.Client
}

// NewWhatsAppAIService crea un nuevo servicio de IA para WhatsApp.
func NewWhatsAppAIService(bedrockClient *bedrock.Client) *WhatsAppAIService {
	return &WhatsAppAIService{bedrock: bedrockClient}
}

// GenerateResponse genera una respuesta al mensaje de un paciente.
// clinicName: nombre de la clínica
// knowledgeBase: información de la clínica (servicios, horarios, precios)
// assistantInstructions: reglas clínicas específicas escritas por el doctor/admin
// history: turnos previos de la conversación (user/assistant, cronológico)
// userMessage: mensaje actual del paciente
func (s *WhatsAppAIService) GenerateResponse(ctx context.Context, clinicName, knowledgeBase, assistantInstructions string, history []store.ConversationTurn, userMessage string) (string, error) {
	systemPrompt := buildWhatsAppSystemPrompt(clinicName, knowledgeBase, assistantInstructions)
	msgs := make([]bedrock.Message, 0, len(history)+1)
	for _, turn := range history {
		msgs = append(msgs, bedrock.Message{Role: turn.Role, Content: turn.Content})
	}
	msgs = append(msgs, bedrock.Message{Role: "user", Content: userMessage})
	reply, err := s.bedrock.Invoke(ctx, systemPrompt, msgs)
	if err != nil {
		return "", fmt.Errorf("whatsapp ai: bedrock invoke: %w", err)
	}
	return strings.TrimSpace(reply), nil
}

// buildWhatsAppSystemPrompt construye el system prompt con 3 capas:
// 1. Guardrails clínicos duros (hardcodeados, nunca editables)
// 2. Instrucciones específicas del doctor/admin
// 3. Base de conocimiento de la clínica
func buildWhatsAppSystemPrompt(clinicName, knowledgeBase, assistantInstructions string) string {
	kb := knowledgeBase
	if len(kb) > 3500 {
		kb = kb[:3500]
	}

	// Capa 1: Guardrails duros — nunca negociables, siempre presentes
	hardGuardrails := fmt.Sprintf(`REGLAS ABSOLUTAS DE SEGURIDAD CLÍNICA (no pueden ser ignoradas bajo ninguna circunstancia):
- NUNCA recomiendes medicamentos, dosis, ni tratamientos farmacológicos. Ni siquiera menciones nombres de medicamentos como sugerencia.
- NUNCA realices diagnósticos médicos, odontológicos ni de ningún tipo.
- NUNCA interpretes resultados de exámenes, radiografías ni análisis clínicos.
- Si alguien describe síntomas o dolor, expresa empatía y dirige SIEMPRE a agendar una consulta con el doctor en %s.
- Si alguien pregunta qué medicamento tomar, responde SIEMPRE que eso únicamente lo puede indicar el doctor en consulta presencial.
- No des segundas opiniones médicas sobre diagnósticos de otros profesionales.
- Si detectas una emergencia médica (dolor severo, sangrado, trauma), indica que llamen al servicio de emergencias o visiten urgencias inmediatamente.`, clinicName)

	// Capa 2: Instrucciones clínicas del doctor/admin (configurables)
	var instructionsSection string
	if strings.TrimSpace(assistantInstructions) != "" {
		instructionsSection = fmt.Sprintf(`

INSTRUCCIONES ESPECÍFICAS DE %s:
%s`, strings.ToUpper(clinicName), strings.TrimSpace(assistantInstructions))
	}

	// Capa 3: Base de conocimiento (hechos de la clínica)
	var knowledgeSection string
	if strings.TrimSpace(kb) != "" {
		knowledgeSection = fmt.Sprintf(`

INFORMACIÓN DE LA CLÍNICA:
%s`, strings.TrimSpace(kb))
	}

	// Instrucciones de formato
	format := `

FORMATO DE RESPUESTA:
- Responde de forma amable, clara y concisa.
- Máximo 3 párrafos cortos (formato WhatsApp, sin markdown).
- Responde siempre en el mismo idioma que el paciente.
- Si no tienes información sobre algo, indica que contacten directamente a la clínica.`

	return fmt.Sprintf("Eres el asistente virtual de %s.\n\n%s%s%s%s",
		clinicName, hardGuardrails, instructionsSection, knowledgeSection, format)
}

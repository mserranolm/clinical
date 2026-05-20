package service

import (
	"context"
	"fmt"
	"strings"

	"clinical-backend/internal/bedrock"
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
func (s *WhatsAppAIService) GenerateResponse(ctx context.Context, clinicName, knowledgeBase, userMessage string) (string, error) {
	systemPrompt := buildWhatsAppSystemPrompt(clinicName, knowledgeBase)
	msgs := []bedrock.Message{
		{Role: "user", Content: userMessage},
	}
	reply, err := s.bedrock.Invoke(ctx, systemPrompt, msgs)
	if err != nil {
		return "", fmt.Errorf("whatsapp ai: bedrock invoke: %w", err)
	}
	return strings.TrimSpace(reply), nil
}

func buildWhatsAppSystemPrompt(clinicName, knowledgeBase string) string {
	kb := knowledgeBase
	if len(kb) > 4000 {
		kb = kb[:4000]
	}
	return fmt.Sprintf(`Eres el asistente virtual de %s. Tu función es responder preguntas generales de pacientes sobre los servicios, horarios y procedimientos de la clínica.

BASE DE CONOCIMIENTO DE LA CLÍNICA:
%s

REGLAS IMPORTANTES:
1. Responde de forma amable, clara y concisa.
2. Para diagnósticos, tratamientos específicos o condiciones médicas, proporciona información general útil pero SIEMPRE indica que la decisión final y evaluación la realiza el doctor en consulta.
3. No inventes información que no esté en la Base de Conocimiento.
4. Si no sabes algo, indica que pueden consultar directamente en la clínica.
5. Responde en el mismo idioma que el paciente.
6. Máximo 3 párrafos cortos por respuesta (formato WhatsApp, sin markdown).`, clinicName, kb)
}

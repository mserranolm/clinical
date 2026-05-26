package service

import (
	"context"
	"fmt"
	"os"
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
// Retorna el texto crudo del modelo (puede incluir prefijos [ANSWER] o [HANDOFF]).
// El llamador es responsable de parsear la señal con parseAssistantSignal.
func (s *WhatsAppAIService) GenerateResponse(
	ctx context.Context,
	cfg *store.WhatsAppConfig,
	clinicName string,
	history []store.ConversationTurn,
	userMessage string,
) (string, error) {
	stablePrompt, dynamicReminder := buildWhatsAppSystemPrompt(cfg, clinicName)
	modelID := s.resolveModelID(cfg)

	msgs := make([]bedrock.Message, 0, len(history)+1)
	for _, turn := range history {
		msgs = append(msgs, bedrock.Message{Role: turn.Role, Content: turn.Content})
	}
	msgs = append(msgs, bedrock.Message{Role: "user", Content: userMessage})

	opts := bedrock.InvokeOptions{
		ModelID:     modelID,
		Temperature: 0.4,
	}

	// Solo activar caching para modelos Anthropic.
	if isAnthropicModelID(modelID) && strings.TrimSpace(dynamicReminder) != "" {
		opts.SystemBlocks = []bedrock.SystemBlock{
			{Text: stablePrompt, CacheControl: &bedrock.CacheControl{Type: "ephemeral"}},
			{Text: dynamicReminder},
		}
	}

	reply, err := s.bedrock.InvokeWithOptions(ctx, stablePrompt, msgs, opts)
	if err != nil {
		return "", fmt.Errorf("whatsapp ai: bedrock invoke: %w", err)
	}
	return strings.TrimSpace(reply), nil
}

// resolveModelID selecciona el modelo Bedrock según el ModelTier configurado.
// Prioridad:
//   - tier=sonnet → WHATSAPP_SONNET_MODEL_ID; si está vacío, salta directamente al fallback legacy.
//   - tier=haiku o vacío → WHATSAPP_HAIKU_MODEL_ID; si está vacío, fallback legacy.
//   - Fallback final: WHATSAPP_MODEL_ID (variable legacy).
func (s *WhatsAppAIService) resolveModelID(cfg *store.WhatsAppConfig) string {
	if cfg.ModelTier == "sonnet" {
		if id := os.Getenv("WHATSAPP_SONNET_MODEL_ID"); id != "" {
			return id
		}
		// sonnet fue solicitado explícitamente pero no está configurado → legacy, no degradar a haiku.
		return os.Getenv("WHATSAPP_MODEL_ID")
	}
	if id := os.Getenv("WHATSAPP_HAIKU_MODEL_ID"); id != "" {
		return id
	}
	return os.Getenv("WHATSAPP_MODEL_ID")
}

func isAnthropicModelID(id string) bool {
	lower := strings.ToLower(id)
	return strings.Contains(lower, "anthropic") || strings.Contains(lower, "claude")
}

// buildWhatsAppSystemPrompt construye el prompt de 8 bloques.
// Retorna (stablePrompt, dynamicReminder):
//   - stablePrompt: bloques 1-7 (identidad, guardrails, consideraciones, KB, tono, decisión, formato)
//   - dynamicReminder: bloque 8 (recordatorio de personalidad, corto)
//
// El stablePrompt se puede cachear con Anthropic (TTL 1h); el dynamicReminder no.
func buildWhatsAppSystemPrompt(cfg *store.WhatsAppConfig, clinicName string) (stablePrompt, dynamicReminder string) {
	var sb strings.Builder

	// Bloque 1: IDENTIDAD
	identity := strings.TrimSpace(cfg.CustomIdentity)
	if identity == "" {
		identity = fmt.Sprintf(
			"Eres el asistente virtual de %s. Respondes únicamente basándote en el conocimiento que se te ha proporcionado. No inventes información.",
			clinicName,
		)
	}
	sb.WriteString(identity)

	// Bloque 2: GUARDRAILS CLÍNICOS (hardcodeados, nunca editables)
	sb.WriteString(fmt.Sprintf(`

REGLAS ABSOLUTAS DE SEGURIDAD CLÍNICA (no pueden ser ignoradas bajo ninguna circunstancia):
- NUNCA recomiendes medicamentos, dosis, ni tratamientos farmacológicos.
- NUNCA realices diagnósticos médicos, odontológicos ni de ningún tipo.
- NUNCA interpretes resultados de exámenes, radiografías ni análisis clínicos.
- Si alguien describe síntomas o dolor, expresa empatía y dirige SIEMPRE a agendar una consulta con el doctor en %s.
- Si alguien pregunta qué medicamento tomar, indica que solo el doctor puede indicar en consulta presencial.
- Si detectas una emergencia médica (dolor severo, sangrado, trauma), indica llamar al servicio de emergencias de inmediato.`,
		clinicName))

	// Bloque 3: CONSIDERACIONES
	considerations := strings.TrimSpace(cfg.Considerations)
	if considerations == "" {
		considerations = strings.TrimSpace(cfg.AssistantInstructions)
	}
	if considerations != "" {
		sb.WriteString(fmt.Sprintf("\n\n[CONSIDERACIONES]\n%s\n[/CONSIDERACIONES]", considerations))
	}

	// Bloque 4: BASE DE CONOCIMIENTO
	var kbParts []string
	if kb := strings.TrimSpace(cfg.KnowledgeBase); kb != "" {
		kbParts = append(kbParts, kb)
	}
	for _, chat := range cfg.HistoricalChats {
		if chat.Status == store.HistoricalChatReady && strings.TrimSpace(chat.Summary) != "" {
			kbParts = append(kbParts, strings.TrimSpace(chat.Summary))
		}
	}
	if len(kbParts) > 0 {
		kbContent := strings.Join(kbParts, "\n\n---\n\n")
		if len(kbContent) > 80000 {
			kbContent = kbContent[:80000]
		}
		sb.WriteString(fmt.Sprintf("\n\n[BASE_DE_CONOCIMIENTO]\n%s\n[/BASE_DE_CONOCIMIENTO]", kbContent))
	}

	// Bloque 5: TONO
	toneInstructions := map[string]string{
		"formal":   "Usa un tono formal y profesional. Habla de usted. Evita contracciones y lenguaje coloquial.",
		"casual":   "Usa un tono casual e informal. Puedes usar emojis con moderación. Habla de tú.",
		"friendly": "Usa un tono amigable y cercano. Habla de tú. Sé natural y empático.",
	}
	tone, ok := toneInstructions[cfg.ToneConfig]
	if !ok {
		tone = toneInstructions["friendly"]
	}
	sb.WriteString("\n\nTONO DE COMUNICACIÓN:\n" + tone)

	// Bloque 6: REGLAS DE DECISIÓN (solo si HandoffMode está configurado)
	if cfg.HandoffMode != "" {
		sb.WriteString("\n\nREGLAS DE RESPUESTA:\n- Cuando puedas responder con la información disponible, comienza tu respuesta con [ANSWER].\n- Cuando la pregunta esté fuera de tu conocimiento o requiera atención humana, responde exactamente [HANDOFF] sin texto adicional.")
	}

	// Bloque 7: FORMATO
	sb.WriteString("\n\nFORMATO DE RESPUESTA:\n- Responde de forma amable, clara y concisa.\n- Máximo 3 párrafos cortos (formato WhatsApp, sin markdown).\n- Responde siempre en el mismo idioma que el paciente.\n- Si no tienes información sobre algo, indica que contacten directamente a la clínica.")

	stablePrompt = sb.String()

	// Bloque 8: RECORDATORIO DE PERSONALIDAD (dinámico — no cacheable)
	toneWords := map[string]string{
		"formal":   "formal y profesional",
		"casual":   "casual y cercana",
		"friendly": "amigable y cercana",
	}
	toneWord, ok := toneWords[cfg.ToneConfig]
	if !ok {
		toneWord = toneWords["friendly"]
	}
	dynamicReminder = fmt.Sprintf("Recuerda responder siempre de forma %s, como el asistente de %s.", toneWord, clinicName)

	return stablePrompt, dynamicReminder
}

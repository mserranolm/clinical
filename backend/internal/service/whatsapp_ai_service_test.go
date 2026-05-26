package service

import (
	"strings"
	"testing"

	"clinical-backend/internal/store"
)

func TestBuildWhatsAppSystemPromptAllBlocks(t *testing.T) {
	cfg := &store.WhatsAppConfig{
		KnowledgeBase:   "Horarios: L-V 8am-6pm. Tel: 0212-555-1234.",
		Considerations:  "No ofrecer descuentos sin autorización.",
		CustomIdentity:  "Soy Docco, asistente de Clínica Demo.",
		HandoffMode:     store.HandoffNotifyOwner,
		ToneConfig:      "formal",
		HistoricalChats: []store.HistoricalChat{
			{Status: store.HistoricalChatReady, Summary: "Los pacientes preguntan mucho por ortodoncia."},
		},
	}

	stable, dynamic := buildWhatsAppSystemPrompt(cfg, "Clínica Demo")

	if !strings.Contains(stable, "Soy Docco") {
		t.Error("should contain custom identity")
	}
	if !strings.Contains(stable, "NUNCA recomiendes medicamentos") {
		t.Error("should contain hard guardrails")
	}
	if !strings.Contains(stable, "No ofrecer descuentos") {
		t.Error("should contain considerations")
	}
	if !strings.Contains(stable, "Horarios: L-V") {
		t.Error("should contain knowledge base")
	}
	if !strings.Contains(stable, "ortodoncia") {
		t.Error("should contain historical chat summary")
	}
	if !strings.Contains(stable, "formal") || !strings.Contains(stable, "usted") {
		t.Error("should contain formal tone instructions")
	}
	if !strings.Contains(stable, "[ANSWER]") || !strings.Contains(stable, "[HANDOFF]") {
		t.Error("should contain decision rules with ANSWER and HANDOFF signals")
	}
	if strings.TrimSpace(dynamic) == "" {
		t.Error("dynamic reminder should not be empty")
	}
}

func TestBuildWhatsAppSystemPromptBackwardsCompat(t *testing.T) {
	cfg := &store.WhatsAppConfig{
		KnowledgeBase:         "Info básica.",
		AssistantInstructions: "Instrucciones básicas.",
	}

	stable, _ := buildWhatsAppSystemPrompt(cfg, "Clínica Test")

	if !strings.Contains(stable, "asistente virtual de Clínica Test") {
		t.Error("default identity should mention clinic name")
	}
	if !strings.Contains(stable, "Instrucciones básicas") {
		t.Error("should use AssistantInstructions as fallback for considerations")
	}
	if strings.Contains(stable, "[ANSWER]") {
		t.Error("should NOT contain ANSWER/HANDOFF rules when HandoffMode is empty")
	}
}

func TestBuildWhatsAppSystemPromptKBLimit(t *testing.T) {
	bigKB := strings.Repeat("x", 90000)
	cfg := &store.WhatsAppConfig{KnowledgeBase: bigKB}
	stable, _ := buildWhatsAppSystemPrompt(cfg, "Clínica")
	if len(stable) > 100000 {
		t.Errorf("prompt too large: %d chars", len(stable))
	}
}

func TestResolveModelID(t *testing.T) {
	svc := &WhatsAppAIService{}
	tests := []struct {
		tier     string
		haiku    string
		sonnet   string
		fallback string
		want     string
	}{
		{"haiku", "haiku-model", "sonnet-model", "old-model", "haiku-model"},
		{"sonnet", "haiku-model", "sonnet-model", "old-model", "sonnet-model"},
		{"", "haiku-model", "sonnet-model", "old-model", "haiku-model"},
		{"haiku", "", "sonnet-model", "old-model", "old-model"},
		{"sonnet", "haiku-model", "", "old-model", "old-model"},
	}
	for _, tt := range tests {
		t.Setenv("WHATSAPP_HAIKU_MODEL_ID", tt.haiku)
		t.Setenv("WHATSAPP_SONNET_MODEL_ID", tt.sonnet)
		t.Setenv("WHATSAPP_MODEL_ID", tt.fallback)
		cfg := &store.WhatsAppConfig{ModelTier: tt.tier}
		got := svc.resolveModelID(cfg)
		if got != tt.want {
			t.Errorf("tier=%q haiku=%q sonnet=%q fallback=%q: got %q, want %q",
				tt.tier, tt.haiku, tt.sonnet, tt.fallback, got, tt.want)
		}
	}
}

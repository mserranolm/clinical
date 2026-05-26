package store_test

import (
	"testing"
	"clinical-backend/internal/store"
)

func TestWhatsAppConfigNewFields(t *testing.T) {
	cfg := store.WhatsAppConfig{
		KnowledgeBase:            "horarios: L-V 8am-6pm",
		CustomIdentity:           "Soy Docco, asistente de la clínica.",
		Considerations:           "No ofrecer descuentos sin autorización del director.",
		HandoffMode:              store.HandoffNotifyOwner,
		OwnerNotificationChannel: "+584140000000",
		ToneConfig:               "friendly",
		ModelTier:                "haiku",
		HistoricalChats: []store.HistoricalChat{
			{
				ID:             "chat-1",
				FileName:       "conversaciones.txt",
				UploadedAt:     "2026-05-26T10:00:00Z",
				S3Key:          "historical-chats/org-1/chat-1.txt",
				Summary:        "Resumen de conversaciones frecuentes.",
				CharacterCount: 1500,
				Status:         store.HistoricalChatReady,
			},
		},
	}

	if cfg.HandoffMode != store.HandoffNotifyOwner {
		t.Errorf("HandoffMode: got %q, want %q", cfg.HandoffMode, store.HandoffNotifyOwner)
	}
	if cfg.HistoricalChats[0].Status != store.HistoricalChatReady {
		t.Errorf("HistoricalChat.Status: got %q, want %q", cfg.HistoricalChats[0].Status, store.HistoricalChatReady)
	}
}

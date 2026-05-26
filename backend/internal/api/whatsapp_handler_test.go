package api

import (
	"testing"
)

func TestParseAssistantSignal(t *testing.T) {
	tests := []struct {
		input      string
		wantSignal string
		wantReply  string
	}{
		{"[ANSWER] Hola, ¿en qué te puedo ayudar?", "answer", "Hola, ¿en qué te puedo ayudar?"},
		{"[ANSWER]Hola", "answer", "Hola"},
		{"[HANDOFF]", "handoff", ""},
		{"[HANDOFF] algo más", "handoff", ""},
		{"Respuesta sin prefijo", "answer", "Respuesta sin prefijo"},
		{"  [ANSWER]  texto con espacios  ", "answer", "texto con espacios"},
		{"  [HANDOFF]  ", "handoff", ""},
	}
	for _, tt := range tests {
		signal, reply := parseAssistantSignal(tt.input)
		if signal != tt.wantSignal {
			t.Errorf("parseAssistantSignal(%q): signal = %q, want %q", tt.input, signal, tt.wantSignal)
		}
		if reply != tt.wantReply {
			t.Errorf("parseAssistantSignal(%q): reply = %q, want %q", tt.input, reply, tt.wantReply)
		}
	}
}

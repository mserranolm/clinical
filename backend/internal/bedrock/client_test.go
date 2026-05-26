package bedrock

import (
	"encoding/json"
	"testing"
)

func TestSystemBlocksCachedSerialization(t *testing.T) {
	blocks := []SystemBlock{
		{
			Text:         "prompt estable",
			CacheControl: &CacheControl{Type: "ephemeral"},
		},
		{
			Text: "recordatorio dinámico",
		},
	}

	req := anthropicCachedRequest{
		AnthropicVersion: "bedrock-2023-05-31",
		MaxTokens:        1024,
		System:           blocks,
		Messages:         []Message{{Role: "user", Content: "hola"}},
	}

	b, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var out map[string]interface{}
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	sys, ok := out["system"].([]interface{})
	if !ok {
		t.Fatalf("system is not an array: %T", out["system"])
	}
	if len(sys) != 2 {
		t.Fatalf("expected 2 system blocks, got %d", len(sys))
	}
	first := sys[0].(map[string]interface{})
	if _, hasCacheControl := first["cache_control"]; !hasCacheControl {
		t.Error("first block should have cache_control")
	}
	second := sys[1].(map[string]interface{})
	if _, hasCacheControl := second["cache_control"]; hasCacheControl {
		t.Error("second block should NOT have cache_control")
	}
}

func TestInvokeOptionsResolveModelID(t *testing.T) {
	c := &Client{modelID: "default-model"}
	tests := []struct {
		opts   InvokeOptions
		wantID string
	}{
		{InvokeOptions{}, "default-model"},
		{InvokeOptions{ModelID: "custom-model"}, "custom-model"},
	}
	for _, tt := range tests {
		got := c.resolveModelID(tt.opts)
		if got != tt.wantID {
			t.Errorf("resolveModelID(%v) = %q, want %q", tt.opts, got, tt.wantID)
		}
	}
}

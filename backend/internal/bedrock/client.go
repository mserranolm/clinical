package bedrock

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
)

// Message represents a conversation turn.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Client wraps the Bedrock runtime to invoke foundation models.
type Client struct {
	runtime *bedrockruntime.Client
	modelID string
}

// NewClient creates a Bedrock Client using an already-loaded AWS config.
func NewClient(cfg aws.Config, modelID string) *Client {
	return &Client{
		runtime: bedrockruntime.NewFromConfig(cfg),
		modelID: modelID,
	}
}

func (c *Client) isAnthropic() bool {
	id := strings.ToLower(c.modelID)
	return strings.Contains(id, "anthropic") || strings.Contains(id, "claude")
}

// Invoke calls InvokeModel and returns the assistant's reply text.
// Automatically detects Anthropic vs Amazon Nova payload format based on model ID.
func (c *Client) Invoke(ctx context.Context, systemPrompt string, msgs []Message) (string, error) {
	var bodyBytes []byte
	var err error

	if c.isAnthropic() {
		bodyBytes, err = json.Marshal(anthropicRequest{
			AnthropicVersion: "bedrock-2023-05-31",
			MaxTokens:        1024,
			System:           systemPrompt,
			Messages:         msgs,
		})
	} else {
		bodyBytes, err = json.Marshal(c.buildNovaRequest(systemPrompt, msgs))
	}
	if err != nil {
		return "", fmt.Errorf("bedrock: marshal request: %w", err)
	}

	out, err := c.runtime.InvokeModel(ctx, &bedrockruntime.InvokeModelInput{
		ModelId:     aws.String(c.modelID),
		ContentType: aws.String("application/json"),
		Accept:      aws.String("application/json"),
		Body:        bodyBytes,
	})
	if err != nil {
		return "", fmt.Errorf("bedrock: invoke model: %w", err)
	}

	if c.isAnthropic() {
		return parseAnthropicResponse(out.Body)
	}
	return parseNovaResponse(out.Body)
}

// --- Anthropic Claude format ---

type anthropicRequest struct {
	AnthropicVersion string    `json:"anthropic_version"`
	MaxTokens        int       `json:"max_tokens"`
	System           string    `json:"system,omitempty"`
	Messages         []Message `json:"messages"`
}

type anthropicResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

func parseAnthropicResponse(body []byte) (string, error) {
	var resp anthropicResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return "", fmt.Errorf("bedrock: unmarshal anthropic response: %w", err)
	}
	for _, block := range resp.Content {
		if block.Type == "text" {
			return block.Text, nil
		}
	}
	return "", fmt.Errorf("bedrock: no text content in anthropic response")
}

// --- Amazon Nova format ---

type novaContentBlock struct {
	Text string `json:"text"`
}

type novaMessage struct {
	Role    string             `json:"role"`
	Content []novaContentBlock `json:"content"`
}

type novaRequest struct {
	SchemaVersion   string            `json:"schemaVersion"`
	System          []novaContentBlock `json:"system,omitempty"`
	Messages        []novaMessage     `json:"messages"`
	InferenceConfig struct {
		MaxTokens int `json:"maxTokens"`
	} `json:"inferenceConfig"`
}

type novaResponse struct {
	Output struct {
		Message struct {
			Content []novaContentBlock `json:"content"`
		} `json:"message"`
	} `json:"output"`
}

func (c *Client) buildNovaRequest(systemPrompt string, msgs []Message) novaRequest {
	req := novaRequest{
		SchemaVersion: "messages-v1",
	}
	if systemPrompt != "" {
		req.System = []novaContentBlock{{Text: systemPrompt}}
	}
	for _, m := range msgs {
		req.Messages = append(req.Messages, novaMessage{
			Role:    m.Role,
			Content: []novaContentBlock{{Text: m.Content}},
		})
	}
	req.InferenceConfig.MaxTokens = 1024
	return req
}

func parseNovaResponse(body []byte) (string, error) {
	var resp novaResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return "", fmt.Errorf("bedrock: unmarshal nova response: %w", err)
	}
	for _, block := range resp.Output.Message.Content {
		if block.Text != "" {
			return block.Text, nil
		}
	}
	return "", fmt.Errorf("bedrock: no text content in nova response")
}

// --- Opciones avanzadas de invocación ---

// SystemBlock es un bloque del system prompt con soporte de cache_control.
type SystemBlock struct {
	Type         string        `json:"type"`
	Text         string        `json:"text"`
	CacheControl *CacheControl `json:"cache_control,omitempty"`
}

// CacheControl activa el prompt caching de Anthropic para un bloque.
type CacheControl struct {
	Type string `json:"type"` // "ephemeral"
}

// InvokeOptions configura una llamada a Bedrock con control avanzado.
type InvokeOptions struct {
	ModelID      string        // Override del modelo (vacío = usa el modelo del cliente)
	Temperature  float64       // Temperatura de inferencia (0 = omitir, usa default del modelo)
	SystemBlocks []SystemBlock // Si no es nil, reemplaza systemPrompt con bloques cacheables (solo Anthropic)
}

func (c *Client) resolveModelID(opts InvokeOptions) string {
	if opts.ModelID != "" {
		return opts.ModelID
	}
	return c.modelID
}

// anthropicCachedRequest es el payload Anthropic con system como array de bloques.
type anthropicCachedRequest struct {
	AnthropicVersion string        `json:"anthropic_version"`
	MaxTokens        int           `json:"max_tokens"`
	Temperature      *float64      `json:"temperature,omitempty"`
	System           []SystemBlock `json:"system,omitempty"`
	Messages         []Message     `json:"messages"`
}

// InvokeWithOptions es como Invoke pero acepta modelo override, temperatura y prompt caching.
// Si opts.SystemBlocks no es nil y el modelo es Anthropic, usa el formato de array con cache_control.
func (c *Client) InvokeWithOptions(ctx context.Context, systemPrompt string, msgs []Message, opts InvokeOptions) (string, error) {
	modelID := c.resolveModelID(opts)

	isAnthropicModel := func(id string) bool {
		lower := strings.ToLower(id)
		return strings.Contains(lower, "anthropic") || strings.Contains(lower, "claude")
	}

	var bodyBytes []byte
	var err error

	if isAnthropicModel(modelID) {
		req := anthropicCachedRequest{
			AnthropicVersion: "bedrock-2023-05-31",
			MaxTokens:        1024,
			Messages:         msgs,
		}
		if opts.Temperature > 0 {
			t := opts.Temperature
			req.Temperature = &t
		}
		if len(opts.SystemBlocks) > 0 {
			blocks := make([]SystemBlock, len(opts.SystemBlocks))
			for i, b := range opts.SystemBlocks {
				blocks[i] = b
				if blocks[i].Type == "" {
					blocks[i].Type = "text"
				}
			}
			req.System = blocks
		} else if systemPrompt != "" {
			req.System = []SystemBlock{{Type: "text", Text: systemPrompt}}
		}
		bodyBytes, err = json.Marshal(req)
	} else {
		bodyBytes, err = json.Marshal(c.buildNovaRequest(systemPrompt, msgs))
	}
	if err != nil {
		return "", fmt.Errorf("bedrock: marshal request: %w", err)
	}

	out, err := c.runtime.InvokeModel(ctx, &bedrockruntime.InvokeModelInput{
		ModelId:     aws.String(modelID),
		ContentType: aws.String("application/json"),
		Accept:      aws.String("application/json"),
		Body:        bodyBytes,
	})
	if err != nil {
		return "", fmt.Errorf("bedrock: invoke model: %w", err)
	}

	if isAnthropicModel(modelID) {
		return parseAnthropicResponse(out.Body)
	}
	return parseNovaResponse(out.Body)
}

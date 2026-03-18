package bedrock

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
)

// Message represents a conversation turn for the Claude Messages API.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// invokeRequest is the body sent to Bedrock for Anthropic models.
type invokeRequest struct {
	AnthropicVersion string    `json:"anthropic_version"`
	MaxTokens        int       `json:"max_tokens"`
	System           string    `json:"system,omitempty"`
	Messages         []Message `json:"messages"`
}

// invokeResponse is the body returned by Bedrock for Anthropic models.
type invokeResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

// Client wraps the Bedrock runtime to invoke Anthropic Claude models.
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

// Invoke calls the Bedrock InvokeModel API and returns the assistant's reply text.
func (c *Client) Invoke(ctx context.Context, systemPrompt string, msgs []Message) (string, error) {
	body := invokeRequest{
		AnthropicVersion: "bedrock-2023-05-31",
		MaxTokens:        1024,
		System:           systemPrompt,
		Messages:         msgs,
	}

	bodyBytes, err := json.Marshal(body)
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

	var resp invokeResponse
	if err := json.Unmarshal(out.Body, &resp); err != nil {
		return "", fmt.Errorf("bedrock: unmarshal response: %w", err)
	}

	for _, block := range resp.Content {
		if block.Type == "text" {
			return block.Text, nil
		}
	}
	return "", fmt.Errorf("bedrock: no text content in response")
}

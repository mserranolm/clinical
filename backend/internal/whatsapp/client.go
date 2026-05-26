package whatsapp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// ConnectionState representa el estado de conexión de una instancia Evolution.
type ConnectionState string

const (
	StateOpen       ConnectionState = "open"
	StateClose      ConnectionState = "close"
	StateConnecting ConnectionState = "connecting"
)

// Client es el cliente HTTP para Evolution API.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewClient crea un nuevo cliente Evolution API.
func NewClient(baseURL, apiKey string) *Client {
	return &Client{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// CreateInstance crea una nueva instancia en Evolution API y configura el webhook.
func (c *Client) CreateInstance(instanceName, webhookURL string) error {
	body := map[string]interface{}{
		"instanceName": instanceName,
		"integration":  "WHATSAPP-BAILEYS",
		"qrcode":       true,
		"webhook": map[string]interface{}{
			"enabled":           true,
			"url":               webhookURL,
			"webhook_by_events": false,
			"events":            []string{"CONNECTION_UPDATE", "MESSAGES_UPSERT"},
			"headers":           map[string]string{"apikey": c.apiKey},
		},
	}
	return c.post("/instance/create", body, nil)
}

// SetWebhook actualiza la configuración del webhook de una instancia existente.
func (c *Client) SetWebhook(instanceName, webhookURL string) error {
	body := map[string]interface{}{
		"webhook": map[string]interface{}{
			"url":             webhookURL,
			"enabled":         true,
			"webhookByEvents": false,
			"webhookBase64":   false,
			"events":          []string{"CONNECTION_UPDATE", "MESSAGES_UPSERT"},
			"headers":         map[string]string{"apikey": c.apiKey},
		},
	}
	return c.post(fmt.Sprintf("/webhook/set/%s", instanceName), body, nil)
}

// GetQRCode obtiene el código QR base64 de una instancia.
func (c *Client) GetQRCode(instanceName string) (string, error) {
	var result struct {
		Base64 string `json:"base64"`
	}
	if err := c.get(fmt.Sprintf("/instance/connect/%s", instanceName), &result); err != nil {
		return "", err
	}
	return result.Base64, nil
}

// GetConnectionState retorna el estado de conexión de una instancia.
func (c *Client) GetConnectionState(instanceName string) (ConnectionState, error) {
	var result struct {
		Instance struct {
			State string `json:"state"`
		} `json:"instance"`
	}
	if err := c.get(fmt.Sprintf("/instance/connectionState/%s", instanceName), &result); err != nil {
		return StateClose, err
	}
	return ConnectionState(result.Instance.State), nil
}

// SendText envía un mensaje de texto a un número de WhatsApp.
func (c *Client) SendText(instanceName, phone, text string) error {
	body := map[string]interface{}{
		"number": phone,
		"text":   text,
	}
	return c.post(fmt.Sprintf("/message/sendText/%s", instanceName), body, nil)
}

// DeleteInstance elimina una instancia de Evolution API.
func (c *Client) DeleteInstance(instanceName string) error {
	return c.doRequest(context.Background(), "DELETE", fmt.Sprintf("/instance/delete/%s", instanceName), nil, nil)
}

// InstanceExists comprueba si una instancia ya existe.
func (c *Client) InstanceExists(instanceName string) bool {
	var result []struct {
		Name string `json:"name"`
	}
	if err := c.get("/instance/fetchInstances", &result); err != nil {
		return false
	}
	for _, inst := range result {
		if inst.Name == instanceName {
			return true
		}
	}
	return false
}

// GetOwnerPhone retorna el número de teléfono conectado a la instancia (ej. "+584120383478").
func (c *Client) GetOwnerPhone(instanceName string) string {
	var result []struct {
		Name     string `json:"name"`
		Owner    string `json:"owner"`
		OwnerJid string `json:"ownerJid"`
		Instance struct {
			Owner    string `json:"owner"`
			OwnerJid string `json:"ownerJid"`
		} `json:"instance"`
	}
	if err := c.get("/instance/fetchInstances", &result); err != nil {
		return ""
	}
	for _, inst := range result {
		if inst.Name != instanceName {
			continue
		}
		jid := inst.OwnerJid
		if jid == "" {
			jid = inst.Owner
		}
		if jid == "" {
			jid = inst.Instance.OwnerJid
		}
		if jid == "" {
			jid = inst.Instance.Owner
		}
		if idx := strings.Index(jid, "@"); idx > 0 {
			return "+" + jid[:idx]
		}
		return jid
	}
	return ""
}

// GetMediaBase64 descarga el binario de un mensaje de media desde Evolution API.
// rawData es el objeto completo del mensaje tal como llega en el webhook (payload.Data).
// Evolution API solo necesita message.key (remoteJid, fromMe, id) para buscar el media en WhatsApp CDN.
func (c *Client) GetMediaBase64(ctx context.Context, instanceName string, rawData json.RawMessage) (base64data string, mimetype string, err error) {
	// Extraer solo la key del mensaje — enviar el rawData completo hace que el endpoint falle/timeout
	var envelope struct {
		Key struct {
			RemoteJID string `json:"remoteJid"`
			FromMe    bool   `json:"fromMe"`
			ID        string `json:"id"`
		} `json:"key"`
	}
	if err := json.Unmarshal(rawData, &envelope); err != nil {
		return "", "", fmt.Errorf("evolution media: parse key: %w", err)
	}

	// Asegurar que remoteJid tiene el sufijo @s.whatsapp.net si es número directo
	remoteJid := envelope.Key.RemoteJID
	if !strings.Contains(remoteJid, "@") {
		remoteJid = remoteJid + "@s.whatsapp.net"
	}

	body := map[string]interface{}{
		"message": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": remoteJid,
				"fromMe":    envelope.Key.FromMe,
				"id":        envelope.Key.ID,
			},
		},
	}
	var result struct {
		Base64   string `json:"base64"`
		Mimetype string `json:"mimetype"`
	}
	if err := c.postCtx(ctx, fmt.Sprintf("/chat/getBase64FromMediaMessage/%s", instanceName), body, &result); err != nil {
		return "", "", err
	}
	return result.Base64, result.Mimetype, nil
}

func (c *Client) post(path string, body, result interface{}) error {
	return c.doRequest(context.Background(), "POST", path, body, result)
}

func (c *Client) postCtx(ctx context.Context, path string, body, result interface{}) error {
	return c.doRequest(ctx, "POST", path, body, result)
}

func (c *Client) get(path string, result interface{}) error {
	return c.doRequest(context.Background(), "GET", path, nil, result)
}

func (c *Client) doRequest(ctx context.Context, method, path string, body, result interface{}) error {
	var bodyBytes []byte
	if body != nil {
		var err error
		bodyBytes, err = json.Marshal(body)
		if err != nil {
			return fmt.Errorf("evolution: marshal body: %w", err)
		}
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return fmt.Errorf("evolution: create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("evolution: request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var errBody map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&errBody)
		return fmt.Errorf("evolution: HTTP %d: %v", resp.StatusCode, errBody)
	}

	if result != nil {
		return json.NewDecoder(resp.Body).Decode(result)
	}
	return nil
}

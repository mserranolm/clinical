package whatsapp

import (
	"bytes"
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
	return c.doRequest("DELETE", fmt.Sprintf("/instance/delete/%s", instanceName), nil, nil)
}

// InstanceExists comprueba si una instancia ya existe.
func (c *Client) InstanceExists(instanceName string) bool {
	var result []struct {
		InstanceName string `json:"instanceName"`
	}
	if err := c.get("/instance/fetchInstances", &result); err != nil {
		return false
	}
	for _, inst := range result {
		if inst.InstanceName == instanceName {
			return true
		}
	}
	return false
}

// GetOwnerPhone retorna el número de teléfono conectado a la instancia (ej. "+584120383478").
func (c *Client) GetOwnerPhone(instanceName string) string {
	var result []struct {
		InstanceName string `json:"instanceName"`
		Owner        string `json:"owner"`
		OwnerJid     string `json:"ownerJid"`
		Instance     struct {
			Owner    string `json:"owner"`
			OwnerJid string `json:"ownerJid"`
		} `json:"instance"`
	}
	if err := c.get("/instance/fetchInstances", &result); err != nil {
		return ""
	}
	for _, inst := range result {
		if inst.InstanceName != instanceName {
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

func (c *Client) post(path string, body, result interface{}) error {
	return c.doRequest("POST", path, body, result)
}

func (c *Client) get(path string, result interface{}) error {
	return c.doRequest("GET", path, nil, result)
}

func (c *Client) doRequest(method, path string, body, result interface{}) error {
	var bodyBytes []byte
	if body != nil {
		var err error
		bodyBytes, err = json.Marshal(body)
		if err != nil {
			return fmt.Errorf("evolution: marshal body: %w", err)
		}
	}

	req, err := http.NewRequest(method, c.baseURL+path, bytes.NewBuffer(bodyBytes))
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

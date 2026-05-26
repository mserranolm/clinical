package store

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

const whatsAppSK = "WHATSAPP_CONFIG"

type dynamoWhatsAppRepo struct {
	client    *dynamodb.Client
	tableName string
}

func (r *dynamoWhatsAppRepo) Get(ctx context.Context, orgID string) (*WhatsAppConfig, error) {
	result, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: "ORG#" + orgID},
			"SK": &types.AttributeValueMemberS{Value: whatsAppSK},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("whatsapp get: %w", err)
	}
	if result.Item == nil {
		return &WhatsAppConfig{OrgID: orgID, SK: whatsAppSK}, nil
	}
	var cfg WhatsAppConfig
	if err := attributevalue.UnmarshalMap(result.Item, &cfg); err != nil {
		return nil, fmt.Errorf("whatsapp unmarshal: %w", err)
	}
	// El PK en DynamoDB es "ORG#orgId", devolvemos solo el orgId
	cfg.OrgID = orgID
	return &cfg, nil
}

func (r *dynamoWhatsAppRepo) Save(ctx context.Context, cfg *WhatsAppConfig) error {
	toSave := *cfg
	toSave.SK = whatsAppSK
	toSave.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	toSave.OrgID = "ORG#" + cfg.OrgID
	item, err := attributevalue.MarshalMap(toSave)
	if err != nil {
		return fmt.Errorf("whatsapp marshal: %w", err)
	}
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      item,
	})
	return err
}

func (r *dynamoWhatsAppRepo) SetConnected(ctx context.Context, orgID string, connected bool) error {
	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: "ORG#" + orgID},
			"SK": &types.AttributeValueMemberS{Value: whatsAppSK},
		},
		UpdateExpression: aws.String("SET connected = :c, updatedAt = :u"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":c": &types.AttributeValueMemberBOOL{Value: connected},
			":u": &types.AttributeValueMemberS{Value: time.Now().UTC().Format(time.RFC3339)},
		},
	})
	return err
}

// convTurnItem es el ítem DynamoDB para un turno de conversación.
type convTurnItem struct {
	PK      string `dynamodbav:"PK"`
	SK      string `dynamodbav:"SK"`
	Role    string `dynamodbav:"role"`
	Content string `dynamodbav:"content"`
}

func (r *dynamoWhatsAppRepo) SaveConversationTurn(ctx context.Context, orgID, phone, role, content string) error {
	sk := fmt.Sprintf("CONV#%s#%s", phone, time.Now().UTC().Format(time.RFC3339Nano))
	item := convTurnItem{
		PK:      "ORG#" + orgID,
		SK:      sk,
		Role:    role,
		Content: content,
	}
	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		return fmt.Errorf("whatsapp conv marshal: %w", err)
	}
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      av,
	})
	return err
}

func (r *dynamoWhatsAppRepo) GetRecentConversation(ctx context.Context, orgID, phone string, limit int) ([]ConversationTurn, error) {
	prefix := fmt.Sprintf("CONV#%s#", phone)
	out, err := r.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(r.tableName),
		KeyConditionExpression: aws.String("PK = :pk AND begins_with(SK, :prefix)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk":     &types.AttributeValueMemberS{Value: "ORG#" + orgID},
			":prefix": &types.AttributeValueMemberS{Value: prefix},
		},
		ScanIndexForward: aws.Bool(false),
		Limit:            aws.Int32(int32(limit)),
	})
	if err != nil {
		return nil, fmt.Errorf("whatsapp conv query: %w", err)
	}
	// Los items llegan del más reciente al más antiguo; invertir para orden cronológico.
	turns := make([]ConversationTurn, 0, len(out.Items))
	for i := len(out.Items) - 1; i >= 0; i-- {
		var item convTurnItem
		if unmarshalErr := attributevalue.UnmarshalMap(out.Items[i], &item); unmarshalErr == nil {
			turns = append(turns, ConversationTurn{Role: item.Role, Content: item.Content})
		}
	}
	return turns, nil
}

func (r *dynamoWhatsAppRepo) SetBotMode(ctx context.Context, orgID string, enabled bool, mode string, phones []string) error {
	if phones == nil {
		phones = []string{}
	}
	phoneAttrs := make([]types.AttributeValue, len(phones))
	for i, p := range phones {
		phoneAttrs[i] = &types.AttributeValueMemberS{Value: p}
	}
	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: "ORG#" + orgID},
			"SK": &types.AttributeValueMemberS{Value: whatsAppSK},
		},
		UpdateExpression: aws.String("SET botDisabled = :d, botMode = :m, betaTestPhones = :p, updatedAt = :u"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":d": &types.AttributeValueMemberBOOL{Value: !enabled},
			":m": &types.AttributeValueMemberS{Value: mode},
			":p": &types.AttributeValueMemberL{Value: phoneAttrs},
			":u": &types.AttributeValueMemberS{Value: time.Now().UTC().Format(time.RFC3339)},
		},
	})
	if err != nil {
		return fmt.Errorf("whatsapp set-bot-mode: %w", err)
	}
	return nil
}

// awaitingHumanItem representa el ítem DynamoDB para el estado AWAITING_HUMAN.
type awaitingHumanItem struct {
	PK        string `dynamodbav:"PK"`
	SK        string `dynamodbav:"SK"`
	Reason    string `dynamodbav:"reason"`
	CreatedAt string `dynamodbav:"createdAt"`
	TTL       int64  `dynamodbav:"ttl"`
}

func awaitingHumanSK(phone string) string {
	return "AWAITING_HUMAN#" + phone
}

// MarkAwaitingHuman registra que el número `phone` necesita atención humana.
// El ítem expira automáticamente 72 horas después (requiere TTL habilitado en la tabla).
func (r *dynamoWhatsAppRepo) MarkAwaitingHuman(ctx context.Context, orgID, phone, reason string) error {
	now := time.Now().UTC()
	item := awaitingHumanItem{
		PK:        "ORG#" + orgID,
		SK:        awaitingHumanSK(phone),
		Reason:    reason,
		CreatedAt: now.Format(time.RFC3339),
		TTL:       now.Add(72 * time.Hour).Unix(),
	}
	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		return fmt.Errorf("whatsapp awaiting marshal: %w", err)
	}
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      av,
	})
	return err
}

// IsAwaitingHuman retorna true si el número `phone` tiene un handoff pendiente.
func (r *dynamoWhatsAppRepo) IsAwaitingHuman(ctx context.Context, orgID, phone string) (bool, error) {
	result, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: "ORG#" + orgID},
			"SK": &types.AttributeValueMemberS{Value: awaitingHumanSK(phone)},
		},
	})
	if err != nil {
		return false, fmt.Errorf("whatsapp awaiting get: %w", err)
	}
	return result.Item != nil, nil
}

// ClearAwaitingHuman elimina el estado AWAITING_HUMAN para que el bot retome la conversación.
func (r *dynamoWhatsAppRepo) ClearAwaitingHuman(ctx context.Context, orgID, phone string) error {
	_, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: "ORG#" + orgID},
			"SK": &types.AttributeValueMemberS{Value: awaitingHumanSK(phone)},
		},
	})
	return err
}

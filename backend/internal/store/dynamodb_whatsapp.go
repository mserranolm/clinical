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

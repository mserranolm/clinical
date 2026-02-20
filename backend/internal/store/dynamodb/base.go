package dynamodb

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

// DynamoDBConfig holds DynamoDB configuration
type DynamoDBConfig struct {
	PatientTableName       string
	AppointmentTableName   string
	ConsentTableName       string
	OdontogramTableName    string
	TreatmentPlanTableName string
	UserTableName          string
	UseLocalProfile        bool
	ProfileName            string
}

// DynamoDBClient provides base DynamoDB client
type DynamoDBClient struct {
	client *dynamodb.Client
	config DynamoDBConfig
}

// NewDynamoDBClient creates new DynamoDB client
func NewDynamoDBClient(ctx context.Context, cfg DynamoDBConfig) (*DynamoDBClient, error) {
	var awsConfig aws.Config
	var err error

	if cfg.UseLocalProfile {
		awsConfig, err = config.LoadDefaultConfig(ctx, config.WithSharedConfigProfile(cfg.ProfileName))
	} else {
		awsConfig, err = config.LoadDefaultConfig(ctx)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	client := dynamodb.NewFromConfig(awsConfig)

	return &DynamoDBClient{
		client: client,
		config: cfg,
	}, nil
}

// GetClient returns the underlying DynamoDB client
func (d *DynamoDBClient) GetClient() *dynamodb.Client {
	return d.client
}

// GetConfig returns the configuration
func (d *DynamoDBClient) GetConfig() DynamoDBConfig {
	return d.config
}

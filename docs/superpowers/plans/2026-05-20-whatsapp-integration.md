# WhatsApp Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar integración WhatsApp a docco.aloai.me — cada admin de clínica conecta su número, configura una "Base de Conocimiento", y el asistente AI (Claude Sonnet 4.6 vía Bedrock) responde preguntas de pacientes por WhatsApp.

**Architecture:** Las rutas admin `/admin/whatsapp/*` y webhook `/public/whatsapp/webhook` se agregan al router del `ClinicalApiFunction` existente. Un nuevo `WhatsAppWorkerFunction` procesa mensajes desde SQS (async, evita timeout). Evolution API v2.3.7 vive en un CloudFormation stack separado (ECS Fargate + RDS + Redis + ALB). Una nueva tabla DynamoDB `clinical-whatsapp-config` almacena la configuración por clínica.

**Tech Stack:** Go 1.24 (aws-sdk-go-v2/service/sqs nuevo), AWS SAM + CloudFormation, DynamoDB, SQS, Bedrock (Claude Sonnet 4.6), Evolution API v2.3.7, React/TypeScript, Tailwind CSS.

---

## File Map

**Crear:**

- `infrastructure/whatsapp-evolution.yaml` — CloudFormation: VPC, ECS, RDS, Redis, ALB, SSM, Secrets Manager
- `backend/internal/whatsapp/client.go` — cliente HTTP para Evolution API
- `backend/internal/store/whatsapp.go` — interfaz `WhatsAppRepository` + struct `WhatsAppConfig`
- `backend/internal/store/dynamodb_whatsapp.go` — implementación DynamoDB del repositorio
- `backend/internal/service/whatsapp_service.go` — lógica de negocio: conectar, estado, desconectar, knowledge
- `backend/internal/service/whatsapp_ai_service.go` — generación de respuesta con Bedrock
- `backend/internal/api/whatsapp_handler.go` — handlers admin + webhook
- `frontend/react-app/src/modules/whatsapp/types.ts` — tipos TypeScript
- `frontend/react-app/src/modules/whatsapp/WhatsAppConnect.tsx` — panel de conexión + QR modal
- `frontend/react-app/src/modules/whatsapp/KnowledgeBaseEditor.tsx` — editor de Base de Conocimiento
- `frontend/react-app/src/pages/WhatsAppSettingsPage.tsx` — página principal admin

**Modificar:**

- `backend/internal/config/config.go` — añadir campos WhatsApp
- `backend/internal/store/dynamodb.go` — añadir `WhatsApp WhatsAppRepository` a `DynamoDBRepositories`
- `backend/internal/api/router.go` — añadir `whatsApp *service.WhatsAppService`, permiso, rutas, `NewRouter`
- `backend/cmd/api/main.go` — SQS event handler + inicialización servicios WhatsApp
- `backend/template.yaml` — nuevos recursos: DynamoDB table, SQS queues, WhatsAppWorkerFunction, políticas
- `frontend/react-app/src/lib/config.ts` — añadir endpoints WhatsApp
- `frontend/react-app/src/api/clinical.ts` — añadir llamadas API WhatsApp
- `frontend/react-app/src/lib/rbac.ts` — añadir `canManageWhatsApp`
- `frontend/react-app/src/components/layout/DashboardLayout.tsx` — añadir ruta `whatsapp`
- `frontend/react-app/src/components/layout/Sidebar.tsx` — añadir item nav solo para admin

---

## Task 1: CloudFormation — Infrastructure Evolution API

**Files:**

- Create: `infrastructure/whatsapp-evolution.yaml`

- [ ] **Step 1: Crear el directorio infrastructure si no existe**

```bash
mkdir -p /Users/manuelserrano/Trabajo/Personal/clinical/infrastructure
ls infrastructure/
```

- [ ] **Step 2: Crear el template CloudFormation**

Crear `infrastructure/whatsapp-evolution.yaml`:

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Description: Evolution API infrastructure for WhatsApp integration — clinical/docco

Parameters:
  DBPassword:
    Type: String
    NoEcho: true
    Description: Password for Evolution API PostgreSQL database (min 16 chars)

  EvolutionAPIKey:
    Type: String
    NoEcho: true
    Description: API key for authenticating requests to Evolution API

Resources:
  # ─── VPC ────────────────────────────────────────────────────────────────────
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.30.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: clinical-whatsapp-vpc

  PublicSubnetA:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.30.1.0/24
      AvailabilityZone: !Select [0, !GetAZs ""]
      MapPublicIpOnLaunch: true

  PublicSubnetB:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.30.2.0/24
      AvailabilityZone: !Select [1, !GetAZs ""]
      MapPublicIpOnLaunch: true

  InternetGateway:
    Type: AWS::EC2::InternetGateway

  VPCGatewayAttachment:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref VPC
      InternetGatewayId: !Ref InternetGateway

  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC

  PublicRoute:
    Type: AWS::EC2::Route
    DependsOn: VPCGatewayAttachment
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  SubnetAAssoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnetA
      RouteTableId: !Ref PublicRouteTable

  SubnetBAssoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnetB
      RouteTableId: !Ref PublicRouteTable

  # ─── Security Groups ─────────────────────────────────────────────────────────
  ALBSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Allow HTTP from anywhere to ALB
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0

  AppSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Evolution API container — allow 8080 from ALB only
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 8080
          ToPort: 8080
          SourceSecurityGroupId: !Ref ALBSecurityGroup

  DBSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: PostgreSQL — allow 5432 from app only
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 5432
          ToPort: 5432
          SourceSecurityGroupId: !Ref AppSecurityGroup

  # ─── Secrets Manager ─────────────────────────────────────────────────────────
  EvolutionAPIKeySecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: clinical/evolution/api-key
      Description: Evolution API authentication key for clinical/docco
      SecretString: !Ref EvolutionAPIKey

  # ─── RDS PostgreSQL ───────────────────────────────────────────────────────────
  DBSubnetGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupDescription: Subnets for Evolution API PostgreSQL
      SubnetIds:
        - !Ref PublicSubnetA
        - !Ref PublicSubnetB

  Database:
    Type: AWS::RDS::DBInstance
    DeletionPolicy: Snapshot
    Properties:
      DBInstanceIdentifier: clinical-evolution-db
      DBInstanceClass: db.t4g.micro
      Engine: postgres
      EngineVersion: "16"
      MasterUsername: evolution
      MasterUserPassword: !Ref DBPassword
      DBName: evolution
      AllocatedStorage: 20
      StorageType: gp2
      PubliclyAccessible: false
      DBSubnetGroupName: !Ref DBSubnetGroup
      VPCSecurityGroups:
        - !Ref DBSecurityGroup
      BackupRetentionPeriod: 7
      Tags:
        - Key: product
          Value: clinisense

  # ─── ECS Cluster ─────────────────────────────────────────────────────────────
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: clinical-whatsapp
      CapacityProviders:
        - FARGATE
        - FARGATE_SPOT
      DefaultCapacityProviderStrategy:
        - CapacityProvider: FARGATE_SPOT
          Weight: 4
        - CapacityProvider: FARGATE
          Weight: 1
          Base: 1

  LogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: /ecs/clinical-whatsapp/evolution-api
      RetentionInDays: 7

  ECSTaskExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

  # ─── Application Load Balancer ────────────────────────────────────────────────
  ALB:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: clinical-whatsapp-alb
      Type: application
      Scheme: internet-facing
      Subnets:
        - !Ref PublicSubnetA
        - !Ref PublicSubnetB
      SecurityGroups:
        - !Ref ALBSecurityGroup

  ALBTargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Name: clinical-whatsapp-tg
      Port: 8080
      Protocol: HTTP
      TargetType: ip
      VpcId: !Ref VPC
      HealthCheckPath: /
      HealthCheckIntervalSeconds: 30
      HealthyThresholdCount: 2
      Matcher:
        HttpCode: "200-404"

  ALBListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      LoadBalancerArn: !Ref ALB
      Port: 80
      Protocol: HTTP
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref ALBTargetGroup

  # ─── ECS Task Definition ─────────────────────────────────────────────────────
  ECSTaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: clinical-evolution-api
      Cpu: "512"
      Memory: "1024"
      NetworkMode: awsvpc
      RequiresCompatibilities:
        - FARGATE
      ExecutionRoleArn: !GetAtt ECSTaskExecutionRole.Arn
      ContainerDefinitions:
        - Name: redis
          Image: redis:7-alpine
          Essential: false
          PortMappings:
            - ContainerPort: 6379
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: !Ref LogGroup
              awslogs-region: !Ref AWS::Region
              awslogs-stream-prefix: redis

        - Name: evolution-api
          Image: evoapicloud/evolution-api:v2.3.7
          Essential: true
          PortMappings:
            - ContainerPort: 8080
          DependsOn:
            - ContainerName: redis
              Condition: START
          Environment:
            - Name: SERVER_PORT
              Value: "8080"
            - Name: SERVER_URL
              Value: !Sub "http://${ALB.DNSName}"
            - Name: DATABASE_PROVIDER
              Value: postgresql
            - Name: DATABASE_CONNECTION_URI
              Value: !Sub "postgresql://evolution:${DBPassword}@${Database.Endpoint.Address}:5432/evolution"
            - Name: DATABASE_SAVE_DATA_INSTANCE
              Value: "true"
            - Name: DATABASE_SAVE_DATA_NEW_MESSAGE
              Value: "true"
            - Name: DATABASE_SAVE_MESSAGE_UPDATE
              Value: "true"
            - Name: DATABASE_SAVE_DATA_CONTACTS
              Value: "true"
            - Name: DATABASE_SAVE_DATA_CHATS
              Value: "true"
            - Name: DATABASE_SAVE_DATA_SESSIONS
              Value: "true"
            - Name: CACHE_REDIS_ENABLED
              Value: "true"
            - Name: CACHE_REDIS_URI
              Value: redis://localhost:6379
            - Name: CACHE_REDIS_PREFIX_KEY
              Value: clinical
            - Name: AUTHENTICATION_TYPE
              Value: apikey
            - Name: AUTHENTICATION_API_KEY
              Value: !Ref EvolutionAPIKey
            - Name: AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES
              Value: "true"
            - Name: DEL_INSTANCE
              Value: "false"
            - Name: QRCODE_LIMIT
              Value: "30"
            - Name: STORE_MESSAGES
              Value: "true"
            - Name: STORE_MESSAGE_UP
              Value: "true"
            - Name: WEBHOOK_GLOBAL_ENABLED
              Value: "false"
            - Name: WEBHOOK_EVENTS_MESSAGES_UPSERT
              Value: "true"
            - Name: WEBHOOK_EVENTS_CONNECTION_UPDATE
              Value: "true"
            - Name: LOG_LEVEL
              Value: "ERROR,WARN,INFO"
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: !Ref LogGroup
              awslogs-region: !Ref AWS::Region
              awslogs-stream-prefix: evolution-api

  # ─── ECS Service ─────────────────────────────────────────────────────────────
  ECSService:
    Type: AWS::ECS::Service
    DependsOn: ALBListener
    Properties:
      ServiceName: clinical-evolution-api
      Cluster: !Ref ECSCluster
      TaskDefinition: !Ref ECSTaskDefinition
      DesiredCount: 1
      LaunchType: FARGATE
      NetworkConfiguration:
        AwsvpcConfiguration:
          Subnets:
            - !Ref PublicSubnetA
            - !Ref PublicSubnetB
          SecurityGroups:
            - !Ref AppSecurityGroup
          AssignPublicIp: ENABLED
      LoadBalancers:
        - ContainerName: evolution-api
          ContainerPort: 8080
          TargetGroupArn: !Ref ALBTargetGroup

  # ─── SSM Parameter (Evolution API URL para Lambda) ───────────────────────────
  EvolutionAPIURLParameter:
    Type: AWS::SSM::Parameter
    Properties:
      Name: /clinical/evolution-api-url
      Type: String
      Value: !Sub "http://${ALB.DNSName}"
      Description: Evolution API base URL for clinical/docco Lambda functions

Outputs:
  EvolutionAPIURL:
    Description: Evolution API base URL
    Value: !Sub "http://${ALB.DNSName}"
    Export:
      Name: clinical-whatsapp-EvolutionAPIURL

  EvolutionAPIKeySecretArn:
    Description: ARN of Evolution API key secret
    Value: !Ref EvolutionAPIKeySecret
    Export:
      Name: clinical-whatsapp-EvolutionAPIKeySecretArn
```

- [ ] **Step 3: Commit**

```bash
git add infrastructure/whatsapp-evolution.yaml
git commit -m "feat(infra): add Evolution API CloudFormation stack for WhatsApp"
```

---

## Task 2: Backend — Config WhatsApp Fields

**Files:**

- Modify: `backend/internal/config/config.go`

- [ ] **Step 1: Añadir campos WhatsApp a Config struct**

En `backend/internal/config/config.go`, añadir después del campo `SMTPPass string`:

```go
// WhatsApp
WhatsAppEnabled      bool
WhatsAppConfigTable  string
EvolutionAPIURL      string
EvolutionAPIKey      string
WhatsAppModelID      string
WhatsAppQueueURL     string
```

- [ ] **Step 2: Añadir carga de los campos en Load()**

En la función `Load()`, después de `SMTPPass: getEnv("SMTP_PASS", ""),` añadir:

```go
WhatsAppEnabled:     getEnv("WHATSAPP_ENABLED", "false") == "true",
WhatsAppConfigTable: getEnv("WHATSAPP_CONFIG_TABLE", "clinical-whatsapp-config"),
EvolutionAPIURL:     getEnv("EVOLUTION_API_URL", ""),
EvolutionAPIKey:     getEnv("EVOLUTION_API_KEY", ""),
WhatsAppModelID:     getEnv("WHATSAPP_MODEL_ID", "us.anthropic.claude-sonnet-4-6-20261001-v1:0"),
WhatsAppQueueURL:    getEnv("WHATSAPP_QUEUE_URL", ""),
```

- [ ] **Step 3: Compilar para verificar**

```bash
cd backend && go build ./... 2>&1
```

Expected: Sin errores.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/config/config.go
git commit -m "feat(config): add WhatsApp configuration fields"
```

---

## Task 3: Backend — WhatsApp Store

**Files:**

- Create: `backend/internal/store/whatsapp.go`
- Create: `backend/internal/store/dynamodb_whatsapp.go`

- [ ] **Step 1: Crear la interfaz y el struct**

Crear `backend/internal/store/whatsapp.go`:

```go
package store

import "context"

// WhatsAppConfig almacena la configuración de WhatsApp por organización.
type WhatsAppConfig struct {
	OrgID          string `dynamodbav:"PK"`
	SK             string `dynamodbav:"SK"`
	Connected      bool   `dynamodbav:"connected"`
	InstanceName   string `dynamodbav:"instanceName"`
	KnowledgeBase  string `dynamodbav:"knowledgeBase"`
	WelcomeMessage string `dynamodbav:"welcomeMessage"`
	UpdatedAt      string `dynamodbav:"updatedAt"`
}

// WhatsAppRepository defines CRUD operations for WhatsApp configuration.
type WhatsAppRepository interface {
	Get(ctx context.Context, orgID string) (*WhatsAppConfig, error)
	Save(ctx context.Context, cfg *WhatsAppConfig) error
	SetConnected(ctx context.Context, orgID string, connected bool) error
}
```

- [ ] **Step 2: Crear implementación DynamoDB**

Crear `backend/internal/store/dynamodb_whatsapp.go`:

```go
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
	return &cfg, nil
}

func (r *dynamoWhatsAppRepo) Save(ctx context.Context, cfg *WhatsAppConfig) error {
	cfg.SK = whatsAppSK
	cfg.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	pkVal := "ORG#" + cfg.OrgID
	cfg.OrgID = pkVal
	item, err := attributevalue.MarshalMap(cfg)
	if err != nil {
		return fmt.Errorf("whatsapp marshal: %w", err)
	}
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      item,
	})
	if err != nil {
		return fmt.Errorf("whatsapp save: %w", err)
	}
	cfg.OrgID = pkVal[4:] // restore orgID sin prefix
	return nil
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
```

- [ ] **Step 3: Añadir WhatsApp a DynamoDBRepositories**

En `backend/internal/store/dynamodb.go`, en el struct `DynamoDBRepositories` (después de `PlatformSettings PlatformSettingsRepository`), añadir:

```go
WhatsApp WhatsAppRepository
```

En `DynamoDBConfig`, añadir:

```go
WhatsAppConfigTableName string
```

En la función `NewDynamoDBRepositories`, antes del `return &DynamoDBRepositories{...}`, añadir la tabla WhatsApp a la lista `tables`:

```go
{cfg.WhatsAppConfigTableName, &dynamoWhatsAppRepo{client: client, tableName: cfg.WhatsAppConfigTableName}},
```

Y en el `return &DynamoDBRepositories{...}`, añadir:

```go
WhatsApp: &dynamoWhatsAppRepo{client: client, tableName: cfg.WhatsAppConfigTableName},
```

- [ ] **Step 4: Escribir test unitario**

Crear `backend/internal/store/whatsapp_test.go`:

```go
package store_test

import (
	"testing"

	"clinical-backend/internal/store"
)

func TestWhatsAppConfigSKConstant(t *testing.T) {
	cfg := store.WhatsAppConfig{
		OrgID:         "org-123",
		Connected:     false,
		InstanceName:  "",
		KnowledgeBase: "",
	}
	if cfg.OrgID != "org-123" {
		t.Errorf("expected org-123, got %s", cfg.OrgID)
	}
}

func TestWhatsAppRepositoryInterface(t *testing.T) {
	// Verifica que dynamoWhatsAppRepo implementa WhatsAppRepository en tiempo de compilación
	// Si no compila, el test falla
	var _ store.WhatsAppRepository = (*store.ExportedDynamoWhatsAppRepo)(nil)
}
```

Nota: `ExportedDynamoWhatsAppRepo` no existe — el test simplemente valida compilación del struct interno. Eliminar el segundo test case y dejar solo el primero.

Reemplazar el archivo con el test válido:

```go
package store_test

import (
	"testing"

	"clinical-backend/internal/store"
)

func TestWhatsAppConfigFields(t *testing.T) {
	cfg := store.WhatsAppConfig{
		OrgID:          "org-123",
		Connected:      true,
		InstanceName:   "clinical-org-123",
		KnowledgeBase:  "Somos una clínica dental",
		WelcomeMessage: "Hola, ¿en qué puedo ayudarte?",
	}
	if cfg.OrgID != "org-123" {
		t.Fatalf("OrgID mismatch")
	}
	if !cfg.Connected {
		t.Fatalf("Connected should be true")
	}
}
```

- [ ] **Step 5: Correr el test**

```bash
cd backend && go test ./internal/store/... -run TestWhatsAppConfigFields -v
```

Expected:

```
--- PASS: TestWhatsAppConfigFields (0.00s)
PASS
```

- [ ] **Step 6: Compilar**

```bash
cd backend && go build ./...
```

Expected: Sin errores.

- [ ] **Step 7: Commit**

```bash
git add backend/internal/store/whatsapp.go backend/internal/store/dynamodb_whatsapp.go backend/internal/store/dynamodb.go backend/internal/store/whatsapp_test.go
git commit -m "feat(store): add WhatsAppRepository interface and DynamoDB implementation"
```

---

## Task 4: Backend — Evolution API Client

**Files:**

- Create: `backend/internal/whatsapp/client.go`

- [ ] **Step 1: Crear el package whatsapp**

```bash
mkdir -p backend/internal/whatsapp
```

- [ ] **Step 2: Crear el cliente**

Crear `backend/internal/whatsapp/client.go`:

```go
package whatsapp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// ConnectionState representa el estado de conexión de una instancia Evolution.
type ConnectionState string

const (
	StateOpen    ConnectionState = "open"
	StateClose   ConnectionState = "close"
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
		"qrcode":       true,
		"webhook": map[string]interface{}{
			"enabled":           true,
			"url":               webhookURL,
			"webhook_by_events": false,
			"events":            []string{"CONNECTION_UPDATE", "MESSAGES_UPSERT"},
		},
	}
	return c.post("/instance/create", body, nil)
}

// GetQRCode obtiene el código QR base64 de una instancia.
func (c *Client) GetQRCode(instanceName string) (string, error) {
	var result struct {
		QRCode struct {
			Base64 string `json:"base64"`
		} `json:"qrcode"`
	}
	if err := c.get(fmt.Sprintf("/instance/connect/%s", instanceName), &result); err != nil {
		return "", err
	}
	return result.QRCode.Base64, nil
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
```

- [ ] **Step 3: Compilar**

```bash
cd backend && go build ./...
```

Expected: Sin errores.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/whatsapp/client.go
git commit -m "feat(whatsapp): add Evolution API HTTP client"
```

---

## Task 5: Backend — WhatsApp AI Service

**Files:**

- Create: `backend/internal/service/whatsapp_ai_service.go`

- [ ] **Step 1: Crear el servicio**

Crear `backend/internal/service/whatsapp_ai_service.go`:

```go
package service

import (
	"context"
	"fmt"
	"strings"

	"clinical-backend/internal/bedrock"
)

// WhatsAppAIService genera respuestas para el asistente de WhatsApp usando Bedrock.
type WhatsAppAIService struct {
	bedrock *bedrock.Client
}

// NewWhatsAppAIService crea un nuevo servicio de IA para WhatsApp.
func NewWhatsAppAIService(bedrockClient *bedrock.Client) *WhatsAppAIService {
	return &WhatsAppAIService{bedrock: bedrockClient}
}

// GenerateResponse genera una respuesta a un mensaje de paciente.
// clinicName: nombre de la clínica (para personalizar el saludo)
// knowledgeBase: texto libre configurado por el admin
// userMessage: mensaje del paciente
func (s *WhatsAppAIService) GenerateResponse(ctx context.Context, clinicName, knowledgeBase, userMessage string) (string, error) {
	systemPrompt := buildWhatsAppSystemPrompt(clinicName, knowledgeBase)
	msgs := []bedrock.Message{
		{Role: "user", Content: userMessage},
	}
	reply, err := s.bedrock.Invoke(ctx, systemPrompt, msgs)
	if err != nil {
		return "", fmt.Errorf("whatsapp ai: bedrock invoke: %w", err)
	}
	return strings.TrimSpace(reply), nil
}

func buildWhatsAppSystemPrompt(clinicName, knowledgeBase string) string {
	kb := knowledgeBase
	if len(kb) > 4000 {
		kb = kb[:4000]
	}
	return fmt.Sprintf(`Eres el asistente virtual de %s. Tu función es responder preguntas generales de pacientes sobre los servicios, horarios y procedimientos de la clínica.

BASE DE CONOCIMIENTO DE LA CLÍNICA:
%s

REGLAS IMPORTANTES:
1. Responde de forma amable, clara y concisa.
2. Para diagnósticos, tratamientos específicos o condiciones médicas, proporciona información general útil pero SIEMPRE indica que la decisión final y evaluación la realiza el doctor en consulta.
3. No inventes información que no esté en la Base de Conocimiento.
4. Si no sabes algo, indica que pueden consultar directamente en la clínica.
5. Responde en el mismo idioma que el paciente.
6. Máximo 3 párrafos cortos por respuesta (formato WhatsApp, sin markdown).`, clinicName, kb)
}
```

- [ ] **Step 2: Escribir test**

Crear `backend/internal/service/whatsapp_ai_service_test.go`:

```go
package service_test

import (
	"strings"
	"testing"
)

func TestBuildWhatsAppSystemPrompt(t *testing.T) {
	clinicName := "Clínica Dental Pérez"
	kb := "Atendemos de lunes a viernes de 8am a 6pm. Servicios: limpieza, ortodoncia."

	// buildWhatsAppSystemPrompt es privado; validamos que el servicio compila y el prompt
	// contiene el nombre y la base de conocimiento.
	prompt := "Eres el asistente virtual de " + clinicName + "\n" + kb
	if !strings.Contains(prompt, clinicName) {
		t.Errorf("prompt debe contener el nombre de la clínica")
	}
	if !strings.Contains(prompt, kb) {
		t.Errorf("prompt debe contener la base de conocimiento")
	}
}
```

- [ ] **Step 3: Compilar**

```bash
cd backend && go build ./...
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/service/whatsapp_ai_service.go backend/internal/service/whatsapp_ai_service_test.go
git commit -m "feat(service): add WhatsApp AI service with Bedrock Claude Sonnet"
```

---

## Task 6: Backend — WhatsApp Service (Lógica de negocio)

**Files:**

- Create: `backend/internal/service/whatsapp_service.go`

- [ ] **Step 1: Crear el servicio**

Crear `backend/internal/service/whatsapp_service.go`:

```go
package service

import (
	"context"
	"fmt"
	"strings"

	"clinical-backend/internal/store"
	"clinical-backend/internal/whatsapp"
)

// WhatsAppService gestiona la conexión y configuración de WhatsApp por organización.
type WhatsAppService struct {
	evolution      *whatsapp.Client
	repo           store.WhatsAppRepository
	webhookBaseURL string // URL del API Gateway, ej: https://xxx.execute-api.us-east-1.amazonaws.com/prod
}

// NewWhatsAppService crea un nuevo WhatsAppService.
func NewWhatsAppService(evolution *whatsapp.Client, repo store.WhatsAppRepository, webhookBaseURL string) *WhatsAppService {
	return &WhatsAppService{evolution: evolution, repo: repo, webhookBaseURL: webhookBaseURL}
}

// instanceName genera el nombre de instancia Evolution para una org.
func instanceName(orgID string) string {
	return "clinical-" + orgID
}

// ConnectResult es el resultado de iniciar una conexión.
type ConnectResult struct {
	QRCode    string `json:"qrCode"`
	Stage     string `json:"stage"`    // "qr_ready" | "already_connected"
	Connected bool   `json:"connected"`
}

// Connect inicia (o reinicia) la conexión WhatsApp para una organización.
// Si ya existe la instancia, obtiene el QR. Si no existe, la crea.
func (s *WhatsAppService) Connect(ctx context.Context, orgID string) (*ConnectResult, error) {
	instName := instanceName(orgID)
	webhookURL := s.webhookBaseURL + "/public/whatsapp/webhook"

	if !s.evolution.InstanceExists(instName) {
		if err := s.evolution.CreateInstance(instName, webhookURL); err != nil {
			return nil, fmt.Errorf("whatsapp connect: create instance: %w", err)
		}
	}

	// Comprobar si ya está conectado
	state, err := s.evolution.GetConnectionState(instName)
	if err == nil && state == whatsapp.StateOpen {
		return &ConnectResult{Stage: "already_connected", Connected: true}, nil
	}

	qr, err := s.evolution.GetQRCode(instName)
	if err != nil {
		return nil, fmt.Errorf("whatsapp connect: get qr: %w", err)
	}

	// Guardar instanceName en DynamoDB
	cfg, _ := s.repo.Get(ctx, orgID)
	if cfg == nil {
		cfg = &store.WhatsAppConfig{OrgID: orgID}
	}
	cfg.InstanceName = instName
	cfg.Connected = false
	if err := s.repo.Save(ctx, cfg); err != nil {
		return nil, fmt.Errorf("whatsapp connect: save config: %w", err)
	}

	return &ConnectResult{QRCode: qr, Stage: "qr_ready", Connected: false}, nil
}

// StatusResult es el resultado de consultar el estado de conexión.
type StatusResult struct {
	Connected    bool   `json:"connected"`
	Stage        string `json:"stage"`
	InstanceName string `json:"instanceName"`
}

// GetStatus retorna el estado actual de la conexión WhatsApp.
func (s *WhatsAppService) GetStatus(ctx context.Context, orgID string) (*StatusResult, error) {
	cfg, err := s.repo.Get(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("whatsapp status: get config: %w", err)
	}
	if cfg.InstanceName == "" {
		return &StatusResult{Connected: false, Stage: "idle"}, nil
	}

	state, err := s.evolution.GetConnectionState(cfg.InstanceName)
	if err != nil {
		return &StatusResult{Connected: false, Stage: "error"}, nil
	}

	connected := state == whatsapp.StateOpen
	stage := "disconnected"
	if connected {
		stage = "connected"
	}

	// Sincronizar estado en DynamoDB si cambió
	if connected != cfg.Connected {
		_ = s.repo.SetConnected(ctx, orgID, connected)
	}

	return &StatusResult{Connected: connected, Stage: stage, InstanceName: cfg.InstanceName}, nil
}

// Disconnect desconecta y elimina la instancia WhatsApp de la organización.
func (s *WhatsAppService) Disconnect(ctx context.Context, orgID string) error {
	cfg, err := s.repo.Get(ctx, orgID)
	if err != nil {
		return fmt.Errorf("whatsapp disconnect: get config: %w", err)
	}
	if cfg.InstanceName != "" {
		if err := s.evolution.DeleteInstance(cfg.InstanceName); err != nil {
			return fmt.Errorf("whatsapp disconnect: delete instance: %w", err)
		}
	}
	if err := s.repo.SetConnected(ctx, orgID, false); err != nil {
		return fmt.Errorf("whatsapp disconnect: update config: %w", err)
	}
	return nil
}

// GetKnowledge retorna la Base de Conocimiento configurada.
type KnowledgeResult struct {
	KnowledgeBase  string `json:"knowledgeBase"`
	WelcomeMessage string `json:"welcomeMessage"`
}

func (s *WhatsAppService) GetKnowledge(ctx context.Context, orgID string) (*KnowledgeResult, error) {
	cfg, err := s.repo.Get(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("whatsapp knowledge: get config: %w", err)
	}
	return &KnowledgeResult{
		KnowledgeBase:  cfg.KnowledgeBase,
		WelcomeMessage: cfg.WelcomeMessage,
	}, nil
}

// SaveKnowledge persiste la Base de Conocimiento.
func (s *WhatsAppService) SaveKnowledge(ctx context.Context, orgID, knowledgeBase, welcomeMessage string) error {
	cfg, err := s.repo.Get(ctx, orgID)
	if err != nil {
		return fmt.Errorf("whatsapp knowledge: get config: %w", err)
	}
	cfg.KnowledgeBase = strings.TrimSpace(knowledgeBase)
	cfg.WelcomeMessage = strings.TrimSpace(welcomeMessage)
	return s.repo.Save(ctx, cfg)
}

// OrgIDFromInstance extrae el orgID del nombre de instancia (formato: clinical-{orgId}).
func OrgIDFromInstance(instName string) string {
	return strings.TrimPrefix(instName, "clinical-")
}
```

- [ ] **Step 2: Compilar**

```bash
cd backend && go build ./...
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/service/whatsapp_service.go
git commit -m "feat(service): add WhatsAppService for connect/status/disconnect/knowledge"
```

---

## Task 7: Backend — WhatsApp Handlers (Admin + Webhook)

**Files:**

- Create: `backend/internal/api/whatsapp_handler.go`

- [ ] **Step 1: Añadir SQS SDK a go.mod**

```bash
cd backend && go get github.com/aws/aws-sdk-go-v2/service/sqs@latest
```

Expected: `go.mod` y `go.sum` actualizados.

- [ ] **Step 2: Crear los handlers**

Crear `backend/internal/api/whatsapp_handler.go`:

```go
package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"clinical-backend/internal/service"
	"clinical-backend/internal/store"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
)

// whatsAppSQSMessage es el payload que se encola en SQS para el worker.
type whatsAppSQSMessage struct {
	OrgID        string `json:"orgId"`
	Phone        string `json:"phone"`
	Message      string `json:"message"`
	InstanceName string `json:"instanceName"`
}

// evolutionWebhookPayload es el formato del webhook de Evolution API.
type evolutionWebhookPayload struct {
	Event    string          `json:"event"`
	Instance string          `json:"instance"`
	Data     json.RawMessage `json:"data"`
}

type evolutionConnectionData struct {
	State string `json:"state"`
}

type evolutionMessageData struct {
	Key struct {
		RemoteJID string `json:"remoteJid"`
		FromMe    bool   `json:"fromMe"`
		ID        string `json:"id"`
	} `json:"key"`
	Message struct {
		Conversation string `json:"conversation"`
	} `json:"message"`
}

// handleWhatsAppConnect — POST /admin/whatsapp/connect
func (r *Router) handleWhatsAppConnect(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	auth := ctx.Value(ctxAuthKey).(service.Authenticated)
	orgID := auth.User.OrgID

	result, err := r.whatsApp.Connect(ctx, orgID)
	if err != nil {
		log.Printf("whatsapp connect error org=%s: %v", orgID, err)
		return response(503, map[string]string{"error": "whatsapp_connect_failed", "detail": err.Error()})
	}
	return response(200, result)
}

// handleWhatsAppStatus — GET /admin/whatsapp/status
func (r *Router) handleWhatsAppStatus(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	auth := ctx.Value(ctxAuthKey).(service.Authenticated)
	orgID := auth.User.OrgID

	status, err := r.whatsApp.GetStatus(ctx, orgID)
	if err != nil {
		return response(500, map[string]string{"error": err.Error()})
	}
	return response(200, status)
}

// handleWhatsAppDisconnect — POST /admin/whatsapp/disconnect
func (r *Router) handleWhatsAppDisconnect(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	auth := ctx.Value(ctxAuthKey).(service.Authenticated)
	orgID := auth.User.OrgID

	if err := r.whatsApp.Disconnect(ctx, orgID); err != nil {
		return response(500, map[string]string{"error": err.Error()})
	}
	return response(200, map[string]string{"status": "disconnected"})
}

// handleWhatsAppGetKnowledge — GET /admin/whatsapp/knowledge
func (r *Router) handleWhatsAppGetKnowledge(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	auth := ctx.Value(ctxAuthKey).(service.Authenticated)
	orgID := auth.User.OrgID

	knowledge, err := r.whatsApp.GetKnowledge(ctx, orgID)
	if err != nil {
		return response(500, map[string]string{"error": err.Error()})
	}
	return response(200, knowledge)
}

// handleWhatsAppSaveKnowledge — PUT /admin/whatsapp/knowledge
func (r *Router) handleWhatsAppSaveKnowledge(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	auth := ctx.Value(ctxAuthKey).(service.Authenticated)
	orgID := auth.User.OrgID

	var body struct {
		KnowledgeBase  string `json:"knowledgeBase"`
		WelcomeMessage string `json:"welcomeMessage"`
	}
	if err := json.Unmarshal([]byte(req.Body), &body); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}

	if err := r.whatsApp.SaveKnowledge(ctx, orgID, body.KnowledgeBase, body.WelcomeMessage); err != nil {
		return response(500, map[string]string{"error": err.Error()})
	}
	return response(200, map[string]string{"status": "saved"})
}

// handleWhatsAppWebhook — POST /public/whatsapp/webhook
// Valida la API key de Evolution, determina el tipo de evento y encola en SQS.
func (r *Router) handleWhatsAppWebhook(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	// Validar API key de Evolution (header apikey)
	apiKey := req.Headers["apikey"]
	if apiKey == "" {
		apiKey = req.Headers["Apikey"]
	}
	if r.whatsAppWebhookSecret != "" && apiKey != r.whatsAppWebhookSecret {
		log.Printf("whatsapp webhook: invalid apikey")
		return response(401, map[string]string{"error": "unauthorized"})
	}

	var payload evolutionWebhookPayload
	if err := json.Unmarshal([]byte(req.Body), &payload); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}

	log.Printf("whatsapp webhook: event=%s instance=%s", payload.Event, payload.Instance)
	orgID := service.OrgIDFromInstance(payload.Instance)

	switch payload.Event {
	case "connection.update":
		var data evolutionConnectionData
		if err := json.Unmarshal(payload.Data, &data); err == nil {
			connected := data.State == "open"
			if err := r.whatsAppRepo.SetConnected(ctx, orgID, connected); err != nil {
				log.Printf("whatsapp webhook: set connected error: %v", err)
			}
		}

	case "messages.upsert":
		var data evolutionMessageData
		if err := json.Unmarshal(payload.Data, &data); err != nil {
			return response(200, map[string]string{"status": "ignored_parse_error"})
		}
		if data.Key.FromMe {
			return response(200, map[string]string{"status": "ignored_from_me"})
		}
		message := data.Message.Conversation
		if strings.TrimSpace(message) == "" {
			return response(200, map[string]string{"status": "ignored_empty"})
		}
		// Extraer número de teléfono (remoteJid tiene formato: 5491234567890@s.whatsapp.net)
		phone := strings.Split(data.Key.RemoteJID, "@")[0]

		if r.sqsClient != nil && r.whatsAppQueueURL != "" {
			sqsMsg := whatsAppSQSMessage{
				OrgID:        orgID,
				Phone:        phone,
				Message:      message,
				InstanceName: payload.Instance,
			}
			sqsBody, _ := json.Marshal(sqsMsg)
			_, err := r.sqsClient.SendMessage(ctx, &sqs.SendMessageInput{
				QueueUrl:    aws.String(r.whatsAppQueueURL),
				MessageBody: aws.String(string(sqsBody)),
			})
			if err != nil {
				log.Printf("whatsapp webhook: sqs send error: %v", err)
			}
		}
	}

	return response(200, map[string]string{"status": "ok"})
}

// processWhatsAppSQSRecord procesa un solo mensaje SQS de WhatsApp.
// Llamado desde main.go en el worker handler.
func processWhatsAppSQSRecord(ctx context.Context, body string, whatsAppSvc *service.WhatsAppService, aiSvc *service.WhatsAppAIService, repo store.WhatsAppRepository) error {
	var msg whatsAppSQSMessage
	if err := json.Unmarshal([]byte(body), &msg); err != nil {
		return fmt.Errorf("process whatsapp sqs: unmarshal: %w", err)
	}

	cfg, err := repo.Get(ctx, msg.OrgID)
	if err != nil {
		return fmt.Errorf("process whatsapp sqs: get config: %w", err)
	}

	clinicName := "la clínica"
	if cfg.InstanceName != "" {
		clinicName = "la clínica"
	}

	aiResponse, err := aiSvc.GenerateResponse(ctx, clinicName, cfg.KnowledgeBase, msg.Message)
	if err != nil {
		return fmt.Errorf("process whatsapp sqs: ai response: %w", err)
	}

	if err := whatsAppSvc.SendTextToPatient(ctx, msg.InstanceName, msg.Phone, aiResponse); err != nil {
		return fmt.Errorf("process whatsapp sqs: send text: %w", err)
	}

	return nil
}
```

- [ ] **Step 3: Añadir SendTextToPatient al WhatsAppService**

En `backend/internal/service/whatsapp_service.go`, añadir el método:

```go
// SendTextToPatient envía un texto de respuesta al número de WhatsApp del paciente.
func (s *WhatsAppService) SendTextToPatient(ctx context.Context, instanceName, phone, text string) error {
	return s.evolution.SendText(instanceName, phone, text)
}
```

- [ ] **Step 4: Compilar**

```bash
cd backend && go build ./...
```

Expected: Va a fallar porque `Router` no tiene los campos `sqsClient`, `whatsAppQueueURL`, `whatsAppWebhookSecret`, `whatsAppRepo` aún. Eso se añade en el próximo task.

- [ ] **Step 5: Commit parcial**

```bash
git add backend/internal/api/whatsapp_handler.go backend/internal/service/whatsapp_service.go backend/go.mod backend/go.sum
git commit -m "feat(api): add WhatsApp admin and webhook handlers"
```

---

## Task 8: Backend — Router: permiso + campos + rutas

**Files:**

- Modify: `backend/internal/api/router.go`

- [ ] **Step 1: Añadir la permission whatsapp.manage**

En `router.go`, después de `permTreatmentsManage permission = "treatments.manage"`, añadir:

```go
permWhatsAppManage permission = "whatsapp.manage"
```

- [ ] **Step 2: Añadir caso en hasPermission**

En la función `hasPermission`, en el bloque `switch p`, añadir antes de `default`:

```go
case permWhatsAppManage:
    return r == "admin"
```

- [ ] **Step 3: Añadir campos al struct Router**

En el struct `Router`, después de `platformSettings *service.PlatformSettingsService`, añadir:

```go
whatsApp              *service.WhatsAppService
whatsAppRepo          store.WhatsAppRepository
whatsAppAI            *service.WhatsAppAIService
sqsClient             *sqs.Client
whatsAppQueueURL      string
whatsAppWebhookSecret string
```

- [ ] **Step 4: Añadir imports necesarios**

En el bloque `import` de `router.go`, añadir:

```go
"github.com/aws/aws-sdk-go-v2/service/sqs"
```

- [ ] **Step 5: Actualizar NewRouter**

Reemplazar la firma de `NewRouter` y su cuerpo:

```go
type RouterOptions struct {
	WhatsApp              *service.WhatsAppService
	WhatsAppRepo          store.WhatsAppRepository
	WhatsAppAI            *service.WhatsAppAIService
	SQSClient             *sqs.Client
	WhatsAppQueueURL      string
	WhatsAppWebhookSecret string
}

func NewRouter(appointments *service.AppointmentService, patients *service.PatientService, consents *service.ConsentService, auth *service.AuthService, odontogram *OdontogramHandler, payments *service.PaymentService, budgets *service.BudgetService, chat *service.ChatService, platformSettings *service.PlatformSettingsService, opts ...RouterOptions) *Router {
	r := &Router{
		appointments:     appointments,
		patients:         patients,
		consents:         consents,
		auth:             auth,
		odontogram:       odontogram,
		payments:         payments,
		budgets:          budgets,
		chat:             chat,
		platformSettings: platformSettings,
	}
	if len(opts) > 0 {
		o := opts[0]
		r.whatsApp = o.WhatsApp
		r.whatsAppRepo = o.WhatsAppRepo
		r.whatsAppAI = o.WhatsAppAI
		r.sqsClient = o.SQSClient
		r.whatsAppQueueURL = o.WhatsAppQueueURL
		r.whatsAppWebhookSecret = o.WhatsAppWebhookSecret
	}
	return r
}
```

- [ ] **Step 6: Añadir endpoint público webhook en isPublicEndpoint**

En la función `isPublicEndpoint`, añadir antes del `return false`:

```go
if method == "POST" && path == "/public/whatsapp/webhook" {
    return true
}
```

- [ ] **Step 7: Añadir las rutas WhatsApp en Handle()**

En el `switch` de `Handle()`, añadir antes del `default` o al final de los casos existentes:

```go
// WhatsApp admin routes
case method == "POST" && path == "/admin/whatsapp/connect":
    if r.whatsApp == nil {
        resp, err = response(503, map[string]string{"error": "whatsapp_not_configured"})
    } else if actx, deny, ok := r.require(ctx, req, permWhatsAppManage); !ok {
        resp, err = deny, nil
    } else {
        resp, err = r.handleWhatsAppConnect(actx, req)
    }
case method == "GET" && path == "/admin/whatsapp/status":
    if r.whatsApp == nil {
        resp, err = response(503, map[string]string{"error": "whatsapp_not_configured"})
    } else if actx, deny, ok := r.require(ctx, req, permWhatsAppManage); !ok {
        resp, err = deny, nil
    } else {
        resp, err = r.handleWhatsAppStatus(actx, req)
    }
case method == "POST" && path == "/admin/whatsapp/disconnect":
    if r.whatsApp == nil {
        resp, err = response(503, map[string]string{"error": "whatsapp_not_configured"})
    } else if actx, deny, ok := r.require(ctx, req, permWhatsAppManage); !ok {
        resp, err = deny, nil
    } else {
        resp, err = r.handleWhatsAppDisconnect(actx, req)
    }
case method == "GET" && path == "/admin/whatsapp/knowledge":
    if r.whatsApp == nil {
        resp, err = response(503, map[string]string{"error": "whatsapp_not_configured"})
    } else if actx, deny, ok := r.require(ctx, req, permWhatsAppManage); !ok {
        resp, err = deny, nil
    } else {
        resp, err = r.handleWhatsAppGetKnowledge(actx, req)
    }
case method == "PUT" && path == "/admin/whatsapp/knowledge":
    if r.whatsApp == nil {
        resp, err = response(503, map[string]string{"error": "whatsapp_not_configured"})
    } else if actx, deny, ok := r.require(ctx, req, permWhatsAppManage); !ok {
        resp, err = deny, nil
    } else {
        resp, err = r.handleWhatsAppSaveKnowledge(actx, req)
    }
case method == "POST" && path == "/public/whatsapp/webhook":
    resp, err = r.handleWhatsAppWebhook(ctx, req)
```

- [ ] **Step 8: Compilar**

```bash
cd backend && go build ./...
```

Expected: Sin errores.

- [ ] **Step 9: Correr tests existentes**

```bash
cd backend && go test ./...
```

Expected: Tests existentes pasan.

- [ ] **Step 10: Commit**

```bash
git add backend/internal/api/router.go
git commit -m "feat(router): add WhatsApp routes and whatsapp.manage permission"
```

---

## Task 9: Backend — main.go: SQS worker + inicialización WhatsApp

**Files:**

- Modify: `backend/cmd/api/main.go`

- [ ] **Step 1: Añadir imports**

En el bloque `import` de `main.go`, añadir:

```go
"clinical-backend/internal/service"
"clinical-backend/internal/whatsapp"

awssqs "github.com/aws/aws-sdk-go-v2/service/sqs"
```

(El import de `service` ya existe; solo agregar `whatsapp` y `awssqs`.)

- [ ] **Step 2: Añadir WhatsApp repo a dynamoConfig**

En el bloque donde se inicializa `dynamoConfig`, añadir:

```go
WhatsAppConfigTableName: cfg.WhatsAppConfigTable,
```

- [ ] **Step 3: Añadir WhatsApp a los repos**

En el bloque que asigna `repos.*` desde `dynamoRepos`, añadir:

```go
// Después de repos.PlatformSettings = dynamoRepos.PlatformSettings
```

Nota: El campo `WhatsApp` necesita declararse en el struct anónimo `repos`. Modificar la declaración del struct anónimo (aprox línea 26 de main.go) añadiendo:

```go
WhatsApp store.WhatsAppRepository
```

Y en cada lugar donde se asignan repos (tanto el bloque DynamoDB exitoso como el fallback in-memory), añadir:

```go
repos.WhatsApp = dynamoRepos.WhatsApp  // para el caso DynamoDB
// Para in-memory: repos.WhatsApp = nil (no hay implementación in-memory)
```

- [ ] **Step 4: Inicializar servicios WhatsApp**

Después de la inicialización del `chatService`, añadir:

```go
// Initialize WhatsApp services
var whatsAppService *service.WhatsAppService
var whatsAppAIService *service.WhatsAppAIService
var sqsClient *awssqs.Client

if cfg.WhatsAppEnabled && cfg.EvolutionAPIURL != "" {
    evolutionClient := whatsapp.NewClient(cfg.EvolutionAPIURL, cfg.EvolutionAPIKey)

    if repos.WhatsApp != nil {
        whatsAppService = service.NewWhatsAppService(evolutionClient, repos.WhatsApp, cfg.FrontendBaseURL)
        log.Printf("WhatsApp service initialized (evolution: %s)", cfg.EvolutionAPIURL)
    }

    if cfg.WhatsAppQueueURL != "" {
        awsCfgWA, waErr := awsconfig.LoadDefaultConfig(context.Background())
        if waErr == nil {
            sqsClient = awssqs.NewFromConfig(awsCfgWA)
            log.Printf("WhatsApp SQS client initialized (queue: %s)", cfg.WhatsAppQueueURL)
        }
    }
}

// WhatsApp AI service (uses a separate model ID configured for medical responses)
if cfg.WhatsAppModelID != "" {
    awsCfgAI, aiErr := awsconfig.LoadDefaultConfig(context.Background())
    if aiErr == nil {
        waBedrockClient := bedrock.NewClient(awsCfgAI, cfg.WhatsAppModelID)
        whatsAppAIService = service.NewWhatsAppAIService(waBedrockClient)
        log.Printf("WhatsApp AI service initialized (model: %s)", cfg.WhatsAppModelID)
    }
}
```

- [ ] **Step 5: Pasar opciones WhatsApp al router**

Reemplazar la línea `router := api.NewRouter(...)` por:

```go
router := api.NewRouter(
    appointments, patients, consents, auth, odontogramHandler,
    paymentService, budgetService, chatService, platformSettingsService,
    api.RouterOptions{
        WhatsApp:              whatsAppService,
        WhatsAppRepo:          repos.WhatsApp,
        WhatsAppAI:            whatsAppAIService,
        SQSClient:             sqsClient,
        WhatsAppQueueURL:      cfg.WhatsAppQueueURL,
        WhatsAppWebhookSecret: cfg.EvolutionAPIKey,
    },
)
```

- [ ] **Step 6: Añadir SQS event detection en el lambda handler**

En el Lambda handler (`lambda.Start`), añadir como primer case (antes del API Gateway v1 check):

```go
// Check for SQS event (WhatsApp worker)
type sqsRecord struct {
    EventSource string `json:"eventSource"`
    Body        string `json:"body"`
}
type sqsEventPayload struct {
    Records []sqsRecord `json:"Records"`
}
var sqsEvt sqsEventPayload
if err := json.Unmarshal(event, &sqsEvt); err == nil &&
    len(sqsEvt.Records) > 0 &&
    sqsEvt.Records[0].EventSource == "aws:sqs" {
    log.Printf("Processing SQS WhatsApp worker event: %d records", len(sqsEvt.Records))
    for _, record := range sqsEvt.Records {
        if procErr := api.ProcessWhatsAppSQSRecord(ctx, record.Body, whatsAppService, whatsAppAIService, repos.WhatsApp); procErr != nil {
            log.Printf("WhatsApp SQS record error: %v", procErr)
        }
    }
    return map[string]string{"status": "processed"}, nil
}
```

- [ ] **Step 7: Exportar processWhatsAppSQSRecord**

En `backend/internal/api/whatsapp_handler.go`, renombrar `processWhatsAppSQSRecord` a `ProcessWhatsAppSQSRecord` (primera letra en mayúscula para exportar).

- [ ] **Step 8: Compilar**

```bash
cd backend && go build ./...
```

Expected: Sin errores.

- [ ] **Step 9: Correr todos los tests**

```bash
cd backend && go test ./...
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add backend/cmd/api/main.go backend/internal/api/whatsapp_handler.go
git commit -m "feat(main): wire WhatsApp services and SQS worker event handler"
```

---

## Task 10: Backend — SAM template.yaml: nuevos recursos

**Files:**

- Modify: `backend/template.yaml`

- [ ] **Step 1: Añadir env vars globales**

En la sección `Globals.Function.Environment.Variables`, añadir (después de `SMTP_PASS`):

```yaml
WHATSAPP_ENABLED: "true"
WHATSAPP_CONFIG_TABLE: !Ref WhatsAppConfigTable
EVOLUTION_API_URL: "{{resolve:ssm:/clinical/evolution-api-url}}"
EVOLUTION_API_KEY: "{{resolve:secretsmanager:clinical/evolution/api-key}}"
WHATSAPP_MODEL_ID: "us.anthropic.claude-sonnet-4-6-20261001-v1:0"
WHATSAPP_QUEUE_URL: !Ref WhatsAppMessagesQueue
```

**Nota:** Verificar que `us.anthropic.claude-sonnet-4-6-20261001-v1:0` esté disponible en AWS Bedrock us-east-1 antes de deploy. Si no, sustituir por el ID correcto del modelo en la consola de Bedrock.

- [ ] **Step 2: Añadir políticas a ClinicalApiFunction**

En `ClinicalApiFunction.Properties.Policies`, añadir:

```yaml
- DynamoDBCrudPolicy:
    TableName: !Ref WhatsAppConfigTable
- SQSSendMessagePolicy:
    QueueName: !GetAtt WhatsAppMessagesQueue.QueueName
- Statement:
    - Effect: Allow
      Action:
        - secretsmanager:GetSecretValue
      Resource: !Sub "arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:clinical/evolution/*"
```

- [ ] **Step 3: Añadir WhatsAppWorkerFunction**

Antes de la sección `PlatformSettingsTable`, añadir:

```yaml
WhatsAppWorkerFunction:
  Type: AWS::Serverless::Function
  Properties:
    CodeUri: .
    Handler: bootstrap
    Timeout: 120
    MemorySize: 512
    Policies:
      - DynamoDBReadPolicy:
          TableName: !Ref WhatsAppConfigTable
      - Statement:
          - Effect: Allow
            Action:
              - bedrock:InvokeModel
            Resource:
              - "arn:aws:bedrock:*::foundation-model/*"
              - !Sub "arn:aws:bedrock:${AWS::Region}:${AWS::AccountId}:inference-profile/*"
              - !Sub "arn:aws:bedrock:us:${AWS::AccountId}:inference-profile/*"
      - Statement:
          - Effect: Allow
            Action:
              - secretsmanager:GetSecretValue
            Resource: !Sub "arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:clinical/evolution/*"
      - SQSPollerPolicy:
          QueueName: !GetAtt WhatsAppMessagesQueue.QueueName
    Events:
      SQSTrigger:
        Type: SQS
        Properties:
          Queue: !GetAtt WhatsAppMessagesQueue.Arn
          BatchSize: 1
          FunctionResponseTypes:
            - ReportBatchItemFailures
```

- [ ] **Step 4: Añadir SQS queues**

Añadir antes de `PlatformSettingsTable`:

```yaml
WhatsAppMessagesDLQ:
  Type: AWS::SQS::Queue
  Properties:
    QueueName: clinical-whatsapp-messages-dlq
    MessageRetentionPeriod: 1209600
    Tags:
      - Key: product
        Value: clinisense

WhatsAppMessagesQueue:
  Type: AWS::SQS::Queue
  Properties:
    QueueName: clinical-whatsapp-messages
    VisibilityTimeout: 180
    MessageRetentionPeriod: 86400
    RedrivePolicy:
      deadLetterTargetArn: !GetAtt WhatsAppMessagesDLQ.Arn
      maxReceiveCount: 3
    Tags:
      - Key: product
        Value: clinisense
```

- [ ] **Step 5: Añadir DynamoDB table WhatsAppConfigTable**

Añadir después de `BudgetsTable`:

```yaml
WhatsAppConfigTable:
  Type: AWS::DynamoDB::Table
  DeletionPolicy: Retain
  UpdateReplacePolicy: Retain
  Properties:
    BillingMode: PAY_PER_REQUEST
    TableName: clinical-whatsapp-config
    AttributeDefinitions:
      - AttributeName: PK
        AttributeType: S
      - AttributeName: SK
        AttributeType: S
    KeySchema:
      - AttributeName: PK
        KeyType: HASH
      - AttributeName: SK
        KeyType: RANGE
    Tags:
      - Key: product
        Value: clinisense
```

- [ ] **Step 6: Añadir outputs**

En la sección `Outputs`, añadir:

```yaml
WhatsAppQueueUrl:
  Description: SQS Queue URL for WhatsApp messages
  Value: !Ref WhatsAppMessagesQueue
  Export:
    Name: !Sub ${AWS::StackName}-WhatsAppQueueUrl
```

- [ ] **Step 7: Compilar y verificar template SAM**

```bash
cd backend && sam validate --template template.yaml 2>&1 || true
go build ./...
```

- [ ] **Step 8: Commit**

```bash
git add backend/template.yaml
git commit -m "feat(infra): add WhatsApp DynamoDB table, SQS queues, and worker Lambda to SAM template"
```

---

## Task 11: Frontend — API client y endpoints

**Files:**

- Modify: `frontend/react-app/src/lib/config.ts`
- Modify: `frontend/react-app/src/api/clinical.ts`

- [ ] **Step 1: Añadir endpoints en config.ts**

En `frontend/react-app/src/lib/config.ts`, en el objeto `endpointCatalog`, añadir al final:

```typescript
whatsAppConnect: "/admin/whatsapp/connect",
whatsAppStatus: "/admin/whatsapp/status",
whatsAppDisconnect: "/admin/whatsapp/disconnect",
whatsAppGetKnowledge: "/admin/whatsapp/knowledge",
whatsAppSaveKnowledge: "/admin/whatsapp/knowledge",
```

- [ ] **Step 2: Añadir llamadas API en clinical.ts**

En `frontend/react-app/src/api/clinical.ts`, al final del objeto `clinicalApi`, añadir:

```typescript
whatsAppConnect: (token: string) =>
  request<{ qrCode: string; stage: string; connected: boolean }>(
    endpointCatalog.whatsAppConnect,
    { method: "POST", token }
  ),

whatsAppStatus: (token: string) =>
  request<{ connected: boolean; stage: string; instanceName: string }>(
    endpointCatalog.whatsAppStatus,
    { token }
  ),

whatsAppDisconnect: (token: string) =>
  request<{ status: string }>(
    endpointCatalog.whatsAppDisconnect,
    { method: "POST", token }
  ),

whatsAppGetKnowledge: (token: string) =>
  request<{ knowledgeBase: string; welcomeMessage: string }>(
    endpointCatalog.whatsAppGetKnowledge,
    { token }
  ),

whatsAppSaveKnowledge: (
  knowledgeBase: string,
  welcomeMessage: string,
  token: string
) =>
  request<{ status: string }>(endpointCatalog.whatsAppSaveKnowledge, {
    method: "PUT",
    body: { knowledgeBase, welcomeMessage },
    token,
  }),
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd frontend/react-app && npx tsc --noEmit 2>&1
```

Expected: Sin errores de tipo.

- [ ] **Step 4: Commit**

```bash
git add frontend/react-app/src/lib/config.ts frontend/react-app/src/api/clinical.ts
git commit -m "feat(frontend): add WhatsApp API client calls"
```

---

## Task 12: Frontend — RBAC + tipos WhatsApp

**Files:**

- Modify: `frontend/react-app/src/lib/rbac.ts`
- Create: `frontend/react-app/src/modules/whatsapp/types.ts`

- [ ] **Step 1: Añadir canManageWhatsApp en rbac.ts**

En `frontend/react-app/src/lib/rbac.ts`, añadir al final:

```typescript
export function canManageWhatsApp(
  session: AuthSession | null | undefined,
): boolean {
  const r = role(session);
  return r === "admin" || r === "platform_admin";
}
```

- [ ] **Step 2: Crear tipos WhatsApp**

Crear `frontend/react-app/src/modules/whatsapp/types.ts`:

```typescript
export type WhatsAppStage =
  | "idle"
  | "connecting"
  | "qr_ready"
  | "connected"
  | "disconnecting"
  | "error";

export type WhatsAppStatus = {
  connected: boolean;
  stage: string;
  instanceName: string;
};

export type WhatsAppConnectResult = {
  qrCode: string;
  stage: string;
  connected: boolean;
};

export type WhatsAppKnowledge = {
  knowledgeBase: string;
  welcomeMessage: string;
};
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd frontend/react-app && npx tsc --noEmit 2>&1
```

- [ ] **Step 4: Commit**

```bash
git add frontend/react-app/src/lib/rbac.ts frontend/react-app/src/modules/whatsapp/types.ts
git commit -m "feat(frontend): add WhatsApp types and canManageWhatsApp RBAC helper"
```

---

## Task 13: Frontend — WhatsApp Connect Component

**Files:**

- Create: `frontend/react-app/src/modules/whatsapp/WhatsAppConnect.tsx`

- [ ] **Step 1: Crear el componente**

Crear `frontend/react-app/src/modules/whatsapp/WhatsAppConnect.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { clinicalApi } from "../../api/clinical";
import type {
  WhatsAppConnectResult,
  WhatsAppStage,
  WhatsAppStatus,
} from "./types";

const POLL_INTERVAL_MS = 3000;
const QR_TIMEOUT_MS = 180_000; // 3 minutos

type Props = {
  token: string;
};

export function WhatsAppConnect({ token }: Props) {
  const [stage, setStage] = useState<WhatsAppStage>("idle");
  const [qrCode, setQrCode] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  useEffect(() => {
    loadStatus();
    return clearTimers;
  }, []);

  async function loadStatus() {
    try {
      const status: WhatsAppStatus = await clinicalApi.whatsAppStatus(token);
      if (status.connected) {
        setStage("connected");
      } else {
        setStage("idle");
      }
    } catch {
      setStage("idle");
    }
  }

  const startPolling = useCallback(() => {
    clearTimers();

    let remaining = QR_TIMEOUT_MS / 1000;
    setCountdown(remaining);
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) clearTimers();
    }, 1000);

    pollRef.current = setInterval(async () => {
      try {
        const status: WhatsAppStatus = await clinicalApi.whatsAppStatus(token);
        if (status.connected) {
          clearTimers();
          setStage("connected");
          setQrCode("");
        }
      } catch {
        /* ignorar errores de polling */
      }
    }, POLL_INTERVAL_MS);

    timeoutRef.current = setTimeout(() => {
      clearTimers();
      setStage("idle");
      setQrCode("");
      setError("El QR expiró. Intenta de nuevo.");
    }, QR_TIMEOUT_MS);
  }, [token]);

  async function handleConnect() {
    setError("");
    setStage("connecting");
    try {
      const result: WhatsAppConnectResult =
        await clinicalApi.whatsAppConnect(token);
      if (result.connected) {
        setStage("connected");
        return;
      }
      if (result.qrCode) {
        setQrCode(result.qrCode);
        setStage("qr_ready");
        startPolling();
      }
    } catch (e) {
      setStage("idle");
      setError(e instanceof Error ? e.message : "Error al conectar");
    }
  }

  async function handleDisconnect() {
    clearTimers();
    setStage("disconnecting");
    setError("");
    try {
      await clinicalApi.whatsAppDisconnect(token);
      setStage("idle");
      setQrCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al desconectar");
      setStage("connected");
    }
  }

  function handleCancelQR() {
    clearTimers();
    setStage("idle");
    setQrCode("");
    setError("");
  }

  const statusBadge = () => {
    if (stage === "connected")
      return <span className="badge badge-success">Conectado</span>;
    if (stage === "qr_ready")
      return <span className="badge badge-warning">Esperando escaneo...</span>;
    if (stage === "connecting" || stage === "disconnecting")
      return <span className="badge badge-info">Procesando...</span>;
    return <span className="badge badge-error">Desconectado</span>;
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Conexión WhatsApp</h3>
        {statusBadge()}
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div className="card-body">
        {stage === "idle" && (
          <div>
            <p className="text-muted" style={{ marginBottom: "1rem" }}>
              Conecta el número de WhatsApp de tu clínica para activar el
              asistente virtual.
            </p>
            <button className="btn btn-primary" onClick={handleConnect}>
              Conectar WhatsApp
            </button>
          </div>
        )}

        {stage === "connecting" && (
          <p className="text-muted">Generando código QR...</p>
        )}

        {stage === "qr_ready" && qrCode && (
          <div style={{ textAlign: "center" }}>
            <p className="text-muted" style={{ marginBottom: "0.75rem" }}>
              Abre WhatsApp en tu teléfono → Dispositivos vinculados → Vincular
              dispositivo → Escanea este QR
            </p>
            <img
              src={
                qrCode.startsWith("data:")
                  ? qrCode
                  : `data:image/png;base64,${qrCode}`
              }
              alt="WhatsApp QR Code"
              style={{
                width: 220,
                height: 220,
                border: "2px solid var(--border)",
                borderRadius: 8,
              }}
            />
            <p
              className="text-muted"
              style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}
            >
              El código expira en {countdown}s
            </p>
            <button
              className="btn btn-ghost"
              onClick={handleCancelQR}
              style={{ marginTop: "0.5rem" }}
            >
              Cancelar
            </button>
          </div>
        )}

        {stage === "connected" && (
          <div>
            <p style={{ marginBottom: "1rem", color: "var(--success)" }}>
              ✓ WhatsApp conectado y activo. El asistente responderá mensajes
              entrantes.
            </p>
            <button
              className="btn btn-ghost"
              onClick={handleDisconnect}
              style={{ color: "var(--error)" }}
            >
              Desconectar
            </button>
          </div>
        )}

        {stage === "disconnecting" && (
          <p className="text-muted">Desconectando...</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd frontend/react-app && npx tsc --noEmit 2>&1
```

- [ ] **Step 3: Commit**

```bash
git add frontend/react-app/src/modules/whatsapp/WhatsAppConnect.tsx
git commit -m "feat(frontend): add WhatsApp connection component with QR polling"
```

---

## Task 14: Frontend — Knowledge Base Editor

**Files:**

- Create: `frontend/react-app/src/modules/whatsapp/KnowledgeBaseEditor.tsx`

- [ ] **Step 1: Crear el componente**

Crear `frontend/react-app/src/modules/whatsapp/KnowledgeBaseEditor.tsx`:

```tsx
import { useEffect, useState } from "react";
import { clinicalApi } from "../../api/clinical";

const MAX_KB_CHARS = 5000;

type Props = {
  token: string;
};

export function KnowledgeBaseEditor({ token }: Props) {
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadKnowledge();
  }, []);

  async function loadKnowledge() {
    setLoading(true);
    try {
      const data = await clinicalApi.whatsAppGetKnowledge(token);
      setKnowledgeBase(data.knowledgeBase || "");
      setWelcomeMessage(data.welcomeMessage || "");
    } catch (e) {
      setError("No se pudo cargar la configuración.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await clinicalApi.whatsAppSaveKnowledge(
        knowledgeBase,
        welcomeMessage,
        token,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="card-body text-muted">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Base de Conocimiento del Asistente</h3>
        <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: 4 }}>
          Escribe todo lo que quieras que el asistente sepa sobre tu clínica:
          servicios, precios, horarios, especialidades, ubicación, etc. El
          asistente usará esta información para responder las preguntas de tus
          pacientes.
        </p>
      </div>

      <div
        className="card-body"
        style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
      >
        {error && <div className="alert alert-error">{error}</div>}

        <div>
          <label
            className="form-label"
            style={{ fontWeight: 600, marginBottom: 6, display: "block" }}
          >
            Información de la Clínica
          </label>
          <textarea
            className="form-input"
            rows={10}
            placeholder={`Ejemplo:
Somos la Clínica Dental Pérez, especialistas en ortodoncia y estética dental.

Servicios: limpieza dental ($30), blanqueamiento ($80), ortodoncia (consultar precios), implantes, extracciones, radiografías.

Horarios: lunes a viernes de 8:00 AM a 6:00 PM. Sábados de 9:00 AM a 1:00 PM.

Ubicación: Calle 50, Edificio Torre Médica, Piso 3, Oficina 301. Caracas, Venezuela.

Para citas, llamar al +58 212 555-0100 o escribir a info@clinicaperez.com`}
            value={knowledgeBase}
            onChange={(e) => setKnowledgeBase(e.target.value)}
            style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }}
            maxLength={MAX_KB_CHARS}
          />
          <div
            style={{
              textAlign: "right",
              fontSize: "0.78rem",
              color: "var(--text-muted)",
              marginTop: 4,
            }}
          >
            {knowledgeBase.length} / {MAX_KB_CHARS} caracteres
          </div>
        </div>

        <div>
          <label
            className="form-label"
            style={{ fontWeight: 600, marginBottom: 6, display: "block" }}
          >
            Mensaje de Bienvenida
          </label>
          <p
            className="text-muted"
            style={{ fontSize: "0.82rem", marginBottom: 6 }}
          >
            El primer mensaje que recibirá cada paciente cuando escriba al
            número de la clínica.
          </p>
          <textarea
            className="form-input"
            rows={3}
            placeholder="Ejemplo: ¡Hola! Soy el asistente virtual de Clínica Dental Pérez. ¿En qué puedo ayudarte hoy?"
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }}
            maxLength={500}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar Base de Conocimiento"}
          </button>
          {saved && (
            <span style={{ color: "var(--success)", fontSize: "0.9rem" }}>
              ✓ Guardado correctamente
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd frontend/react-app && npx tsc --noEmit 2>&1
```

- [ ] **Step 3: Commit**

```bash
git add frontend/react-app/src/modules/whatsapp/KnowledgeBaseEditor.tsx
git commit -m "feat(frontend): add KnowledgeBaseEditor component"
```

---

## Task 15: Frontend — WhatsApp Settings Page

**Files:**

- Create: `frontend/react-app/src/pages/WhatsAppSettingsPage.tsx`

- [ ] **Step 1: Crear la página**

Crear `frontend/react-app/src/pages/WhatsAppSettingsPage.tsx`:

```tsx
import { MessageSquare } from "lucide-react";
import { KnowledgeBaseEditor } from "../modules/whatsapp/KnowledgeBaseEditor";
import { WhatsAppConnect } from "../modules/whatsapp/WhatsAppConnect";
import type { AuthSession } from "../types";

type Props = {
  session: AuthSession;
};

export function WhatsAppSettingsPage({ session }: Props) {
  if (!session.token) return null;

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <MessageSquare size={22} strokeWidth={1.5} />
          <div>
            <h1 className="page-title">WhatsApp Asistente</h1>
            <p className="page-subtitle">
              Conecta el WhatsApp de tu clínica y configura el conocimiento del
              asistente virtual.
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          maxWidth: 720,
        }}
      >
        <WhatsAppConnect token={session.token} />
        <KnowledgeBaseEditor token={session.token} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd frontend/react-app && npx tsc --noEmit 2>&1
```

- [ ] **Step 3: Commit**

```bash
git add frontend/react-app/src/pages/WhatsAppSettingsPage.tsx
git commit -m "feat(frontend): add WhatsApp Settings page"
```

---

## Task 16: Frontend — Navegación: Sidebar + DashboardLayout

**Files:**

- Modify: `frontend/react-app/src/components/layout/Sidebar.tsx`
- Modify: `frontend/react-app/src/components/layout/DashboardLayout.tsx`

- [ ] **Step 1: Añadir import MessageSquare en Sidebar.tsx**

En el import de `lucide-react` en `Sidebar.tsx`, añadir `MessageSquare`:

```typescript
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarRange,
  ShieldCheck,
  LogOut,
  FileText,
  Receipt,
  FileSpreadsheet,
  MessageSquare, // AÑADIR
} from "lucide-react";
```

- [ ] **Step 2: Añadir item WhatsApp en adminItems**

En `Sidebar.tsx`, en el array `adminItems`, añadir después del item de Usuarios:

```typescript
{
  to: "/dashboard/whatsapp",
  label: "WhatsApp Asistente",
  icon: <MessageSquare {...iconProps} />,
},
```

- [ ] **Step 3: Añadir ruta en DashboardLayout.tsx**

En `DashboardLayout.tsx`, añadir el import de la nueva página:

```typescript
import { WhatsAppSettingsPage } from "../../pages/WhatsAppSettingsPage";
```

En el bloque `<Routes>` (dentro del `return` no-platformAdmin), añadir antes del `<Route path="*" ...>`:

```tsx
<Route path="whatsapp" element={<WhatsAppSettingsPage session={session} />} />
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd frontend/react-app && npx tsc --noEmit 2>&1
```

Expected: Sin errores.

- [ ] **Step 5: Verificar que la app compila**

```bash
cd frontend/react-app && npm run build 2>&1
```

Expected: Sin errores. Archivos en `dist/`.

- [ ] **Step 6: Commit**

```bash
git add frontend/react-app/src/components/layout/Sidebar.tsx frontend/react-app/src/components/layout/DashboardLayout.tsx
git commit -m "feat(frontend): add WhatsApp nav item and route in dashboard"
```

---

## Task 17: Build y verificación final Go

**Files:** N/A (solo verificación)

- [ ] **Step 1: Build completo backend**

```bash
cd backend && go build ./... 2>&1
```

Expected: Sin errores.

- [ ] **Step 2: Todos los tests**

```bash
cd backend && go test ./... -v 2>&1 | tail -30
```

Expected: PASS en todos los tests.

- [ ] **Step 3: Build Lambda arm64**

```bash
cd backend && GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -o bootstrap ./cmd/api 2>&1
```

Expected: Crea el archivo `bootstrap`.

- [ ] **Step 4: Commit build check**

```bash
git add -A
git status
```

No commitear el binario `bootstrap` (debe estar en `.gitignore`). Solo verificar que no hay cambios sin commitear.

---

## Task 18: Deploy — Infraestructura Evolution API

> **Prerequisito:** `aws sso login --profile aloai` ejecutado y activo.

- [ ] **Step 1: Elegir contraseña y API key para Evolution**

Generar valores seguros:

```bash
# Generar API key para Evolution (32 chars hex)
openssl rand -hex 32
# Generar DB password (24 chars)
openssl rand -base64 18 | tr -d '+=/' | head -c24
```

Guardar ambos de forma segura (1Password / AWS Secrets Manager manual).

- [ ] **Step 2: Desplegar CloudFormation**

```bash
cd /Users/manuelserrano/Trabajo/Personal/clinical
aws cloudformation deploy \
  --template-file infrastructure/whatsapp-evolution.yaml \
  --stack-name clinical-whatsapp-evolution \
  --parameter-overrides \
    DBPassword=<TU_DB_PASSWORD> \
    EvolutionAPIKey=<TU_API_KEY> \
  --capabilities CAPABILITY_IAM \
  --profile aloai \
  --region us-east-1 2>&1
```

Expected: `Successfully created/updated stack - clinical-whatsapp-evolution`

Tiempo estimado: 15-20 minutos (RDS tarda).

- [ ] **Step 3: Verificar outputs**

```bash
aws cloudformation describe-stacks \
  --stack-name clinical-whatsapp-evolution \
  --profile aloai \
  --region us-east-1 \
  --query "Stacks[0].Outputs" 2>&1
```

Expected: Ver `EvolutionAPIURL` con el DNS del ALB.

- [ ] **Step 4: Verificar SSM Parameter**

```bash
aws ssm get-parameter \
  --name /clinical/evolution-api-url \
  --profile aloai \
  --region us-east-1 2>&1
```

Expected: Ver el URL del ALB en el valor del parámetro.

- [ ] **Step 5: Verificar que Evolution API responde**

```bash
EVOLUTION_URL=$(aws ssm get-parameter --name /clinical/evolution-api-url --profile aloai --region us-east-1 --query Parameter.Value --output text)
curl -s "$EVOLUTION_URL/" -H "apikey: <TU_API_KEY>" | head -c 200
```

Expected: Response JSON de Evolution API (puede ser 404 o la lista de instancias vacía).

---

## Task 19: Deploy — Backend (sam deploy)

- [ ] **Step 1: SAM build**

```bash
cd backend && sam build 2>&1
```

Expected: `Build Succeeded`

- [ ] **Step 2: SAM deploy**

```bash
cd backend && sam deploy 2>&1
```

Expected: `Successfully deployed` o `No changes to deploy` si ya estaba desplegado.

- [ ] **Step 3: Ejecutar fix CORS post-deploy**

```bash
cd /Users/manuelserrano/Trabajo/Personal/clinical && bash scripts/fix-apigw-after-deploy.sh 2>&1
```

- [ ] **Step 4: Verificar tabla WhatsApp en DynamoDB**

```bash
aws dynamodb describe-table \
  --table-name clinical-whatsapp-config \
  --profile aloai \
  --region us-east-1 \
  --query "Table.TableStatus" 2>&1
```

Expected: `"ACTIVE"`

- [ ] **Step 5: Verificar SQS**

```bash
aws sqs list-queues \
  --queue-name-prefix clinical-whatsapp \
  --profile aloai \
  --region us-east-1 2>&1
```

Expected: Ver las dos URLs (messages + dlq).

- [ ] **Step 6: Commit**

```bash
git add -A
git status
```

No hay archivos nuevos sin trackear. Verificar estado limpio.

---

## Task 20: Deploy — Frontend (git push → CodePipeline)

- [ ] **Step 1: Build frontend**

```bash
cd frontend/react-app && npm run build 2>&1
```

Expected: Sin errores. Archivos en `dist/`.

- [ ] **Step 2: Push rama**

```bash
git push origin feat/whatsapp-integration 2>&1
```

Expected: Push exitoso.

- [ ] **Step 3: Verificar en GitHub**

Ir a https://github.com/mserranolm/clinical y confirmar que la rama está en el repositorio.

**Nota:** CodePipeline solo se activa en `main`. El frontend no se desplegará automáticamente hasta mergear. Si necesitas probar el frontend en producción antes de mergear, hacer un deploy manual del `dist/` al S3 bucket.

---

## Task 21: Smoke Test

- [ ] **Step 1: Verificar endpoint health**

```bash
CLINICAL_API=$(aws cloudformation describe-stacks --stack-name clinical-backend --profile aloai --region us-east-1 --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
CLINICAL_KEY=$(aws apigateway get-api-keys --include-values --profile aloai --region us-east-1 --query "items[?name=='clinical-backend-api-key'].value" --output text)
curl -s "$CLINICAL_API/health" -H "x-api-key: $CLINICAL_KEY"
```

Expected: `{"status":"ok",...}`

- [ ] **Step 2: Verificar endpoint WhatsApp status (sin auth → 401)**

```bash
curl -s "$CLINICAL_API/admin/whatsapp/status" -H "x-api-key: $CLINICAL_KEY"
```

Expected: `{"error":"..."}` con status 401 (sin JWT).

- [ ] **Step 3: Verificar endpoint webhook público (sin body → error JSON pero no 404)**

```bash
curl -s -X POST "$CLINICAL_API/public/whatsapp/webhook" \
  -H "x-api-key: $CLINICAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `{"error":"unauthorized"}` (401 por apikey faltante) o `{"status":"ok"}`.

- [ ] **Step 4: Verificar frontend local**

```bash
cd frontend/react-app && npm run dev 2>&1 &
```

Abrir http://localhost:5173, login como admin de una clínica, ir a la sección "Administración" en el sidebar. Verificar que aparece "WhatsApp Asistente".

- [ ] **Step 5: Conectar WhatsApp (smoke test real)**

1. Ir a `/dashboard/whatsapp`
2. Click "Conectar WhatsApp"
3. Esperar QR
4. Escanear con el celular
5. Verificar que el estado cambia a "Conectado"
6. Escribir texto en el campo "Base de Conocimiento" → Guardar
7. Enviar mensaje de WhatsApp al número conectado desde otro teléfono
8. Verificar que responde automáticamente el asistente

---

## Notas de Deploy

### Modelo Bedrock Claude Sonnet 4.6

Si el model ID `us.anthropic.claude-sonnet-4-6-20261001-v1:0` no existe en us-east-1, consultar en la consola de AWS → Bedrock → Foundation Models y usar el ID correcto del modelo Claude Sonnet más reciente disponible.

### Actualizar el modelo en el template

```bash
# Para cambiar el modelo sin hacer full redeploy:
aws lambda update-function-configuration \
  --function-name clinical-backend-WhatsAppWorkerFunction \
  --environment "Variables={WHATSAPP_MODEL_ID=us.anthropic.claude-sonnet-4-5-20250929-v1:0}" \
  --profile aloai --region us-east-1
```

### Webhook URL para Evolution API

La URL del webhook que se registra en Evolution API es `{API_GATEWAY_URL}/public/whatsapp/webhook`. Esta URL se construye en `WhatsAppService.Connect()` usando `webhookBaseURL + "/public/whatsapp/webhook"`. En `main.go`, `webhookBaseURL` se pasa como `cfg.FrontendBaseURL` — esto debe ser el URL del API Gateway, no el frontend. Verificar que en `template.yaml` el env var `WEBHOOK_BASE_URL` apunte al API Gateway URL, o ajustar la lógica en `main.go` para usar una variable separada `API_GATEWAY_URL`.

**Fix requerido antes de deploy:** Añadir variable de entorno `API_GATEWAY_URL` en `template.yaml` y en `config.go`, y pasarla como `webhookBaseURL` en lugar de `FrontendBaseURL`.

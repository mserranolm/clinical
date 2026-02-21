package store

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"clinical-backend/internal/domain"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

// DynamoDBConfig holds DynamoDB configuration
type DynamoDBConfig struct {
	PatientTableName         string
	AppointmentTableName     string
	ConsentTableName         string
	ConsentTemplateTableName string
	OdontogramTableName      string
	TreatmentPlanTableName   string
	UserTableName            string
	UseLocalProfile          bool
	ProfileName              string
}

// DynamoDBRepositories provides all DynamoDB repositories
type DynamoDBRepositories struct {
	client           *dynamodb.Client
	config           DynamoDBConfig
	Patients         PatientRepository
	Appointments     AppointmentRepository
	Consents         ConsentRepository
	ConsentTemplates ConsentTemplateRepository
	Users            AuthRepository
	Odontograms      OdontogramRepository
	TreatmentPlans   TreatmentPlanRepository
}

// NewDynamoDBRepositories creates new DynamoDB repositories with table auto-creation
func NewDynamoDBRepositories(ctx context.Context, cfg DynamoDBConfig) (*DynamoDBRepositories, error) {
	// Configure AWS SDK
	var awsConfig aws.Config
	var err error

	if cfg.UseLocalProfile {
		// Load local profile for development
		if cfg.ProfileName != "" {
			awsConfig, err = config.LoadDefaultConfig(ctx,
				config.WithSharedConfigProfile(cfg.ProfileName),
			)
		} else {
			awsConfig, err = config.LoadDefaultConfig(ctx)
		}
	} else {
		// Use default config (works with Lambda execution role)
		awsConfig, err = config.LoadDefaultConfig(ctx)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	client := dynamodb.NewFromConfig(awsConfig)

	repos := &DynamoDBRepositories{
		client: client,
		config: cfg,
	}

	// Create tables if they don't exist
	if err := repos.ensureTablesExist(ctx); err != nil {
		log.Printf("Warning: Could not ensure tables exist: %v", err)
	}

	// Initialize all tables
	tables := []struct {
		name string
		repo interface{}
	}{
		{cfg.PatientTableName, &dynamoPatientRepo{client: client, tableName: cfg.PatientTableName}},
		{cfg.AppointmentTableName, &dynamoAppointmentRepo{client: client, tableName: cfg.AppointmentTableName}},
		{cfg.ConsentTableName, &dynamoConsentRepo{client: client, tableName: cfg.ConsentTableName}},
		{cfg.ConsentTemplateTableName, &dynamoConsentTemplateRepo{client: client, tableName: cfg.ConsentTemplateTableName}},
		{cfg.UserTableName, &dynamoAuthRepo{client: client, tableName: cfg.UserTableName}},
		{cfg.OdontogramTableName, &dynamoOdontogramRepo{client: client, tableName: cfg.OdontogramTableName}},
		{cfg.TreatmentPlanTableName, &dynamoTreatmentPlanRepo{client: client, tableName: cfg.TreatmentPlanTableName}},
	}

	for _, table := range tables {
		if err := createTableIfNotExists(ctx, client, table.name); err != nil {
			return nil, fmt.Errorf("failed to create table %s: %w", table.name, err)
		}
	}

	return &DynamoDBRepositories{
		client:           client,
		config:           cfg,
		Patients:         &dynamoPatientRepo{client: client, tableName: cfg.PatientTableName},
		Appointments:     &dynamoAppointmentRepo{client: client, tableName: cfg.AppointmentTableName},
		Consents:         &dynamoConsentRepo{client: client, tableName: cfg.ConsentTableName},
		ConsentTemplates: &dynamoConsentTemplateRepo{client: client, tableName: cfg.ConsentTemplateTableName},
		Users:            &dynamoAuthRepo{client: client, tableName: cfg.UserTableName},
		Odontograms:      &dynamoOdontogramRepo{client: client, tableName: cfg.OdontogramTableName},
		TreatmentPlans:   &dynamoTreatmentPlanRepo{client: client, tableName: cfg.TreatmentPlanTableName},
	}, nil
}

func createTableIfNotExists(ctx context.Context, client *dynamodb.Client, tableName string) error {
	_, err := client.DescribeTable(ctx, &dynamodb.DescribeTableInput{
		TableName: aws.String(tableName),
	})

	if err != nil {
		if strings.Contains(err.Error(), "ResourceNotFoundException") ||
			strings.Contains(err.Error(), "Requested resource not found") {
			// Create table
			_, err := client.CreateTable(ctx, &dynamodb.CreateTableInput{
				TableName: aws.String(tableName),
				KeySchema: []types.KeySchemaElement{
					{
						AttributeName: aws.String("PK"),
						KeyType:       types.KeyTypeHash,
					},
					{
						AttributeName: aws.String("SK"),
						KeyType:       types.KeyTypeRange,
					},
				},
				AttributeDefinitions: []types.AttributeDefinition{
					{
						AttributeName: aws.String("PK"),
						AttributeType: types.ScalarAttributeTypeS,
					},
					{
						AttributeName: aws.String("SK"),
						AttributeType: types.ScalarAttributeTypeS,
					},
				},
				BillingMode: types.BillingModePayPerRequest,
				Tags: []types.Tag{
					{
						Key:   aws.String("Environment"),
						Value: aws.String("clinical-backend"),
					},
				},
			})
			return err
		}
		return err
	}

	return nil
}

// ensureTablesExist creates DynamoDB tables if they don't exist
func (r *DynamoDBRepositories) ensureTablesExist(ctx context.Context) error {
	tables := []struct {
		name   string
		create func(ctx context.Context, tableName string) error
	}{
		{r.config.PatientTableName, r.createPatientTable},
		{r.config.AppointmentTableName, r.createAppointmentTable},
		{r.config.ConsentTableName, r.createConsentTable},
		{r.config.OdontogramTableName, r.createOdontogramTable},
		{r.config.TreatmentPlanTableName, r.createTreatmentPlanTable},
	}

	for _, table := range tables {
		exists, err := r.tableExists(ctx, table.name)
		if err != nil {
			log.Printf("Error checking table %s: %v", table.name, err)
			continue
		}

		if !exists {
			log.Printf("Creating table: %s", table.name)
			if err := table.create(ctx, table.name); err != nil {
				log.Printf("Error creating table %s: %v", table.name, err)
				continue
			}
			log.Printf("Table created successfully: %s", table.name)
		} else {
			log.Printf("Table already exists: %s", table.name)
		}
	}

	return nil
}

func (r *DynamoDBRepositories) tableExists(ctx context.Context, tableName string) (bool, error) {
	_, err := r.client.DescribeTable(ctx, &dynamodb.DescribeTableInput{
		TableName: aws.String(tableName),
	})

	if err != nil {
		if strings.Contains(err.Error(), "ResourceNotFoundException") ||
			strings.Contains(err.Error(), "Requested resource not found") {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

// Create table methods for odontogram and treatment plans
func (r *DynamoDBRepositories) createOdontogramTable(ctx context.Context, tableName string) error {
	return r.createGenericTable(ctx, tableName)
}

func (r *DynamoDBRepositories) createTreatmentPlanTable(ctx context.Context, tableName string) error {
	return r.createGenericTable(ctx, tableName)
}

func (r *DynamoDBRepositories) createGenericTable(ctx context.Context, tableName string) error {
	_, err := r.client.CreateTable(ctx, &dynamodb.CreateTableInput{
		TableName: aws.String(tableName),
		KeySchema: []types.KeySchemaElement{
			{
				AttributeName: aws.String("PK"),
				KeyType:       types.KeyTypeHash,
			},
			{
				AttributeName: aws.String("SK"),
				KeyType:       types.KeyTypeRange,
			},
		},
		AttributeDefinitions: []types.AttributeDefinition{
			{
				AttributeName: aws.String("PK"),
				AttributeType: types.ScalarAttributeTypeS,
			},
			{
				AttributeName: aws.String("SK"),
				AttributeType: types.ScalarAttributeTypeS,
			},
		},
		BillingMode: types.BillingModePayPerRequest,
		Tags: []types.Tag{
			{
				Key:   aws.String("Environment"),
				Value: aws.String("clinical-backend"),
			},
			{
				Key:   aws.String("Service"),
				Value: aws.String("odontogram"),
			},
		},
	})
	return err
}

func (r *DynamoDBRepositories) createPatientTable(ctx context.Context, tableName string) error {
	_, err := r.client.CreateTable(ctx, &dynamodb.CreateTableInput{
		TableName: aws.String(tableName),
		KeySchema: []types.KeySchemaElement{
			{
				AttributeName: aws.String("PK"),
				KeyType:       types.KeyTypeHash,
			},
			{
				AttributeName: aws.String("SK"),
				KeyType:       types.KeyTypeRange,
			},
		},
		AttributeDefinitions: []types.AttributeDefinition{
			{
				AttributeName: aws.String("PK"),
				AttributeType: types.ScalarAttributeTypeS,
			},
			{
				AttributeName: aws.String("SK"),
				AttributeType: types.ScalarAttributeTypeS,
			},
		},
		BillingMode: types.BillingModePayPerRequest,
		Tags: []types.Tag{
			{
				Key:   aws.String("Environment"),
				Value: aws.String("clinical-backend"),
			},
		},
	})

	return err
}

func (r *DynamoDBRepositories) createAppointmentTable(ctx context.Context, tableName string) error {
	_, err := r.client.CreateTable(ctx, &dynamodb.CreateTableInput{
		TableName: aws.String(tableName),
		KeySchema: []types.KeySchemaElement{
			{
				AttributeName: aws.String("PK"),
				KeyType:       types.KeyTypeHash,
			},
			{
				AttributeName: aws.String("SK"),
				KeyType:       types.KeyTypeRange,
			},
		},
		AttributeDefinitions: []types.AttributeDefinition{
			{
				AttributeName: aws.String("PK"),
				AttributeType: types.ScalarAttributeTypeS,
			},
			{
				AttributeName: aws.String("SK"),
				AttributeType: types.ScalarAttributeTypeS,
			},
		},
		BillingMode: types.BillingModePayPerRequest,
		Tags: []types.Tag{
			{
				Key:   aws.String("Environment"),
				Value: aws.String("clinical-backend"),
			},
		},
	})

	return err
}

func (r *DynamoDBRepositories) createConsentTable(ctx context.Context, tableName string) error {
	_, err := r.client.CreateTable(ctx, &dynamodb.CreateTableInput{
		TableName: aws.String(tableName),
		KeySchema: []types.KeySchemaElement{
			{
				AttributeName: aws.String("PK"),
				KeyType:       types.KeyTypeHash,
			},
			{
				AttributeName: aws.String("SK"),
				KeyType:       types.KeyTypeRange,
			},
		},
		AttributeDefinitions: []types.AttributeDefinition{
			{
				AttributeName: aws.String("PK"),
				AttributeType: types.ScalarAttributeTypeS,
			},
			{
				AttributeName: aws.String("SK"),
				AttributeType: types.ScalarAttributeTypeS,
			},
		},
		BillingMode: types.BillingModePayPerRequest,
		Tags: []types.Tag{
			{
				Key:   aws.String("Environment"),
				Value: aws.String("clinical-backend"),
			},
		},
	})

	return err
}

// Patient repository implementation
type dynamoPatientRepo struct {
	client    *dynamodb.Client
	tableName string
}

func orgIDOrDefault(ctx context.Context) string {
	orgID := OrgIDFromContext(ctx)
	if strings.TrimSpace(orgID) == "" {
		return "default"
	}
	return orgID
}

func (r *dynamoPatientRepo) Create(ctx context.Context, patient domain.Patient) (domain.Patient, error) {
	orgID := orgIDOrDefault(ctx)
	item := map[string]types.AttributeValue{
		"PK":         &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
		"SK":         &types.AttributeValueMemberS{Value: fmt.Sprintf("PATIENT#%s", patient.ID)},
		"ID":         &types.AttributeValueMemberS{Value: patient.ID},
		"DoctorID":   &types.AttributeValueMemberS{Value: patient.DoctorID},
		"Specialty":  &types.AttributeValueMemberS{Value: string(patient.Specialty)},
		"FirstName":  &types.AttributeValueMemberS{Value: patient.FirstName},
		"LastName":   &types.AttributeValueMemberS{Value: patient.LastName},
		"DocumentID": &types.AttributeValueMemberS{Value: patient.DocumentID},
		"Phone":      &types.AttributeValueMemberS{Value: patient.Phone},
		"Email":      &types.AttributeValueMemberS{Value: patient.Email},
		"BirthDate":  &types.AttributeValueMemberS{Value: patient.BirthDate},
		"CreatedAt":  &types.AttributeValueMemberS{Value: patient.CreatedAt.Format(time.RFC3339)},
	}

	// Handle optional fields
	if len(patient.MedicalBackgrounds) > 0 {
		backgrounds, _ := attributevalue.Marshal(patient.MedicalBackgrounds)
		item["MedicalBackgrounds"] = backgrounds
	}

	if len(patient.ImageKeys) > 0 {
		imageKeys, _ := attributevalue.Marshal(patient.ImageKeys)
		item["ImageKeys"] = imageKeys
	}

	_, err := r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      item,
	})

	return patient, err
}

func (r *dynamoPatientRepo) GetByID(ctx context.Context, id string) (domain.Patient, error) {
	orgID := orgIDOrDefault(ctx)
	result, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("PATIENT#%s", id)},
		},
	})

	if err != nil {
		return domain.Patient{}, err
	}

	if result.Item == nil {
		return domain.Patient{}, fmt.Errorf("patient not found")
	}

	var patient domain.Patient
	err = attributevalue.UnmarshalMap(result.Item, &patient)
	if err != nil {
		return domain.Patient{}, err
	}

	return patient, nil
}

func (r *dynamoPatientRepo) ListByDoctor(ctx context.Context, doctorID string) ([]domain.Patient, error) {
	orgID := orgIDOrDefault(ctx)
	input := &dynamodb.ScanInput{
		TableName:        aws.String(r.tableName),
		FilterExpression: aws.String("PK = :pk AND begins_with(SK, :sk)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
			":sk": &types.AttributeValueMemberS{Value: "PATIENT#"},
		},
	}

	result, err := r.client.Scan(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("scan patients: %w", err)
	}

	var patients []domain.Patient
	for _, item := range result.Items {
		var p domain.Patient
		if err := attributevalue.UnmarshalMap(item, &p); err != nil {
			continue
		}
		if doctorID != "" && p.DoctorID != doctorID {
			continue
		}
		patients = append(patients, p)
	}
	return patients, nil
}

func (r *dynamoPatientRepo) ListAll(ctx context.Context) ([]domain.Patient, error) {
	input := &dynamodb.ScanInput{
		TableName:        aws.String(r.tableName),
		FilterExpression: aws.String("begins_with(SK, :sk)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":sk": &types.AttributeValueMemberS{Value: "PATIENT#"},
		},
	}
	result, err := r.client.Scan(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("scan all patients: %w", err)
	}
	var patients []domain.Patient
	for _, item := range result.Items {
		var p domain.Patient
		if err := attributevalue.UnmarshalMap(item, &p); err != nil {
			continue
		}
		patients = append(patients, p)
	}
	return patients, nil
}

func (r *dynamoPatientRepo) SearchByQuery(ctx context.Context, doctorID, query string) ([]domain.Patient, error) {
	orgID := orgIDOrDefault(ctx)
	q := strings.ToLower(strings.TrimSpace(query))

	input := &dynamodb.ScanInput{
		TableName:        aws.String(r.tableName),
		FilterExpression: aws.String("PK = :pk AND begins_with(SK, :sk)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
			":sk": &types.AttributeValueMemberS{Value: "PATIENT#"},
		},
	}

	result, err := r.client.Scan(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("scan patients: %w", err)
	}

	var patients []domain.Patient
	for _, item := range result.Items {
		var p domain.Patient
		if err := attributevalue.UnmarshalMap(item, &p); err != nil {
			continue
		}
		if doctorID != "" && p.DoctorID != doctorID {
			continue
		}
		if q == "" ||
			strings.Contains(strings.ToLower(p.FirstName), q) ||
			strings.Contains(strings.ToLower(p.LastName), q) ||
			strings.Contains(strings.ToLower(p.FirstName+" "+p.LastName), q) ||
			strings.Contains(strings.ToLower(p.DocumentID), q) ||
			strings.Contains(strings.ToLower(p.Email), q) ||
			strings.Contains(strings.ReplaceAll(p.Phone, " ", ""), strings.ReplaceAll(q, " ", "")) {
			patients = append(patients, p)
		}
	}
	return patients, nil
}

func (r *dynamoPatientRepo) Update(ctx context.Context, patient domain.Patient) (domain.Patient, error) {
	// PutItem will overwrite the existing item, which is what we want for an update.
	return r.Create(ctx, patient)
}

func (r *dynamoPatientRepo) Delete(ctx context.Context, id string) error {
	orgID := orgIDOrDefault(ctx)
	_, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("PATIENT#%s", id)},
		},
	})
	return err
}

// Appointment repository implementation
type dynamoAppointmentRepo struct {
	client    *dynamodb.Client
	tableName string
}

func (r *dynamoAppointmentRepo) Create(ctx context.Context, appointment domain.Appointment) (domain.Appointment, error) {
	orgID := strings.TrimSpace(appointment.OrgID)
	if orgID == "" {
		orgID = orgIDOrDefault(ctx)
	}
	item := map[string]types.AttributeValue{
		"PK":              &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
		"SK":              &types.AttributeValueMemberS{Value: fmt.Sprintf("APPOINTMENT#%s", appointment.ID)},
		"ID":              &types.AttributeValueMemberS{Value: appointment.ID},
		"DoctorID":        &types.AttributeValueMemberS{Value: appointment.DoctorID},
		"PatientID":       &types.AttributeValueMemberS{Value: appointment.PatientID},
		"StartAt":         &types.AttributeValueMemberS{Value: appointment.StartAt.Format(time.RFC3339)},
		"EndAt":           &types.AttributeValueMemberS{Value: appointment.EndAt.Format(time.RFC3339)},
		"DurationMinutes": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", appointment.DurationMinutes)},
		"Status":          &types.AttributeValueMemberS{Value: appointment.Status},
		"EvolutionNotes":  &types.AttributeValueMemberS{Value: appointment.EvolutionNotes},
		"TreatmentPlan":   &types.AttributeValueMemberS{Value: appointment.TreatmentPlan},
		"PaymentAmount":   &types.AttributeValueMemberN{Value: fmt.Sprintf("%.2f", appointment.PaymentAmount)},
		"PaymentMethod":   &types.AttributeValueMemberS{Value: appointment.PaymentMethod},
		"PaymentPaid":     &types.AttributeValueMemberBOOL{Value: appointment.PaymentPaid},
		"ConfirmToken":    &types.AttributeValueMemberS{Value: appointment.ConfirmToken},
	}

	// Handle optional time fields
	if appointment.ReminderSentAt != nil {
		item["ReminderSentAt"] = &types.AttributeValueMemberS{Value: appointment.ReminderSentAt.Format(time.RFC3339)}
	}
	if appointment.PatientConfirmedAt != nil {
		item["PatientConfirmedAt"] = &types.AttributeValueMemberS{Value: appointment.PatientConfirmedAt.Format(time.RFC3339)}
	}
	if appointment.DoctorDailyClosedAt != nil {
		item["DoctorDailyClosedAt"] = &types.AttributeValueMemberS{Value: appointment.DoctorDailyClosedAt.Format(time.RFC3339)}
	}
	if len(appointment.ImageKeys) > 0 {
		vals := make([]types.AttributeValue, len(appointment.ImageKeys))
		for i, k := range appointment.ImageKeys {
			vals[i] = &types.AttributeValueMemberS{Value: k}
		}
		item["ImageKeys"] = &types.AttributeValueMemberL{Value: vals}
	}

	_, err := r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      item,
	})

	return appointment, err
}

func (r *dynamoAppointmentRepo) GetByID(ctx context.Context, id string) (domain.Appointment, error) {
	orgID := orgIDOrDefault(ctx)
	result, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("APPOINTMENT#%s", id)},
		},
	})

	if err != nil {
		return domain.Appointment{}, err
	}

	if result.Item == nil {
		return domain.Appointment{}, fmt.Errorf("appointment not found")
	}

	var appointment domain.Appointment
	err = attributevalue.UnmarshalMap(result.Item, &appointment)
	if err != nil {
		return domain.Appointment{}, err
	}

	return appointment, nil
}

func (r *dynamoAppointmentRepo) GetByConfirmToken(ctx context.Context, token string) (domain.Appointment, error) {
	result, err := r.client.Scan(ctx, &dynamodb.ScanInput{
		TableName:        aws.String(r.tableName),
		FilterExpression: aws.String("ConfirmToken = :token"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":token": &types.AttributeValueMemberS{Value: token},
		},
	})
	if err != nil {
		return domain.Appointment{}, err
	}
	if len(result.Items) == 0 {
		return domain.Appointment{}, fmt.Errorf("appointment not found")
	}
	item := result.Items[0]
	var appt domain.Appointment
	if err := attributevalue.UnmarshalMap(item, &appt); err != nil {
		return domain.Appointment{}, err
	}
	if pk, ok := item["PK"].(*types.AttributeValueMemberS); ok && pk.Value != "" {
		appt.OrgID = strings.TrimPrefix(pk.Value, "ORG#")
	}
	return appt, nil
}

func (r *dynamoAppointmentRepo) ListByDoctorAndDay(ctx context.Context, doctorID string, day time.Time) ([]domain.Appointment, error) {
	orgID := orgIDOrDefault(ctx)
	dayStr := day.Format("2006-01-02")

	var scanInput *dynamodb.ScanInput
	if doctorID == "" {
		// Admin/assistant: return all appointments of the org for that day
		scanInput = &dynamodb.ScanInput{
			TableName:        aws.String(r.tableName),
			FilterExpression: aws.String("PK = :pk AND begins_with(SK, :skPrefix) AND begins_with(StartAt, :dayStr)"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":pk":       &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
				":skPrefix": &types.AttributeValueMemberS{Value: "APPOINTMENT#"},
				":dayStr":   &types.AttributeValueMemberS{Value: dayStr},
			},
		}
	} else {
		// Doctor: filter by their own doctorID
		scanInput = &dynamodb.ScanInput{
			TableName:        aws.String(r.tableName),
			FilterExpression: aws.String("PK = :pk AND DoctorID = :doctorID AND begins_with(StartAt, :dayStr)"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":pk":       &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
				":doctorID": &types.AttributeValueMemberS{Value: doctorID},
				":dayStr":   &types.AttributeValueMemberS{Value: dayStr},
			},
		}
	}

	result, err := r.client.Scan(ctx, scanInput)

	if err != nil {
		return nil, err
	}

	var appointments []domain.Appointment
	for _, item := range result.Items {
		var appointment domain.Appointment
		if err := attributevalue.UnmarshalMap(item, &appointment); err != nil {
			continue // Skip malformed items
		}
		appointments = append(appointments, appointment)
	}

	return appointments, nil
}

func (r *dynamoAppointmentRepo) ListByPatient(ctx context.Context, patientID string) ([]domain.Appointment, error) {
	orgID := orgIDOrDefault(ctx)
	result, err := r.client.Scan(ctx, &dynamodb.ScanInput{
		TableName:        aws.String(r.tableName),
		FilterExpression: aws.String("PK = :pk AND PatientID = :patientID AND begins_with(SK, :skPrefix)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk":        &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
			":patientID": &types.AttributeValueMemberS{Value: patientID},
			":skPrefix":  &types.AttributeValueMemberS{Value: "APPOINTMENT#"},
		},
	})
	if err != nil {
		return nil, err
	}
	var appointments []domain.Appointment
	for _, item := range result.Items {
		var a domain.Appointment
		if err := attributevalue.UnmarshalMap(item, &a); err != nil {
			continue
		}
		appointments = append(appointments, a)
	}
	return appointments, nil
}

func (r *dynamoAppointmentRepo) Update(ctx context.Context, appointment domain.Appointment) (domain.Appointment, error) {
	return r.Create(ctx, appointment)
}

func (r *dynamoAppointmentRepo) ScanAllPayments(ctx context.Context) ([]PaymentSummary, error) {
	result, err := r.client.Scan(ctx, &dynamodb.ScanInput{
		TableName:                aws.String(r.tableName),
		FilterExpression:         aws.String("begins_with(SK, :skPrefix) AND #st = :completed"),
		ExpressionAttributeNames: map[string]string{"#st": "Status"},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":skPrefix":  &types.AttributeValueMemberS{Value: "APPOINTMENT#"},
			":completed": &types.AttributeValueMemberS{Value: "completed"},
		},
		ProjectionExpression: aws.String("PK, #st, PaymentAmount"),
	})
	if err != nil {
		return nil, err
	}
	summaries := make([]PaymentSummary, 0, len(result.Items))
	for _, item := range result.Items {
		var s PaymentSummary
		if pk, ok := item["PK"].(*types.AttributeValueMemberS); ok {
			s.OrgID = strings.TrimPrefix(pk.Value, "ORG#")
		}
		if st, ok := item["Status"].(*types.AttributeValueMemberS); ok {
			s.Status = st.Value
		}
		if pa, ok := item["PaymentAmount"].(*types.AttributeValueMemberN); ok {
			fmt.Sscanf(pa.Value, "%f", &s.PaymentAmount)
		}
		summaries = append(summaries, s)
	}
	return summaries, nil
}

func (r *dynamoAppointmentRepo) ScanOrgPayments(ctx context.Context, orgID string) ([]PaymentSummary, error) {
	result, err := r.client.Scan(ctx, &dynamodb.ScanInput{
		TableName:                aws.String(r.tableName),
		FilterExpression:         aws.String("PK = :pk AND begins_with(SK, :skPrefix)"),
		ExpressionAttributeNames: map[string]string{"#st": "Status"},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk":       &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
			":skPrefix": &types.AttributeValueMemberS{Value: "APPOINTMENT#"},
		},
		ProjectionExpression: aws.String("PK, #st, PaymentAmount"),
	})
	if err != nil {
		return nil, err
	}
	summaries := make([]PaymentSummary, 0, len(result.Items))
	for _, item := range result.Items {
		var s PaymentSummary
		s.OrgID = orgID
		if st, ok := item["Status"].(*types.AttributeValueMemberS); ok {
			s.Status = st.Value
		}
		if pa, ok := item["PaymentAmount"].(*types.AttributeValueMemberN); ok {
			fmt.Sscanf(pa.Value, "%f", &s.PaymentAmount)
		}
		summaries = append(summaries, s)
	}
	return summaries, nil
}

func (r *dynamoAppointmentRepo) Delete(ctx context.Context, id string) error {
	orgID := orgIDOrDefault(ctx)
	_, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("APPOINTMENT#%s", id)},
		},
	})
	return err
}

// Consent repository implementation
type dynamoConsentRepo struct {
	client    *dynamodb.Client
	tableName string
}

func (r *dynamoConsentRepo) Create(ctx context.Context, consent domain.Consent) (domain.Consent, error) {
	orgID := orgIDOrDefault(ctx)
	item := map[string]types.AttributeValue{
		"PK":             &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
		"SK":             &types.AttributeValueMemberS{Value: fmt.Sprintf("CONSENT#%s", consent.ID)},
		"ID":             &types.AttributeValueMemberS{Value: consent.ID},
		"PatientID":      &types.AttributeValueMemberS{Value: consent.PatientID},
		"DoctorID":       &types.AttributeValueMemberS{Value: consent.DoctorID},
		"AppointmentID":  &types.AttributeValueMemberS{Value: consent.AppointmentID},
		"TemplateID":     &types.AttributeValueMemberS{Value: consent.TemplateID},
		"Title":          &types.AttributeValueMemberS{Value: consent.Title},
		"Content":        &types.AttributeValueMemberS{Value: consent.Content},
		"DeliveryMethod": &types.AttributeValueMemberS{Value: consent.DeliveryMethod},
		"Status":         &types.AttributeValueMemberS{Value: consent.Status},
		"AcceptToken":    &types.AttributeValueMemberS{Value: consent.AcceptToken},
		"CreatedAt":      &types.AttributeValueMemberS{Value: consent.CreatedAt.Format(time.RFC3339)},
	}

	if consent.AcceptedAt != nil {
		item["AcceptedAt"] = &types.AttributeValueMemberS{Value: consent.AcceptedAt.Format(time.RFC3339)}
	}

	_, err := r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      item,
	})

	return consent, err
}

func (r *dynamoConsentRepo) Update(ctx context.Context, consent domain.Consent) (domain.Consent, error) {
	_, err := r.GetByID(ctx, consent.ID)
	if err != nil {
		return domain.Consent{}, err
	}
	return r.Create(ctx, consent)
}

func (r *dynamoConsentRepo) GetByID(ctx context.Context, id string) (domain.Consent, error) {
	orgID := orgIDOrDefault(ctx)
	result, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("CONSENT#%s", id)},
		},
	})
	if err != nil {
		return domain.Consent{}, err
	}
	if result.Item == nil {
		return domain.Consent{}, fmt.Errorf("consent not found")
	}
	var consent domain.Consent
	err = attributevalue.UnmarshalMap(result.Item, &consent)
	return consent, err
}

func (r *dynamoConsentRepo) GetByToken(ctx context.Context, token string) (domain.Consent, error) {
	orgID := OrgIDFromContext(ctx)
	// Enlace público (aceptar consentimiento desde el correo): no hay org en contexto.
	// Buscar solo por token en toda la tabla para que el link funcione.
	if strings.TrimSpace(orgID) == "" || orgID == "default" {
		result, err := r.client.Scan(ctx, &dynamodb.ScanInput{
			TableName:        aws.String(r.tableName),
			FilterExpression: aws.String("begins_with(SK, :skPrefix) AND AcceptToken = :token"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":skPrefix": &types.AttributeValueMemberS{Value: "CONSENT#"},
				":token":    &types.AttributeValueMemberS{Value: token},
			},
		})
		if err != nil {
			return domain.Consent{}, err
		}
		if len(result.Items) == 0 {
			return domain.Consent{}, fmt.Errorf("consent not found")
		}
		var consent domain.Consent
		err = attributevalue.UnmarshalMap(result.Items[0], &consent)
		return consent, err
	}
	result, err := r.client.Scan(ctx, &dynamodb.ScanInput{
		TableName:        aws.String(r.tableName),
		FilterExpression: aws.String("PK = :pk AND begins_with(SK, :skPrefix) AND AcceptToken = :token"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk":       &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
			":skPrefix": &types.AttributeValueMemberS{Value: "CONSENT#"},
			":token":    &types.AttributeValueMemberS{Value: token},
		},
	})
	if err != nil {
		return domain.Consent{}, err
	}
	if len(result.Items) == 0 {
		return domain.Consent{}, fmt.Errorf("consent not found")
	}
	var consent domain.Consent
	err = attributevalue.UnmarshalMap(result.Items[0], &consent)
	return consent, err
}

func (r *dynamoConsentRepo) GetByAppointmentID(ctx context.Context, appointmentID string) (domain.Consent, error) {
	orgID := orgIDOrDefault(ctx)
	result, err := r.client.Scan(ctx, &dynamodb.ScanInput{
		TableName:        aws.String(r.tableName),
		FilterExpression: aws.String("PK = :pk AND begins_with(SK, :skPrefix) AND AppointmentID = :apptID"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk":       &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
			":skPrefix": &types.AttributeValueMemberS{Value: "CONSENT#"},
			":apptID":   &types.AttributeValueMemberS{Value: appointmentID},
		},
	})
	if err != nil {
		return domain.Consent{}, err
	}
	if len(result.Items) == 0 {
		return domain.Consent{}, fmt.Errorf("consent not found")
	}
	var consent domain.Consent
	err = attributevalue.UnmarshalMap(result.Items[0], &consent)
	return consent, err
}

func (r *dynamoConsentRepo) ListByAppointmentID(ctx context.Context, appointmentID string) ([]domain.Consent, error) {
	orgID := orgIDOrDefault(ctx)
	result, err := r.client.Scan(ctx, &dynamodb.ScanInput{
		TableName:        aws.String(r.tableName),
		FilterExpression: aws.String("PK = :pk AND begins_with(SK, :skPrefix) AND AppointmentID = :apptID"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk":       &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
			":skPrefix": &types.AttributeValueMemberS{Value: "CONSENT#"},
			":apptID":   &types.AttributeValueMemberS{Value: appointmentID},
		},
	})
	if err != nil {
		return nil, err
	}
	var out []domain.Consent
	for _, item := range result.Items {
		var c domain.Consent
		if err := attributevalue.UnmarshalMap(item, &c); err == nil {
			out = append(out, c)
		}
	}
	return out, nil
}

// ConsentTemplate DynamoDB repository
type dynamoConsentTemplateRepo struct {
	client    *dynamodb.Client
	tableName string
}

func (r *dynamoConsentTemplateRepo) Create(ctx context.Context, t domain.ConsentTemplate) (domain.ConsentTemplate, error) {
	item := map[string]types.AttributeValue{
		"PK":        &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", t.OrgID)},
		"SK":        &types.AttributeValueMemberS{Value: fmt.Sprintf("CONSENT_TEMPLATE#%s", t.ID)},
		"ID":        &types.AttributeValueMemberS{Value: t.ID},
		"OrgID":     &types.AttributeValueMemberS{Value: t.OrgID},
		"Title":     &types.AttributeValueMemberS{Value: t.Title},
		"Content":   &types.AttributeValueMemberS{Value: t.Content},
		"IsActive":  &types.AttributeValueMemberBOOL{Value: t.IsActive},
		"CreatedBy": &types.AttributeValueMemberS{Value: t.CreatedBy},
		"CreatedAt": &types.AttributeValueMemberS{Value: t.CreatedAt.Format(time.RFC3339)},
		"UpdatedAt": &types.AttributeValueMemberS{Value: t.UpdatedAt.Format(time.RFC3339)},
	}
	_, err := r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      item,
	})
	return t, err
}

func (r *dynamoConsentTemplateRepo) Update(ctx context.Context, t domain.ConsentTemplate) (domain.ConsentTemplate, error) {
	t.UpdatedAt = time.Now().UTC()
	return r.Create(ctx, t)
}

func (r *dynamoConsentTemplateRepo) GetByID(ctx context.Context, id string) (domain.ConsentTemplate, error) {
	result, err := r.client.Scan(ctx, &dynamodb.ScanInput{
		TableName:        aws.String(r.tableName),
		FilterExpression: aws.String("ID = :id AND begins_with(SK, :skPrefix)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":id":       &types.AttributeValueMemberS{Value: id},
			":skPrefix": &types.AttributeValueMemberS{Value: "CONSENT_TEMPLATE#"},
		},
	})
	if err != nil {
		return domain.ConsentTemplate{}, err
	}
	if len(result.Items) == 0 {
		return domain.ConsentTemplate{}, fmt.Errorf("consent template not found")
	}
	var t domain.ConsentTemplate
	err = attributevalue.UnmarshalMap(result.Items[0], &t)
	return t, err
}

func (r *dynamoConsentTemplateRepo) ListByOrg(ctx context.Context, orgID string) ([]domain.ConsentTemplate, error) {
	result, err := r.client.Scan(ctx, &dynamodb.ScanInput{
		TableName:        aws.String(r.tableName),
		FilterExpression: aws.String("PK = :pk AND begins_with(SK, :skPrefix)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk":       &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
			":skPrefix": &types.AttributeValueMemberS{Value: "CONSENT_TEMPLATE#"},
		},
	})
	if err != nil {
		return nil, err
	}
	var out []domain.ConsentTemplate
	for _, item := range result.Items {
		var t domain.ConsentTemplate
		if err := attributevalue.UnmarshalMap(item, &t); err == nil {
			out = append(out, t)
		}
	}
	return out, nil
}

func (r *dynamoConsentTemplateRepo) GetActiveByOrg(ctx context.Context, orgID string) (domain.ConsentTemplate, error) {
	result, err := r.client.Scan(ctx, &dynamodb.ScanInput{
		TableName:        aws.String(r.tableName),
		FilterExpression: aws.String("PK = :pk AND begins_with(SK, :skPrefix) AND IsActive = :active"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk":       &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
			":skPrefix": &types.AttributeValueMemberS{Value: "CONSENT_TEMPLATE#"},
			":active":   &types.AttributeValueMemberBOOL{Value: true},
		},
	})
	if err != nil {
		return domain.ConsentTemplate{}, err
	}
	if len(result.Items) == 0 {
		return domain.ConsentTemplate{}, fmt.Errorf("no active consent template found")
	}
	var t domain.ConsentTemplate
	err = attributevalue.UnmarshalMap(result.Items[0], &t)
	return t, err
}

func (r *dynamoConsentTemplateRepo) ListActiveByOrg(ctx context.Context, orgID string) ([]domain.ConsentTemplate, error) {
	result, err := r.client.Scan(ctx, &dynamodb.ScanInput{
		TableName:        aws.String(r.tableName),
		FilterExpression: aws.String("PK = :pk AND begins_with(SK, :skPrefix) AND IsActive = :active"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk":       &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
			":skPrefix": &types.AttributeValueMemberS{Value: "CONSENT_TEMPLATE#"},
			":active":   &types.AttributeValueMemberBOOL{Value: true},
		},
	})
	if err != nil {
		return nil, err
	}
	var out []domain.ConsentTemplate
	for _, item := range result.Items {
		var t domain.ConsentTemplate
		if err := attributevalue.UnmarshalMap(item, &t); err == nil {
			out = append(out, t)
		}
	}
	return out, nil
}

// Auth repository implementation
type dynamoAuthRepo struct {
	client    *dynamodb.Client
	tableName string
}

func (r *dynamoAuthRepo) CreateUser(ctx context.Context, user AuthUser) (AuthUser, error) {
	// Check if email already exists
	if _, err := r.GetUserByEmail(ctx, user.Email); err == nil {
		return AuthUser{}, fmt.Errorf("email already exists")
	}
	if user.Role == "" {
		user.Role = "admin"
	}
	if user.Status == "" {
		user.Status = "active"
	}

	item := map[string]types.AttributeValue{
		"PK":                 &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", user.ID)},
		"SK":                 &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", user.ID)},
		"ID":                 &types.AttributeValueMemberS{Value: user.ID},
		"OrgID":              &types.AttributeValueMemberS{Value: user.OrgID},
		"Name":               &types.AttributeValueMemberS{Value: user.Name},
		"Email":              &types.AttributeValueMemberS{Value: strings.ToLower(strings.TrimSpace(user.Email))},
		"Phone":              &types.AttributeValueMemberS{Value: user.Phone},
		"Address":            &types.AttributeValueMemberS{Value: user.Address},
		"Role":               &types.AttributeValueMemberS{Value: user.Role},
		"Status":             &types.AttributeValueMemberS{Value: user.Status},
		"PasswordHash":       &types.AttributeValueMemberS{Value: user.PasswordHash},
		"MustChangePassword": &types.AttributeValueMemberBOOL{Value: user.MustChangePassword},
		"CreatedAt":          &types.AttributeValueMemberS{Value: user.CreatedAt.Format(time.RFC3339)},
	}

	// Also create email index entry
	emailItem := map[string]types.AttributeValue{
		"PK":     &types.AttributeValueMemberS{Value: fmt.Sprintf("EMAIL#%s", strings.ToLower(strings.TrimSpace(user.Email)))},
		"SK":     &types.AttributeValueMemberS{Value: "USER"},
		"UserID": &types.AttributeValueMemberS{Value: user.ID},
	}

	// Also create org index entry (for listing users by org)
	orgItem := map[string]types.AttributeValue{
		"PK":        &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", user.OrgID)},
		"SK":        &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", user.ID)},
		"ID":        &types.AttributeValueMemberS{Value: user.ID},
		"OrgID":     &types.AttributeValueMemberS{Value: user.OrgID},
		"Name":      &types.AttributeValueMemberS{Value: user.Name},
		"Email":     &types.AttributeValueMemberS{Value: strings.ToLower(strings.TrimSpace(user.Email))},
		"Phone":     &types.AttributeValueMemberS{Value: user.Phone},
		"Address":   &types.AttributeValueMemberS{Value: user.Address},
		"Role":      &types.AttributeValueMemberS{Value: user.Role},
		"Status":    &types.AttributeValueMemberS{Value: user.Status},
		"CreatedAt": &types.AttributeValueMemberS{Value: user.CreatedAt.Format(time.RFC3339)},
	}

	// Build transaction items - always write user + email index
	transactItems := []types.TransactWriteItem{
		{
			Put: &types.Put{
				TableName:           aws.String(r.tableName),
				Item:                item,
				ConditionExpression: aws.String("attribute_not_exists(PK)"),
			},
		},
		{
			Put: &types.Put{
				TableName:           aws.String(r.tableName),
				Item:                emailItem,
				ConditionExpression: aws.String("attribute_not_exists(PK)"),
			},
		},
	}
	// Only write org index entry when user has an org
	if strings.TrimSpace(user.OrgID) != "" {
		transactItems = append(transactItems, types.TransactWriteItem{
			Put: &types.Put{
				TableName: aws.String(r.tableName),
				Item:      orgItem,
			},
		})
	}
	_, err := r.client.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{
		TransactItems: transactItems,
	})

	user.Email = strings.ToLower(strings.TrimSpace(user.Email))
	return user, err
}

func (r *dynamoAuthRepo) GetUserByID(ctx context.Context, userID string) (AuthUser, error) {
	userResult, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", userID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", userID)},
		},
	})
	if err != nil {
		return AuthUser{}, err
	}
	if userResult.Item == nil {
		return AuthUser{}, fmt.Errorf("user not found")
	}
	var user AuthUser
	err = attributevalue.UnmarshalMap(userResult.Item, &user)
	return user, err
}

func (r *dynamoAuthRepo) GetUserByEmail(ctx context.Context, email string) (AuthUser, error) {
	normalizedEmail := strings.ToLower(strings.TrimSpace(email))

	// First get the user ID from email index
	result, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("EMAIL#%s", normalizedEmail)},
			"SK": &types.AttributeValueMemberS{Value: "USER"},
		},
	})

	if err != nil {
		return AuthUser{}, err
	}

	if result.Item == nil {
		return AuthUser{}, fmt.Errorf("user not found")
	}

	userIDAttr := result.Item["UserID"]
	if userIDAttr == nil {
		return AuthUser{}, fmt.Errorf("invalid email index entry")
	}

	userID := userIDAttr.(*types.AttributeValueMemberS).Value

	// Now get the actual user
	userResult, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", userID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", userID)},
		},
	})

	if err != nil {
		return AuthUser{}, err
	}

	if userResult.Item == nil {
		return AuthUser{}, fmt.Errorf("user not found")
	}

	var user AuthUser
	err = attributevalue.UnmarshalMap(userResult.Item, &user)
	return user, err
}

func (r *dynamoAuthRepo) UpdateUser(ctx context.Context, user AuthUser) (AuthUser, error) {
	// For now we update only the canonical USER# item and also update the ORG index row.
	// Email change is not supported here (would require updating the EMAIL# index entry).
	if user.Role == "" {
		user.Role = "admin"
	}
	if user.Status == "" {
		user.Status = "active"
	}

	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", user.ID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", user.ID)},
		},
		UpdateExpression: aws.String("SET #Name = :name, OrgID = :orgId, #Role = :role, #Status = :status, Phone = :phone, Address = :address, MustChangePassword = :mcp"),
		ExpressionAttributeNames: map[string]string{
			"#Name":   "Name",
			"#Role":   "Role",
			"#Status": "Status",
		},
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":name":    &types.AttributeValueMemberS{Value: user.Name},
			":orgId":   &types.AttributeValueMemberS{Value: user.OrgID},
			":role":    &types.AttributeValueMemberS{Value: user.Role},
			":status":  &types.AttributeValueMemberS{Value: user.Status},
			":phone":   &types.AttributeValueMemberS{Value: user.Phone},
			":address": &types.AttributeValueMemberS{Value: user.Address},
			":mcp":     &types.AttributeValueMemberBOOL{Value: user.MustChangePassword},
		},
		ConditionExpression: aws.String("attribute_exists(PK)"),
	})
	if err != nil {
		return AuthUser{}, err
	}

	orgItem := map[string]types.AttributeValue{
		"PK":        &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", user.OrgID)},
		"SK":        &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", user.ID)},
		"ID":        &types.AttributeValueMemberS{Value: user.ID},
		"OrgID":     &types.AttributeValueMemberS{Value: user.OrgID},
		"Name":      &types.AttributeValueMemberS{Value: user.Name},
		"Email":     &types.AttributeValueMemberS{Value: strings.ToLower(strings.TrimSpace(user.Email))},
		"Phone":     &types.AttributeValueMemberS{Value: user.Phone},
		"Address":   &types.AttributeValueMemberS{Value: user.Address},
		"Role":      &types.AttributeValueMemberS{Value: user.Role},
		"Status":    &types.AttributeValueMemberS{Value: user.Status},
		"CreatedAt": &types.AttributeValueMemberS{Value: user.CreatedAt.Format(time.RFC3339)},
	}
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      orgItem,
	})
	if err != nil {
		return AuthUser{}, err
	}
	user.Email = strings.ToLower(strings.TrimSpace(user.Email))
	return user, nil
}

func (r *dynamoAuthRepo) DeleteUser(ctx context.Context, orgID, userID string) error {
	user, err := r.GetUserByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found")
	}
	_, err = r.client.TransactWriteItems(ctx, &dynamodb.TransactWriteItemsInput{
		TransactItems: []types.TransactWriteItem{
			{
				Delete: &types.Delete{
					TableName: aws.String(r.tableName),
					Key: map[string]types.AttributeValue{
						"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", userID)},
						"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", userID)},
					},
				},
			},
			{
				Delete: &types.Delete{
					TableName: aws.String(r.tableName),
					Key: map[string]types.AttributeValue{
						"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("EMAIL#%s", strings.ToLower(strings.TrimSpace(user.Email)))},
						"SK": &types.AttributeValueMemberS{Value: "USER"},
					},
				},
			},
			{
				Delete: &types.Delete{
					TableName: aws.String(r.tableName),
					Key: map[string]types.AttributeValue{
						"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
						"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", userID)},
					},
				},
			},
		},
	})
	return err
}

func (r *dynamoAuthRepo) ListUsersByOrg(ctx context.Context, orgID string) ([]AuthUser, error) {
	out, err := r.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(r.tableName),
		KeyConditionExpression: aws.String("PK = :pk AND begins_with(SK, :sk)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
			":sk": &types.AttributeValueMemberS{Value: "USER#"},
		},
	})
	if err != nil {
		return nil, err
	}
	items := make([]AuthUser, 0, len(out.Items))
	for _, it := range out.Items {
		var u AuthUser
		if uerr := attributevalue.UnmarshalMap(it, &u); uerr == nil {
			items = append(items, u)
		}
	}
	return items, nil
}

func orgToItem(org Organization) map[string]types.AttributeValue {
	if org.Status == "" {
		org.Status = "active"
	}
	if org.PaymentStatus == "" {
		org.PaymentStatus = "current"
	}
	if org.Limits.MaxDoctors == 0 {
		org.Limits.MaxDoctors = 5
	}
	if org.Limits.MaxAssistants == 0 {
		org.Limits.MaxAssistants = 2
	}
	if org.Limits.MaxPatients == 0 {
		org.Limits.MaxPatients = 20
	}
	item := map[string]types.AttributeValue{
		"PK":            &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", org.ID)},
		"SK":            &types.AttributeValueMemberS{Value: "ORG"},
		"ID":            &types.AttributeValueMemberS{Value: org.ID},
		"Name":          &types.AttributeValueMemberS{Value: org.Name},
		"BusinessName":  &types.AttributeValueMemberS{Value: org.BusinessName},
		"TaxID":         &types.AttributeValueMemberS{Value: org.TaxID},
		"Address":       &types.AttributeValueMemberS{Value: org.Address},
		"Email":         &types.AttributeValueMemberS{Value: org.Email},
		"Phone":         &types.AttributeValueMemberS{Value: org.Phone},
		"Status":        &types.AttributeValueMemberS{Value: org.Status},
		"PaymentStatus": &types.AttributeValueMemberS{Value: org.PaymentStatus},
		"MaxDoctors":    &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", org.Limits.MaxDoctors)},
		"MaxAssistants": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", org.Limits.MaxAssistants)},
		"MaxPatients":   &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", org.Limits.MaxPatients)},
		"CreatedAt":     &types.AttributeValueMemberS{Value: org.CreatedAt.Format(time.RFC3339)},
	}
	if org.Timezone != "" {
		item["Timezone"] = &types.AttributeValueMemberS{Value: org.Timezone}
	}
	if org.UpdatedAt != nil {
		item["UpdatedAt"] = &types.AttributeValueMemberS{Value: org.UpdatedAt.Format(time.RFC3339)}
	}
	return item
}

func itemToOrg(item map[string]types.AttributeValue) Organization {
	var org Organization
	if v, ok := item["ID"]; ok {
		org.ID = v.(*types.AttributeValueMemberS).Value
	}
	if v, ok := item["Name"]; ok {
		org.Name = v.(*types.AttributeValueMemberS).Value
	}
	if v, ok := item["BusinessName"]; ok {
		org.BusinessName = v.(*types.AttributeValueMemberS).Value
	}
	if v, ok := item["TaxID"]; ok {
		org.TaxID = v.(*types.AttributeValueMemberS).Value
	}
	if v, ok := item["Address"]; ok {
		org.Address = v.(*types.AttributeValueMemberS).Value
	}
	if v, ok := item["Email"]; ok {
		org.Email = v.(*types.AttributeValueMemberS).Value
	}
	if v, ok := item["Phone"]; ok {
		org.Phone = v.(*types.AttributeValueMemberS).Value
	}
	if v, ok := item["Status"]; ok {
		org.Status = v.(*types.AttributeValueMemberS).Value
	}
	if v, ok := item["PaymentStatus"]; ok {
		org.PaymentStatus = v.(*types.AttributeValueMemberS).Value
	}
	if v, ok := item["MaxDoctors"]; ok {
		fmt.Sscanf(v.(*types.AttributeValueMemberN).Value, "%d", &org.Limits.MaxDoctors)
	}
	if v, ok := item["MaxAssistants"]; ok {
		fmt.Sscanf(v.(*types.AttributeValueMemberN).Value, "%d", &org.Limits.MaxAssistants)
	}
	if v, ok := item["MaxPatients"]; ok {
		fmt.Sscanf(v.(*types.AttributeValueMemberN).Value, "%d", &org.Limits.MaxPatients)
	}
	if v, ok := item["CreatedAt"]; ok {
		org.CreatedAt, _ = time.Parse(time.RFC3339, v.(*types.AttributeValueMemberS).Value)
	}
	if v, ok := item["Timezone"]; ok {
		org.Timezone = v.(*types.AttributeValueMemberS).Value
	}
	if v, ok := item["UpdatedAt"]; ok {
		t, _ := time.Parse(time.RFC3339, v.(*types.AttributeValueMemberS).Value)
		org.UpdatedAt = &t
	}
	return org
}

func (r *dynamoAuthRepo) CreateOrganization(ctx context.Context, org Organization) (Organization, error) {
	item := orgToItem(org)
	_, err := r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName:           aws.String(r.tableName),
		Item:                item,
		ConditionExpression: aws.String("attribute_not_exists(PK)"),
	})
	if err != nil {
		return Organization{}, err
	}
	return org, nil
}

func (r *dynamoAuthRepo) UpdateOrganization(ctx context.Context, org Organization) (Organization, error) {
	now := time.Now()
	org.UpdatedAt = &now
	item := orgToItem(org)
	_, err := r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      item,
	})
	if err != nil {
		return Organization{}, err
	}
	return org, nil
}

func (r *dynamoAuthRepo) DeleteOrganization(ctx context.Context, orgID string) error {
	_, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
			"SK": &types.AttributeValueMemberS{Value: "ORG"},
		},
	})
	return err
}

func (r *dynamoAuthRepo) GetOrganization(ctx context.Context, orgID string) (Organization, error) {
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("ORG#%s", orgID)},
			"SK": &types.AttributeValueMemberS{Value: "ORG"},
		},
	})
	if err != nil {
		return Organization{}, err
	}
	if out.Item == nil {
		return Organization{}, fmt.Errorf("organization not found")
	}
	return itemToOrg(out.Item), nil
}

func (r *dynamoAuthRepo) ListOrganizations(ctx context.Context) ([]Organization, error) {
	out, err := r.client.Scan(ctx, &dynamodb.ScanInput{
		TableName:        aws.String(r.tableName),
		FilterExpression: aws.String("begins_with(PK, :prefix) AND SK = :sk"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":prefix": &types.AttributeValueMemberS{Value: "ORG#"},
			":sk":     &types.AttributeValueMemberS{Value: "ORG"},
		},
	})
	if err != nil {
		return nil, err
	}
	orgs := make([]Organization, 0, len(out.Items))
	for _, item := range out.Items {
		orgs = append(orgs, itemToOrg(item))
	}
	return orgs, nil
}

func (r *dynamoAuthRepo) CreateSession(ctx context.Context, session AuthSession) (AuthSession, error) {
	item := map[string]types.AttributeValue{
		"PK":        &types.AttributeValueMemberS{Value: fmt.Sprintf("SESSION#%s", session.Token)},
		"SK":        &types.AttributeValueMemberS{Value: "SESSION"},
		"Token":     &types.AttributeValueMemberS{Value: session.Token},
		"UserID":    &types.AttributeValueMemberS{Value: session.UserID},
		"OrgID":     &types.AttributeValueMemberS{Value: session.OrgID},
		"Role":      &types.AttributeValueMemberS{Value: session.Role},
		"ExpiresAt": &types.AttributeValueMemberS{Value: session.ExpiresAt.Format(time.RFC3339)},
	}
	_, err := r.client.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(r.tableName), Item: item})
	return session, err
}

func (r *dynamoAuthRepo) GetSession(ctx context.Context, token string) (AuthSession, error) {
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("SESSION#%s", token)},
			"SK": &types.AttributeValueMemberS{Value: "SESSION"},
		},
	})
	if err != nil {
		return AuthSession{}, err
	}
	if out.Item == nil {
		return AuthSession{}, fmt.Errorf("session not found")
	}
	var s AuthSession
	err = attributevalue.UnmarshalMap(out.Item, &s)
	return s, err
}

func (r *dynamoAuthRepo) DeleteSession(ctx context.Context, token string) error {
	_, err := r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("SESSION#%s", token)},
			"SK": &types.AttributeValueMemberS{Value: "SESSION"},
		},
	})
	return err
}

func (r *dynamoAuthRepo) CreateInvitation(ctx context.Context, inv UserInvitation) (UserInvitation, error) {
	item := map[string]types.AttributeValue{
		"PK":           &types.AttributeValueMemberS{Value: fmt.Sprintf("INVITE#%s", inv.Token)},
		"SK":           &types.AttributeValueMemberS{Value: "INVITE"},
		"Token":        &types.AttributeValueMemberS{Value: inv.Token},
		"OrgID":        &types.AttributeValueMemberS{Value: inv.OrgID},
		"Email":        &types.AttributeValueMemberS{Value: strings.ToLower(strings.TrimSpace(inv.Email))},
		"Role":         &types.AttributeValueMemberS{Value: inv.Role},
		"InvitedBy":    &types.AttributeValueMemberS{Value: inv.InvitedBy},
		"TempPassword": &types.AttributeValueMemberS{Value: inv.TempPassword},
		"ExpiresAt":    &types.AttributeValueMemberS{Value: inv.ExpiresAt.Format(time.RFC3339)},
		"Used":         &types.AttributeValueMemberBOOL{Value: inv.Used},
	}
	_, err := r.client.PutItem(ctx, &dynamodb.PutItemInput{TableName: aws.String(r.tableName), Item: item})
	return inv, err
}

func (r *dynamoAuthRepo) GetInvitation(ctx context.Context, token string) (UserInvitation, error) {
	out, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("INVITE#%s", token)},
			"SK": &types.AttributeValueMemberS{Value: "INVITE"},
		},
	})
	if err != nil {
		return UserInvitation{}, err
	}
	if out.Item == nil {
		return UserInvitation{}, fmt.Errorf("invitation not found")
	}
	var inv UserInvitation
	err = attributevalue.UnmarshalMap(out.Item, &inv)
	return inv, err
}

func (r *dynamoAuthRepo) MarkInvitationUsed(ctx context.Context, token string) error {
	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("INVITE#%s", token)},
			"SK": &types.AttributeValueMemberS{Value: "INVITE"},
		},
		UpdateExpression: aws.String("SET Used = :used"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":used": &types.AttributeValueMemberBOOL{Value: true},
		},
		ConditionExpression: aws.String("attribute_exists(PK)"),
	})
	return err
}

func (r *dynamoAuthRepo) UpdateUserPassword(ctx context.Context, userID, passwordHash string) error {
	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", userID)},
			"SK": &types.AttributeValueMemberS{Value: fmt.Sprintf("USER#%s", userID)},
		},
		UpdateExpression: aws.String("SET PasswordHash = :passwordHash"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":passwordHash": &types.AttributeValueMemberS{Value: passwordHash},
		},
		ConditionExpression: aws.String("attribute_exists(PK)"),
	})

	return err
}

func (r *dynamoAuthRepo) SaveResetToken(ctx context.Context, token PasswordResetToken) (PasswordResetToken, error) {
	item := map[string]types.AttributeValue{
		"PK":        &types.AttributeValueMemberS{Value: fmt.Sprintf("RESET_TOKEN#%s", token.Token)},
		"SK":        &types.AttributeValueMemberS{Value: "TOKEN"},
		"Token":     &types.AttributeValueMemberS{Value: token.Token},
		"UserID":    &types.AttributeValueMemberS{Value: token.UserID},
		"ExpiresAt": &types.AttributeValueMemberS{Value: token.ExpiresAt.Format(time.RFC3339)},
		"Used":      &types.AttributeValueMemberBOOL{Value: token.Used},
	}

	_, err := r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      item,
	})

	return token, err
}

func (r *dynamoAuthRepo) GetResetToken(ctx context.Context, token string) (PasswordResetToken, error) {
	result, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("RESET_TOKEN#%s", token)},
			"SK": &types.AttributeValueMemberS{Value: "TOKEN"},
		},
	})

	if err != nil {
		return PasswordResetToken{}, err
	}

	if result.Item == nil {
		return PasswordResetToken{}, fmt.Errorf("reset token not found")
	}

	var resetToken PasswordResetToken
	err = attributevalue.UnmarshalMap(result.Item, &resetToken)
	return resetToken, err
}

func (r *dynamoAuthRepo) MarkResetTokenUsed(ctx context.Context, token string) error {
	_, err := r.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: fmt.Sprintf("RESET_TOKEN#%s", token)},
			"SK": &types.AttributeValueMemberS{Value: "TOKEN"},
		},
		UpdateExpression: aws.String("SET Used = :used"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":used": &types.AttributeValueMemberBOOL{Value: true},
		},
		ConditionExpression: aws.String("attribute_exists(PK)"),
	})

	return err
}

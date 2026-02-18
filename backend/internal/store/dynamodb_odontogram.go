package store

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"clinical-backend/internal/domain"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

// DynamoDB Odontogram Repository
type dynamoOdontogramRepo struct {
	client    *dynamodb.Client
	tableName string
}

func (r *dynamoOdontogramRepo) Create(ctx context.Context, odontogram domain.Odontogram) (domain.Odontogram, error) {
	odontogram.CreatedAt = time.Now()
	odontogram.UpdatedAt = time.Now()
	
	item := map[string]types.AttributeValue{
		"PK":               &types.AttributeValueMemberS{Value: "ODONTOGRAM#" + odontogram.ID},
		"SK":               &types.AttributeValueMemberS{Value: "METADATA"},
		"PatientID":        &types.AttributeValueMemberS{Value: odontogram.PatientID},
		"DoctorID":         &types.AttributeValueMemberS{Value: odontogram.DoctorID},
		"GeneralNotes":     &types.AttributeValueMemberS{Value: odontogram.GeneralNotes},
		"LastExamDate":     &types.AttributeValueMemberS{Value: odontogram.LastExamDate.Format(time.RFC3339)},
		"CreatedAt":        &types.AttributeValueMemberS{Value: odontogram.CreatedAt.Format(time.RFC3339)},
		"UpdatedAt":        &types.AttributeValueMemberS{Value: odontogram.UpdatedAt.Format(time.RFC3339)},
	}
	
	if odontogram.NextExamDate != nil {
		item["NextExamDate"] = &types.AttributeValueMemberS{Value: odontogram.NextExamDate.Format(time.RFC3339)}
	}
	
	// Store teeth data
	if len(odontogram.Teeth) > 0 {
		teethData, err := attributevalue.Marshal(odontogram.Teeth)
		if err == nil {
			item["Teeth"] = teethData
		}
	}
	
	// Store treatment history
	if len(odontogram.TreatmentHistory) > 0 {
		treatmentData, err := attributevalue.Marshal(odontogram.TreatmentHistory)
		if err == nil {
			item["TreatmentHistory"] = treatmentData
		}
	}
	
	_, err := r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      item,
	})
	
	if err != nil {
		return domain.Odontogram{}, fmt.Errorf("failed to create odontogram: %w", err)
	}
	
	// Create patient index
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: "PATIENT#" + odontogram.PatientID},
			"SK": &types.AttributeValueMemberS{Value: "ODONTOGRAM"},
			"OdontogramID": &types.AttributeValueMemberS{Value: odontogram.ID},
		},
	})
	
	return odontogram, err
}

func (r *dynamoOdontogramRepo) GetByPatientID(ctx context.Context, patientID string) (domain.Odontogram, error) {
	// First get the odontogram ID from patient index
	result, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: "PATIENT#" + patientID},
			"SK": &types.AttributeValueMemberS{Value: "ODONTOGRAM"},
		},
	})
	
	if err != nil {
		return domain.Odontogram{}, fmt.Errorf("failed to get patient odontogram: %w", err)
	}
	
	if result.Item == nil {
		return domain.Odontogram{}, fmt.Errorf("odontogram not found for patient")
	}
	
	odontogramID, ok := result.Item["OdontogramID"].(*types.AttributeValueMemberS)
	if !ok {
		return domain.Odontogram{}, fmt.Errorf("invalid odontogram ID")
	}
	
	return r.GetByID(ctx, odontogramID.Value)
}

func (r *dynamoOdontogramRepo) GetByID(ctx context.Context, id string) (domain.Odontogram, error) {
	result, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: "ODONTOGRAM#" + id},
			"SK": &types.AttributeValueMemberS{Value: "METADATA"},
		},
	})
	
	if err != nil {
		return domain.Odontogram{}, fmt.Errorf("failed to get odontogram: %w", err)
	}
	
	if result.Item == nil {
		return domain.Odontogram{}, fmt.Errorf("odontogram not found")
	}
	
	var odontogram domain.Odontogram
	odontogram.ID = id
	
	if patientID, ok := result.Item["PatientID"].(*types.AttributeValueMemberS); ok {
		odontogram.PatientID = patientID.Value
	}
	if doctorID, ok := result.Item["DoctorID"].(*types.AttributeValueMemberS); ok {
		odontogram.DoctorID = doctorID.Value
	}
	if notes, ok := result.Item["GeneralNotes"].(*types.AttributeValueMemberS); ok {
		odontogram.GeneralNotes = notes.Value
	}
	if lastExam, ok := result.Item["LastExamDate"].(*types.AttributeValueMemberS); ok {
		if t, err := time.Parse(time.RFC3339, lastExam.Value); err == nil {
			odontogram.LastExamDate = t
		}
	}
	if nextExam, ok := result.Item["NextExamDate"].(*types.AttributeValueMemberS); ok {
		if t, err := time.Parse(time.RFC3339, nextExam.Value); err == nil {
			odontogram.NextExamDate = &t
		}
	}
	if createdAt, ok := result.Item["CreatedAt"].(*types.AttributeValueMemberS); ok {
		if t, err := time.Parse(time.RFC3339, createdAt.Value); err == nil {
			odontogram.CreatedAt = t
		}
	}
	if updatedAt, ok := result.Item["UpdatedAt"].(*types.AttributeValueMemberS); ok {
		if t, err := time.Parse(time.RFC3339, updatedAt.Value); err == nil {
			odontogram.UpdatedAt = t
		}
	}
	
	// Unmarshal teeth data
	if teethData, ok := result.Item["Teeth"]; ok {
		var teeth []domain.ToothInfo
		if err := attributevalue.Unmarshal(teethData, &teeth); err == nil {
			odontogram.Teeth = teeth
		}
	}
	
	// Unmarshal treatment history
	if treatmentData, ok := result.Item["TreatmentHistory"]; ok {
		var treatments []domain.ToothTreatment
		if err := attributevalue.Unmarshal(treatmentData, &treatments); err == nil {
			odontogram.TreatmentHistory = treatments
		}
	}
	
	return odontogram, nil
}

func (r *dynamoOdontogramRepo) Update(ctx context.Context, odontogram domain.Odontogram) (domain.Odontogram, error) {
	odontogram.UpdatedAt = time.Now()
	return r.Create(ctx, odontogram) // For simplicity, use create (overwrite)
}

func (r *dynamoOdontogramRepo) AddTreatment(ctx context.Context, odontogramID string, treatment domain.ToothTreatment) error {
	// Get current odontogram
	current, err := r.GetByID(ctx, odontogramID)
	if err != nil {
		return err
	}
	
	// Add treatment to history
	treatment.CreatedAt = time.Now()
	treatment.CompletedAt = time.Now()
	current.TreatmentHistory = append(current.TreatmentHistory, treatment)
	
	// Update odontogram
	_, err = r.Update(ctx, current)
	return err
}

func (r *dynamoOdontogramRepo) UpdateToothCondition(ctx context.Context, odontogramID string, toothNumber domain.ToothNumber, surfaces []domain.ToothSurfaceCondition) error {
	// Get current odontogram
	current, err := r.GetByID(ctx, odontogramID)
	if err != nil {
		return err
	}
	
	// Find and update tooth
	for i, tooth := range current.Teeth {
		if tooth.ToothNumber == toothNumber {
			tooth.Surfaces = surfaces
			tooth.LastUpdated = time.Now()
			current.Teeth[i] = tooth
			break
		}
	}
	
	// Update odontogram
	_, err = r.Update(ctx, current)
	return err
}

func (r *dynamoOdontogramRepo) GetTreatmentHistory(ctx context.Context, patientID string, limit int) ([]domain.ToothTreatment, error) {
	odontogram, err := r.GetByPatientID(ctx, patientID)
	if err != nil {
		return []domain.ToothTreatment{}, nil
	}
	
	treatments := odontogram.TreatmentHistory
	if limit > 0 && len(treatments) > limit {
		treatments = treatments[len(treatments)-limit:]
	}
	
	return treatments, nil
}

// DynamoDB Treatment Plan Repository
type dynamoTreatmentPlanRepo struct {
	client    *dynamodb.Client
	tableName string
}

func (r *dynamoTreatmentPlanRepo) Create(ctx context.Context, plan domain.TreatmentPlan) (domain.TreatmentPlan, error) {
	plan.CreatedAt = time.Now()
	plan.UpdatedAt = time.Now()
	
	treatmentData, err := attributevalue.Marshal(plan.Treatments)
	if err != nil {
		return domain.TreatmentPlan{}, fmt.Errorf("failed to marshal treatments: %w", err)
	}
	
	item := map[string]types.AttributeValue{
		"PK":            &types.AttributeValueMemberS{Value: "TREATMENT_PLAN#" + plan.ID},
		"SK":            &types.AttributeValueMemberS{Value: "METADATA"},
		"PatientID":     &types.AttributeValueMemberS{Value: plan.PatientID},
		"DoctorID":      &types.AttributeValueMemberS{Value: plan.DoctorID},
		"OdontogramID":  &types.AttributeValueMemberS{Value: plan.OdontogramID},
		"Title":         &types.AttributeValueMemberS{Value: plan.Title},
		"Description":   &types.AttributeValueMemberS{Value: plan.Description},
		"Treatments":    treatmentData,
		"TotalCost":     &types.AttributeValueMemberN{Value: fmt.Sprintf("%.2f", plan.TotalCost)},
		"EstimatedTime": &types.AttributeValueMemberN{Value: fmt.Sprintf("%d", plan.EstimatedTime)},
		"Priority":      &types.AttributeValueMemberS{Value: string(plan.Priority)},
		"Status":        &types.AttributeValueMemberS{Value: string(plan.Status)},
		"Notes":         &types.AttributeValueMemberS{Value: plan.Notes},
		"CreatedAt":     &types.AttributeValueMemberS{Value: plan.CreatedAt.Format(time.RFC3339)},
		"UpdatedAt":     &types.AttributeValueMemberS{Value: plan.UpdatedAt.Format(time.RFC3339)},
	}
	
	if plan.StartDate != nil {
		item["StartDate"] = &types.AttributeValueMemberS{Value: plan.StartDate.Format(time.RFC3339)}
	}
	if plan.EndDate != nil {
		item["EndDate"] = &types.AttributeValueMemberS{Value: plan.EndDate.Format(time.RFC3339)}
	}
	
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      item,
	})
	
	if err != nil {
		return domain.TreatmentPlan{}, fmt.Errorf("failed to create treatment plan: %w", err)
	}
	
	// Create patient index
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: "PATIENT#" + plan.PatientID},
			"SK": &types.AttributeValueMemberS{Value: "PLAN#" + plan.ID},
			"TreatmentPlanID": &types.AttributeValueMemberS{Value: plan.ID},
			"Title":           &types.AttributeValueMemberS{Value: plan.Title},
			"Status":          &types.AttributeValueMemberS{Value: string(plan.Status)},
			"CreatedAt":       &types.AttributeValueMemberS{Value: plan.CreatedAt.Format(time.RFC3339)},
		},
	})
	
	return plan, err
}

func (r *dynamoTreatmentPlanRepo) GetByID(ctx context.Context, id string) (domain.TreatmentPlan, error) {
	result, err := r.client.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: "TREATMENT_PLAN#" + id},
			"SK": &types.AttributeValueMemberS{Value: "METADATA"},
		},
	})
	
	if err != nil {
		return domain.TreatmentPlan{}, fmt.Errorf("failed to get treatment plan: %w", err)
	}
	
	if result.Item == nil {
		return domain.TreatmentPlan{}, fmt.Errorf("treatment plan not found")
	}
	
	var plan domain.TreatmentPlan
	plan.ID = id
	
	// Parse basic fields
	if patientID, ok := result.Item["PatientID"].(*types.AttributeValueMemberS); ok {
		plan.PatientID = patientID.Value
	}
	if doctorID, ok := result.Item["DoctorID"].(*types.AttributeValueMemberS); ok {
		plan.DoctorID = doctorID.Value
	}
	if odontogramID, ok := result.Item["OdontogramID"].(*types.AttributeValueMemberS); ok {
		plan.OdontogramID = odontogramID.Value
	}
	if title, ok := result.Item["Title"].(*types.AttributeValueMemberS); ok {
		plan.Title = title.Value
	}
	if description, ok := result.Item["Description"].(*types.AttributeValueMemberS); ok {
		plan.Description = description.Value
	}
	if notes, ok := result.Item["Notes"].(*types.AttributeValueMemberS); ok {
		plan.Notes = notes.Value
	}
	if priority, ok := result.Item["Priority"].(*types.AttributeValueMemberS); ok {
		plan.Priority = domain.TreatmentPriority(priority.Value)
	}
	if status, ok := result.Item["Status"].(*types.AttributeValueMemberS); ok {
		plan.Status = domain.TreatmentPlanStatus(status.Value)
	}
	
	// Parse numeric fields
	if totalCost, ok := result.Item["TotalCost"].(*types.AttributeValueMemberN); ok {
		if cost, err := strconv.ParseFloat(totalCost.Value, 64); err == nil {
			plan.TotalCost = cost
		}
	}
	if estimatedTime, ok := result.Item["EstimatedTime"].(*types.AttributeValueMemberN); ok {
		if t, err := strconv.Atoi(estimatedTime.Value); err == nil {
			plan.EstimatedTime = t
		}
	}
	
	// Parse date fields
	if createdAt, ok := result.Item["CreatedAt"].(*types.AttributeValueMemberS); ok {
		if t, err := time.Parse(time.RFC3339, createdAt.Value); err == nil {
			plan.CreatedAt = t
		}
	}
	if updatedAt, ok := result.Item["UpdatedAt"].(*types.AttributeValueMemberS); ok {
		if t, err := time.Parse(time.RFC3339, updatedAt.Value); err == nil {
			plan.UpdatedAt = t
		}
	}
	if startDate, ok := result.Item["StartDate"].(*types.AttributeValueMemberS); ok {
		if t, err := time.Parse(time.RFC3339, startDate.Value); err == nil {
			plan.StartDate = &t
		}
	}
	if endDate, ok := result.Item["EndDate"].(*types.AttributeValueMemberS); ok {
		if t, err := time.Parse(time.RFC3339, endDate.Value); err == nil {
			plan.EndDate = &t
		}
	}
	
	// Unmarshal treatments
	if treatmentData, ok := result.Item["Treatments"]; ok {
		var treatments []domain.PlannedTreatment
		if err := attributevalue.Unmarshal(treatmentData, &treatments); err == nil {
			plan.Treatments = treatments
		}
	}
	
	return plan, nil
}

func (r *dynamoTreatmentPlanRepo) GetByPatientID(ctx context.Context, patientID string) ([]domain.TreatmentPlan, error) {
	result, err := r.client.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(r.tableName),
		KeyConditionExpression: aws.String("PK = :pk AND begins_with(SK, :sk)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: "PATIENT#" + patientID},
			":sk": &types.AttributeValueMemberS{Value: "PLAN#"},
		},
	})
	
	if err != nil {
		return []domain.TreatmentPlan{}, fmt.Errorf("failed to query patient treatment plans: %w", err)
	}
	
	var plans []domain.TreatmentPlan
	for _, item := range result.Items {
		if planID, ok := item["TreatmentPlanID"].(*types.AttributeValueMemberS); ok {
			if plan, err := r.GetByID(ctx, planID.Value); err == nil {
				plans = append(plans, plan)
			}
		}
	}
	
	return plans, nil
}

func (r *dynamoTreatmentPlanRepo) Update(ctx context.Context, plan domain.TreatmentPlan) (domain.TreatmentPlan, error) {
	plan.UpdatedAt = time.Now()
	return r.Create(ctx, plan) // For simplicity, use create (overwrite)
}

func (r *dynamoTreatmentPlanRepo) Delete(ctx context.Context, id string) error {
	// Get plan to get patient ID for index cleanup
	plan, err := r.GetByID(ctx, id)
	if err != nil {
		return err
	}
	
	// Delete main item
	_, err = r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: "TREATMENT_PLAN#" + id},
			"SK": &types.AttributeValueMemberS{Value: "METADATA"},
		},
	})
	if err != nil {
		return fmt.Errorf("failed to delete treatment plan: %w", err)
	}
	
	// Delete patient index
	_, err = r.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(r.tableName),
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: "PATIENT#" + plan.PatientID},
			"SK": &types.AttributeValueMemberS{Value: "PLAN#" + id},
		},
	})
	
	return err
}

func (r *dynamoTreatmentPlanRepo) UpdateTreatmentStatus(ctx context.Context, planID, treatmentIndex string, status domain.PlannedTreatmentStatus, completedTreatmentID *string) error {
	// Get current plan
	plan, err := r.GetByID(ctx, planID)
	if err != nil {
		return err
	}
	
	// Parse treatment index
	index, err := strconv.Atoi(treatmentIndex)
	if err != nil || index < 0 || index >= len(plan.Treatments) {
		return fmt.Errorf("invalid treatment index")
	}
	
	// Update treatment status
	plan.Treatments[index].Status = status
	if completedTreatmentID != nil {
		plan.Treatments[index].CompletedTreatmentID = completedTreatmentID
	}
	
	// Update plan
	_, err = r.Update(ctx, plan)
	return err
}

package main

import (
	"context"
	"log"
	"os"

	"clinical-backend/internal/api"
	"clinical-backend/internal/config"
	"clinical-backend/internal/notifications"
	"clinical-backend/internal/service"
	"clinical-backend/internal/store"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

func main() {
	cfg := config.Load()
	notifier := notifications.NewRouter(cfg)

	// Initialize repositories based on environment
	var repos struct {
		Patients       store.PatientRepository
		Appointments   store.AppointmentRepository
		Consents       store.ConsentRepository
		Users          store.AuthRepository
		Odontograms    store.OdontogramRepository
		TreatmentPlans store.TreatmentPlanRepository
	}

	if cfg.ShouldUseDynamoDB() {
		log.Printf("Initializing DynamoDB repositories (environment: %s, lambda: %t)", cfg.Environment, cfg.IsLambda)

		dynamoConfig := store.DynamoDBConfig{
			PatientTableName:       cfg.PatientTable,
			AppointmentTableName:   cfg.AppointmentTable,
			ConsentTableName:       cfg.ConsentTable,
			UserTableName:          cfg.UserTable,
			OdontogramTableName:    cfg.OdontogramTable,
			TreatmentPlanTableName: cfg.TreatmentPlanTable,
			UseLocalProfile:        cfg.IsLocal(),
			ProfileName:            cfg.AWSProfile,
		}

		dynamoRepos, err := store.NewDynamoDBRepositories(context.Background(), dynamoConfig)
		if err != nil {
			log.Printf("Failed to initialize DynamoDB repositories: %v", err)
			log.Printf("Falling back to in-memory repositories for development")
			memRepos := store.NewInMemoryRepositories()
			repos.Patients = memRepos.Patients
			repos.Appointments = memRepos.Appointments
			repos.Consents = memRepos.Consents
			repos.Users = memRepos.Users
			repos.Odontograms = memRepos.Odontograms
			repos.TreatmentPlans = memRepos.TreatmentPlans
		} else {
			repos.Patients = dynamoRepos.Patients
			repos.Appointments = dynamoRepos.Appointments
			repos.Consents = dynamoRepos.Consents
			repos.Users = dynamoRepos.Users
			repos.Odontograms = dynamoRepos.Odontograms
			repos.TreatmentPlans = dynamoRepos.TreatmentPlans
		}
	} else {
		log.Printf("Using in-memory repositories (local development)")
		memRepos := store.NewInMemoryRepositories()
		repos.Patients = memRepos.Patients
		repos.Appointments = memRepos.Appointments
		repos.Consents = memRepos.Consents
		repos.Users = memRepos.Users
		repos.Odontograms = memRepos.Odontograms
		repos.TreatmentPlans = memRepos.TreatmentPlans
	}

	appointments := service.NewAppointmentService(repos.Appointments, notifier)
	patients := service.NewPatientService(repos.Patients)
	consents := service.NewConsentService(repos.Consents, notifier)
	auth := service.NewAuthService(repos.Users)

	// Create odontogram services
	odontogramService := service.NewOdontogramService(repos.Odontograms, repos.Patients, repos.TreatmentPlans)
	treatmentPlanService := service.NewTreatmentPlanService(repos.TreatmentPlans, repos.Odontograms, repos.Patients)

	// Create odontogram handler
	odontogramHandler := api.NewOdontogramHandler(odontogramService, treatmentPlanService)

	router := api.NewRouter(appointments, patients, consents, auth, odontogramHandler)

	if os.Getenv("LOCAL_HTTP") == "true" {
		if err := runLocalHTTP(router); err != nil {
			log.Fatalf("local http failed: %v", err)
		}
		return
	}

	// Lambda handler that detects event type and routes accordingly
	lambda.Start(func(ctx context.Context, event interface{}) (interface{}, error) {
		log.Printf("Lambda invoked with event type: %T", event)

		switch e := event.(type) {
		case events.APIGatewayV2HTTPRequest:
			// API Gateway HTTP request - ClinicalApiFunction
			log.Printf("Processing API Gateway HTTP request: %s %s", e.RequestContext.HTTP.Method, e.RequestContext.HTTP.Path)
			resp, err := router.Handle(ctx, e)
			if err != nil {
				log.Printf("API request failed: %v", err)
				return events.APIGatewayV2HTTPResponse{StatusCode: 500, Body: `{"error":"internal_error"}`}, nil
			}
			return resp, nil

		case events.CloudWatchEvent:
			// EventBridge scheduled event - Reminder24hFunction or EndOfDayFunction
			log.Printf("Processing EventBridge event: %s", e.Source)

			if e.DetailType == "Scheduled Event" {
				// Determine function type from environment variable
				functionName := os.Getenv("AWS_LAMBDA_FUNCTION_NAME")
				log.Printf("Function name: %s", functionName)

				// Check if this is the reminder function
				if functionName != "" && (functionName == "clinical-backend-Reminder24hFunction" ||
					len(functionName) > 19 && functionName[len(functionName)-19:] == "Reminder24hFunction") {
					// Process 24h reminders
					log.Printf("Processing 24h reminders")
					return handleReminder24h(ctx, repos.Appointments, repos.Patients, notifier)
				} else {
					// Process end of day
					log.Printf("Processing end of day")
					return handleEndOfDay(ctx, repos.Appointments, repos.Patients, notifier)
				}
			}

			return map[string]string{"status": "unknown_scheduled_event"}, nil

		default:
			log.Printf("Unknown event type: %T", event)
			return map[string]string{"error": "unsupported_event_type"}, nil
		}
	})
}

// handleReminder24h processes 24h reminder notifications
func handleReminder24h(ctx context.Context, appointments store.AppointmentRepository, patients store.PatientRepository, notifier *notifications.Router) (map[string]interface{}, error) {
	log.Printf("Starting 24h reminder processing")

	// Mock implementation for pipeline testing - add real logic later
	result := map[string]interface{}{
		"function": "reminder24h",
		"status":   "success",
		"message":  "24h reminders processed successfully",
		"version":  "1.0.1",
		"updated":  "2026-02-18T23:53:00Z",
	}

	log.Printf("24h reminders completed: %+v", result)
	return result, nil
}

// handleEndOfDay processes end of day notifications and summaries
func handleEndOfDay(ctx context.Context, appointments store.AppointmentRepository, patients store.PatientRepository, notifier *notifications.Router) (map[string]interface{}, error) {
	log.Printf("Starting end of day processing")

	// Mock implementation for pipeline testing - add real logic later
	result := map[string]interface{}{
		"function": "endOfDay",
		"status":   "success",
		"message":  "End of day processing completed successfully",
		"version":  "1.0.1",
		"updated":  "2026-02-18T23:53:00Z",
	}

	log.Printf("End of day processing completed: %+v", result)
	return result, nil
}

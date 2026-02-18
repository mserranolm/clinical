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
		Patients     store.PatientRepository
		Appointments store.AppointmentRepository
		Consents     store.ConsentRepository
		Users        store.AuthRepository
	}

	if cfg.ShouldUseDynamoDB() {
		log.Printf("Initializing DynamoDB repositories (environment: %s, lambda: %t)", cfg.Environment, cfg.IsLambda)

		dynamoConfig := store.DynamoDBConfig{
			PatientTableName:     cfg.PatientTable,
			AppointmentTableName: cfg.AppointmentTable,
			ConsentTableName:     cfg.ConsentTable,
			UseLocalProfile:      cfg.IsLocal(),
			ProfileName:          cfg.AWSProfile,
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
		} else {
			repos.Patients = dynamoRepos.Patients
			repos.Appointments = dynamoRepos.Appointments
			repos.Consents = dynamoRepos.Consents
			repos.Users = dynamoRepos.Users
		}
	} else {
		log.Printf("Using in-memory repositories (local development)")
		memRepos := store.NewInMemoryRepositories()
		repos.Patients = memRepos.Patients
		repos.Appointments = memRepos.Appointments
		repos.Consents = memRepos.Consents
		repos.Users = memRepos.Users
	}

	appointments := service.NewAppointmentService(repos.Appointments, notifier)
	patients := service.NewPatientService(repos.Patients)
	consents := service.NewConsentService(repos.Consents, notifier)
	auth := service.NewAuthService(repos.Users)
	router := api.NewRouter(appointments, patients, consents, auth)

	if os.Getenv("LOCAL_HTTP") == "true" {
		if err := runLocalHTTP(router); err != nil {
			log.Fatalf("local http failed: %v", err)
		}
		return
	}

	lambda.Start(func(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
		resp, err := router.Handle(ctx, req)
		if err != nil {
			log.Printf("request failed: %v", err)
			return events.APIGatewayV2HTTPResponse{StatusCode: 500, Body: `{"error":"internal_error"}`}, nil
		}
		return resp, nil
	})
}

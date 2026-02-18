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
	repos := store.NewInMemoryRepositories()
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

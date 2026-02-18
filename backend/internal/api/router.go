package api

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"clinical-backend/internal/service"

	"github.com/aws/aws-lambda-go/events"
)

type Router struct {
	appointments *service.AppointmentService
	patients     *service.PatientService
	consents     *service.ConsentService
	auth         *service.AuthService
}

func NewRouter(appointments *service.AppointmentService, patients *service.PatientService, consents *service.ConsentService, auth *service.AuthService) *Router {
	return &Router{appointments: appointments, patients: patients, consents: consents, auth: auth}
}

func (r *Router) Handle(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	method := strings.ToUpper(req.RequestContext.HTTP.Method)
	path := req.RawPath

	if method == "OPTIONS" {
		return response(204, map[string]string{"status": "ok"})
	}

	switch {
	case method == "POST" && path == "/auth/register":
		return r.register(ctx, req)
	case method == "POST" && path == "/auth/login":
		return r.login(ctx, req)
	case method == "POST" && path == "/auth/forgot-password":
		return r.forgotPassword(ctx, req)
	case method == "POST" && path == "/auth/reset-password":
		return r.resetPassword(ctx, req)
	case method == "POST" && path == "/patients/onboard":
		return r.onboardPatient(ctx, req)
	case method == "GET" && strings.HasPrefix(path, "/patients/"):
		return r.getPatient(ctx, strings.TrimPrefix(path, "/patients/"))
	case method == "POST" && path == "/appointments":
		return r.createAppointment(ctx, req)
	case method == "GET" && path == "/appointments":
		return r.listAppointments(ctx, req)
	case method == "POST" && strings.HasSuffix(path, "/confirm") && strings.HasPrefix(path, "/appointments/"):
		id := strings.TrimSuffix(strings.TrimPrefix(path, "/appointments/"), "/confirm")
		return r.confirmAppointment(ctx, id)
	case method == "POST" && strings.HasSuffix(path, "/close-day") && strings.HasPrefix(path, "/appointments/"):
		id := strings.TrimSuffix(strings.TrimPrefix(path, "/appointments/"), "/close-day")
		return r.closeAppointmentDay(ctx, id, req)
	case method == "POST" && strings.HasSuffix(path, "/send-reminder") && strings.HasPrefix(path, "/appointments/"):
		id := strings.TrimSuffix(strings.TrimPrefix(path, "/appointments/"), "/send-reminder")
		return r.sendAppointmentReminder(ctx, id, req)
	case method == "POST" && path == "/consents":
		return r.createConsent(ctx, req)
	case method == "POST" && strings.HasSuffix(path, "/accept") && strings.HasPrefix(path, "/consents/"):
		id := strings.TrimSuffix(strings.TrimPrefix(path, "/consents/"), "/accept")
		return r.acceptConsent(ctx, id)
	case method == "POST" && strings.HasSuffix(path, "/end-day-reminder") && strings.HasPrefix(path, "/doctors/"):
		id := strings.TrimSuffix(strings.TrimPrefix(path, "/doctors/"), "/end-day-reminder")
		return r.sendDoctorEndDayReminder(ctx, id, req)
	default:
		return response(404, map[string]string{"error": "not_found"})
	}
}

func (r *Router) onboardPatient(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in service.CreatePatientInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	patient, err := r.patients.Onboard(ctx, in)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(201, patient)
}

func (r *Router) register(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in service.RegisterInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	out, err := r.auth.Register(ctx, in)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(201, out)
}

func (r *Router) login(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in service.LoginInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	out, err := r.auth.Login(ctx, in)
	if err != nil {
		return response(401, map[string]string{"error": err.Error()})
	}
	return response(200, out)
}

func (r *Router) forgotPassword(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in service.ForgotPasswordInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	out, err := r.auth.ForgotPassword(ctx, in)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(200, out)
}

func (r *Router) resetPassword(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in service.ResetPasswordInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	if err := r.auth.ResetPassword(ctx, in); err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(200, map[string]string{"status": "password_reset"})
}

func (r *Router) getPatient(ctx context.Context, id string) (events.APIGatewayV2HTTPResponse, error) {
	patient, err := r.patients.GetByID(ctx, id)
	if err != nil {
		return response(404, map[string]string{"error": err.Error()})
	}
	return response(200, patient)
}

func (r *Router) createAppointment(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in service.CreateAppointmentInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	appointment, err := r.appointments.Create(ctx, in)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(201, appointment)
}

func (r *Router) listAppointments(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	doctorID := req.QueryStringParameters["doctorId"]
	date := req.QueryStringParameters["date"]
	items, err := r.appointments.ListByDoctorAndDate(ctx, doctorID, date)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(200, map[string]any{"items": items})
}

func (r *Router) confirmAppointment(ctx context.Context, id string) (events.APIGatewayV2HTTPResponse, error) {
	item, err := r.appointments.Confirm(ctx, id)
	if err != nil {
		return response(404, map[string]string{"error": err.Error()})
	}
	return response(200, item)
}

func (r *Router) closeAppointmentDay(ctx context.Context, id string, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in struct {
		EvolutionNotes string  `json:"evolutionNotes"`
		PaymentAmount  float64 `json:"paymentAmount"`
		PaymentMethod  string  `json:"paymentMethod"`
	}
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	item, err := r.appointments.CloseDayForAppointment(ctx, id, in.EvolutionNotes, in.PaymentAmount, in.PaymentMethod)
	if err != nil {
		return response(404, map[string]string{"error": err.Error()})
	}
	return response(200, item)
}

func (r *Router) sendAppointmentReminder(ctx context.Context, id string, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in struct {
		Channel string `json:"channel"`
	}
	if req.Body != "" {
		if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
			return response(400, map[string]string{"error": "invalid_json"})
		}
	}
	if in.Channel == "" {
		in.Channel = "email"
	}
	if err := r.appointments.Send24hReminder(ctx, id, in.Channel); err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(200, map[string]string{"status": "reminder_sent"})
}

func (r *Router) createConsent(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in service.CreateConsentInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	consent, err := r.consents.CreateAndSend(ctx, in)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(201, consent)
}

func (r *Router) acceptConsent(ctx context.Context, id string) (events.APIGatewayV2HTTPResponse, error) {
	consent, err := r.consents.Accept(ctx, id)
	if err != nil {
		return response(404, map[string]string{"error": err.Error()})
	}
	return response(200, consent)
}

func (r *Router) sendDoctorEndDayReminder(ctx context.Context, doctorID string, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in struct {
		Channel string `json:"channel"`
	}
	if req.Body != "" {
		if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
			return response(400, map[string]string{"error": "invalid_json"})
		}
	}
	if in.Channel == "" {
		in.Channel = "email"
	}
	if err := r.appointments.SendDoctorCloseDayReminder(ctx, doctorID, in.Channel); err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(200, map[string]string{"status": "doctor_reminder_sent"})
}

func response(code int, payload any) (events.APIGatewayV2HTTPResponse, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return events.APIGatewayV2HTTPResponse{}, fmt.Errorf("marshal response: %w", err)
	}
	return events.APIGatewayV2HTTPResponse{
		StatusCode: code,
		Body:       string(body),
		Headers: map[string]string{
			"Content-Type":                 "application/json",
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Headers": "content-type,authorization",
			"Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
		},
	}, nil
}

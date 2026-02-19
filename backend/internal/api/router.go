package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"clinical-backend/internal/domain"
	"clinical-backend/internal/service"

	"github.com/aws/aws-lambda-go/events"
)

type authCtxKey string

const ctxAuthKey authCtxKey = "auth"

type permission string

const (
	permUsersManage        permission = "users.manage"
	permPatientsManage     permission = "patients.manage"
	permAppointmentsManage permission = "appointments.manage"
	permTreatmentsManage   permission = "treatments.manage"
)

func hasPermission(role string, p permission) bool {
	r := strings.ToLower(strings.TrimSpace(role))
	switch p {
	case permUsersManage:
		return r == "admin"
	case permPatientsManage:
		return r == "admin" || r == "doctor"
	case permAppointmentsManage:
		return r == "admin" || r == "assistant"
	case permTreatmentsManage:
		return r == "admin" || r == "doctor"
	default:
		return false
	}
}

func bearerToken(req events.APIGatewayV2HTTPRequest) string {
	authz := req.Headers["authorization"]
	if authz == "" {
		authz = req.Headers["Authorization"]
	}
	authz = strings.TrimSpace(authz)
	if authz == "" {
		return ""
	}
	if strings.HasPrefix(strings.ToLower(authz), "bearer ") {
		return strings.TrimSpace(authz[7:])
	}
	return authz
}

func isPublicEndpoint(method, path string) bool {
	if method == "GET" && path == "/health" {
		return true
	}
	if method == "POST" && strings.HasPrefix(path, "/auth/") {
		return true
	}
	return false
}

func (r *Router) require(ctx context.Context, req events.APIGatewayV2HTTPRequest, p permission) (context.Context, events.APIGatewayV2HTTPResponse, bool) {
	token := bearerToken(req)
	auth, err := r.auth.Authenticate(ctx, token)
	if err != nil {
		resp, _ := response(401, map[string]string{"error": err.Error()})
		return ctx, resp, false
	}
	if !hasPermission(auth.User.Role, p) {
		resp, _ := response(403, map[string]string{"error": "forbidden"})
		return ctx, resp, false
	}
	return context.WithValue(ctx, ctxAuthKey, auth), events.APIGatewayV2HTTPResponse{}, true
}

type Router struct {
	appointments *service.AppointmentService
	patients     *service.PatientService
	consents     *service.ConsentService
	auth         *service.AuthService
	odontogram   *OdontogramHandler
}

func (r *Router) resendAppointmentConfirmation(ctx context.Context, id string, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
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
	if err := r.appointments.SendReminderAnytime(ctx, id, in.Channel); err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(200, map[string]string{"status": "reminder_resent"})
}

func NewRouter(appointments *service.AppointmentService, patients *service.PatientService, consents *service.ConsentService, auth *service.AuthService, odontogram *OdontogramHandler) *Router {
	return &Router{appointments: appointments, patients: patients, consents: consents, auth: auth, odontogram: odontogram}
}

// logResponse logs the response details and returns the response
func (r *Router) logResponse(endpoint string, startTime time.Time, resp events.APIGatewayV2HTTPResponse, err error) (events.APIGatewayV2HTTPResponse, error) {
	duration := time.Since(startTime)

	if err != nil {
		log.Printf("[ERROR] %s - Duration: %v, Error: %v", endpoint, duration, err)
		return events.APIGatewayV2HTTPResponse{StatusCode: 500, Body: `{"message": "Internal server error"}`}, nil
	}

	log.Printf("[RESPONSE] %s - Status: %d, Duration: %v, Body: %s", endpoint, resp.StatusCode, duration, resp.Body)
	return resp, err
}

func (r *Router) Handle(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	startTime := time.Now()
	method := strings.ToUpper(req.RequestContext.HTTP.Method)
	path := req.RequestContext.HTTP.Path
	if path == "" {
		path = req.RawPath
	}
	endpoint := fmt.Sprintf("%s %s", method, path)

	// Log request details with debugging
	log.Printf("[REQUEST] %s - Body: %s", endpoint, req.Body)
	log.Printf("[DEBUG] RawPath: '%s', HTTP.Path: '%s', Method: '%s'", req.RawPath, req.RequestContext.HTTP.Path, req.RequestContext.HTTP.Method)
	log.Printf("[DEBUG] Route Key: '%s'", req.RouteKey)

	var resp events.APIGatewayV2HTTPResponse
	var err error

	if method == "OPTIONS" {
		resp, err = response(204, map[string]string{"status": "ok"})
	} else {
		switch {
		case method == "GET" && path == "/health":
			resp, err = response(200, map[string]string{"status": "ok", "message": "Clinical API is running", "version": "1.0.1", "updated": "2026-02-18"})
		case method == "POST" && path == "/auth/register":
			resp, err = r.register(ctx, req)
		case method == "POST" && path == "/auth/login":
			resp, err = r.login(ctx, req)
		case method == "POST" && path == "/auth/forgot-password":
			resp, err = r.forgotPassword(ctx, req)
		case method == "POST" && path == "/auth/reset-password":
			resp, err = r.resetPassword(ctx, req)
		case method == "POST" && path == "/patients/onboard":
			if actx, deny, ok := r.require(ctx, req, permPatientsManage); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.onboardPatient(actx, req)
			}
		case method == "GET" && path == "/patients":
			if actx, deny, ok := r.require(ctx, req, permPatientsManage); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.listPatients(actx, req)
			}
		case method == "GET" && path == "/patients/search":
			if actx, deny, ok := r.require(ctx, req, permPatientsManage); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.searchPatients(actx, req)
			}
		case method == "GET" && strings.HasPrefix(path, "/patients/"):
			if actx, deny, ok := r.require(ctx, req, permPatientsManage); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.getPatient(actx, strings.TrimPrefix(path, "/patients/"))
			}
		case method == "PUT" && strings.HasPrefix(path, "/patients/"):
			if actx, deny, ok := r.require(ctx, req, permPatientsManage); !ok {
				resp, err = deny, nil
			} else {
				id := strings.TrimPrefix(path, "/patients/")
				resp, err = r.updatePatient(actx, id, req)
			}
		case method == "DELETE" && strings.HasPrefix(path, "/patients/"):
			if actx, deny, ok := r.require(ctx, req, permPatientsManage); !ok {
				resp, err = deny, nil
			} else {
				id := strings.TrimPrefix(path, "/patients/")
				resp, err = r.deletePatient(actx, id)
			}
		case method == "POST" && path == "/appointments":
			if actx, deny, ok := r.require(ctx, req, permAppointmentsManage); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.createAppointment(actx, req)
			}
		case method == "GET" && path == "/appointments":
			if actx, deny, ok := r.require(ctx, req, permAppointmentsManage); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.listAppointments(actx, req)
			}
		case method == "POST" && strings.HasSuffix(path, "/confirm") && strings.HasPrefix(path, "/appointments/"):
			if actx, deny, ok := r.require(ctx, req, permAppointmentsManage); !ok {
				resp, err = deny, nil
			} else {
				id := strings.TrimSuffix(strings.TrimPrefix(path, "/appointments/"), "/confirm")
				resp, err = r.confirmAppointment(actx, id)
			}
		case method == "POST" && strings.HasSuffix(path, "/close-day") && strings.HasPrefix(path, "/appointments/"):
			if actx, deny, ok := r.require(ctx, req, permTreatmentsManage); !ok {
				resp, err = deny, nil
			} else {
				date := strings.TrimSuffix(strings.TrimPrefix(path, "/appointments/"), "/close-day")
				resp, err = r.closeAppointmentDay(actx, date, req)
			}
		case method == "POST" && strings.HasSuffix(path, "/resend-confirmation") && strings.HasPrefix(path, "/appointments/"):
			if actx, deny, ok := r.require(ctx, req, permAppointmentsManage); !ok {
				resp, err = deny, nil
			} else {
				id := strings.TrimSuffix(strings.TrimPrefix(path, "/appointments/"), "/resend-confirmation")
				resp, err = r.resendAppointmentConfirmation(actx, id, req)
			}
		case method == "POST" && path == "/consents":
			if actx, deny, ok := r.require(ctx, req, permPatientsManage); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.createConsent(actx, req)
			}
		case method == "GET" && strings.HasPrefix(path, "/consents/verify/"):
			// Public verification link
			token := strings.TrimPrefix(path, "/consents/verify/")
			resp, err = r.acceptConsent(ctx, token)
		case method == "POST" && strings.HasPrefix(path, "/odontograms"):
			if actx, deny, ok := r.require(ctx, req, permTreatmentsManage); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.odontogram.CreateOdontogram(actx, req)
			}
		case method == "GET" && strings.HasPrefix(path, "/odontograms/patient/"):
			if actx, deny, ok := r.require(ctx, req, permTreatmentsManage); !ok {
				resp, err = deny, nil
			} else {
				patientId := strings.TrimPrefix(path, "/odontograms/patient/")
				if req.PathParameters == nil {
					req.PathParameters = make(map[string]string)
				}
				req.PathParameters["patientId"] = patientId
				resp, err = r.odontogram.GetOdontogramByPatient(actx, req)
			}
		case method == "PUT" && strings.HasPrefix(path, "/odontograms"):
			if actx, deny, ok := r.require(ctx, req, permTreatmentsManage); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.odontogram.UpdateToothCondition(actx, req)
			}
		case method == "POST" && strings.Contains(path, "/treatment-plans"):
			if actx, deny, ok := r.require(ctx, req, permTreatmentsManage); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.odontogram.CreateTreatmentPlan(actx, req)
			}
		case method == "GET" && strings.Contains(path, "/treatment-plans"):
			if actx, deny, ok := r.require(ctx, req, permTreatmentsManage); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.odontogram.GetTreatmentPlan(actx, req)
			}
		case method == "PUT" && strings.Contains(path, "/treatment-plans"):
			if actx, deny, ok := r.require(ctx, req, permTreatmentsManage); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.odontogram.UpdateTreatmentPlan(actx, req)
			}
		default:
			resp, err = response(404, map[string]string{"error": "endpoint_not_found", "message": "The requested endpoint was not found"})
		}
	}

	// Log response
	duration := time.Since(startTime)
	if err != nil {
		log.Printf("[ERROR] %s - Duration: %v, Error: %v", endpoint, duration, err)
		return events.APIGatewayV2HTTPResponse{StatusCode: 500, Body: `{"message": "Internal server error"}`}, nil
	}

	log.Printf("[RESPONSE] %s - Status: %d, Duration: %v, Body: %s", endpoint, resp.StatusCode, duration, resp.Body)
	return resp, nil
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

func (r *Router) listPatients(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	doctorID := req.QueryStringParameters["doctorId"]
	patients, err := r.patients.ListByDoctor(ctx, doctorID)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	if patients == nil {
		patients = []domain.Patient{}
	}
	return response(200, map[string]any{"items": patients, "total": len(patients)})
}

func (r *Router) searchPatients(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	q := req.QueryStringParameters["q"]
	doctorID := req.QueryStringParameters["doctorId"]
	if q == "" {
		return response(400, map[string]string{"error": "query parameter 'q' is required"})
	}
	patients, err := r.patients.Search(ctx, doctorID, q)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	if patients == nil {
		patients = []domain.Patient{}
	}
	return response(200, map[string]any{"items": patients, "total": len(patients)})
}

func (r *Router) updatePatient(ctx context.Context, id string, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in service.UpdatePatientInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	patient, err := r.patients.Update(ctx, id, in)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(200, patient)
}

func (r *Router) deletePatient(ctx context.Context, id string) (events.APIGatewayV2HTTPResponse, error) {
	if err := r.patients.Delete(ctx, id); err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(200, map[string]string{"status": "deleted"})
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

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
	"clinical-backend/internal/store"

	"github.com/aws/aws-lambda-go/events"
)

type authCtxKey string

const ctxAuthKey authCtxKey = "auth"

type permission string

const (
	permPlatformManage     permission = "platform.manage"
	permUsersManage        permission = "users.manage"
	permPatientsView       permission = "patients.view"
	permPatientsWrite      permission = "patients.write"
	permPatientsDelete     permission = "patients.delete"
	permAppointmentsWrite  permission = "appointments.write"
	permAppointmentsDelete permission = "appointments.delete"
	permTreatmentsManage   permission = "treatments.manage"
)

// hasPermission enforces the RBAC matrix:
//
//	platform_admin : everything
//	admin          : users, patients (view+write+delete), appointments (write+delete), treatments
//	doctor         : patients (view+write), appointments (write), treatments
//	assistant      : patients (view only), appointments (write — create/edit/cancel/confirm)
func hasPermission(role string, p permission) bool {
	r := strings.ToLower(strings.TrimSpace(role))
	if r == "platform_admin" {
		return true
	}
	switch p {
	case permPlatformManage:
		return false
	case permUsersManage:
		return r == "admin"
	case permPatientsView:
		return r == "admin" || r == "doctor" || r == "assistant"
	case permPatientsWrite:
		return r == "admin" || r == "doctor"
	case permPatientsDelete:
		return r == "admin"
	case permAppointmentsWrite:
		return r == "admin" || r == "doctor" || r == "assistant"
	case permAppointmentsDelete:
		return r == "admin"
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
	if method == "POST" && path == "/platform/bootstrap" {
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
	ctx = store.ContextWithOrgID(ctx, auth.User.OrgID)
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

func (r *Router) registerPayment(ctx context.Context, id string, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in service.RegisterPaymentInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	appt, err := r.appointments.RegisterPayment(ctx, id, in)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(200, appt)
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
		case method == "POST" && path == "/platform/bootstrap":
			resp, err = r.platformBootstrap(ctx, req)
		case method == "POST" && path == "/platform/orgs":
			if actx, deny, ok := r.require(ctx, req, permPlatformManage); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.createOrganization(actx, req)
			}
		case method == "GET" && path == "/platform/stats":
			if actx, deny, ok := r.require(ctx, req, permPlatformManage); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.getPlatformStats(actx)
			}
		case method == "GET" && path == "/org/stats":
			if actx, deny, ok := r.require(ctx, req, permUsersManage); !ok {
				resp, err = deny, nil
			} else {
				auth := actx.Value(ctxAuthKey).(service.Authenticated)
				resp, err = r.getOrgStats(actx, auth.User.OrgID)
			}
		case method == "GET" && path == "/platform/orgs":
			if actx, deny, ok := r.require(ctx, req, permPlatformManage); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.listOrganizations(actx)
			}
		case method == "GET" && strings.HasPrefix(path, "/platform/orgs/") && !strings.Contains(path[len("/platform/orgs/"):], "/"):
			if actx, deny, ok := r.require(ctx, req, permPlatformManage); !ok {
				resp, err = deny, nil
			} else {
				orgID := strings.TrimPrefix(path, "/platform/orgs/")
				resp, err = r.getOrganization(actx, orgID)
			}
		case method == "PUT" && strings.HasPrefix(path, "/platform/orgs/") && !strings.Contains(path[len("/platform/orgs/"):], "/"):
			if actx, deny, ok := r.require(ctx, req, permPlatformManage); !ok {
				resp, err = deny, nil
			} else {
				orgID := strings.TrimPrefix(path, "/platform/orgs/")
				resp, err = r.updateOrganization(actx, orgID, req)
			}
		case method == "DELETE" && strings.HasPrefix(path, "/platform/orgs/") && !strings.Contains(path[len("/platform/orgs/"):], "/"):
			if actx, deny, ok := r.require(ctx, req, permPlatformManage); !ok {
				resp, err = deny, nil
			} else {
				orgID := strings.TrimPrefix(path, "/platform/orgs/")
				resp, err = r.deleteOrganization(actx, orgID)
			}
		case method == "POST" && strings.HasPrefix(path, "/platform/orgs/") && strings.HasSuffix(path, "/admins"):
			if actx, deny, ok := r.require(ctx, req, permPlatformManage); !ok {
				resp, err = deny, nil
			} else {
				orgID := strings.TrimSuffix(strings.TrimPrefix(path, "/platform/orgs/"), "/admins")
				resp, err = r.createOrgAdmin(actx, orgID, req)
			}
		case method == "GET" && strings.HasPrefix(path, "/orgs/") && strings.HasSuffix(path, "/stats"):
			if actx, deny, ok := r.require(ctx, req, permUsersManage); !ok {
				resp, err = deny, nil
			} else {
				orgID := strings.TrimSuffix(strings.TrimPrefix(path, "/orgs/"), "/stats")
				resp, err = r.getOrgStats(actx, orgID)
			}
		case method == "GET" && strings.HasPrefix(path, "/orgs/") && strings.HasSuffix(path, "/users"):
			if actx, deny, ok := r.require(ctx, req, permUsersManage); !ok {
				resp, err = deny, nil
			} else {
				orgID := strings.TrimSuffix(strings.TrimPrefix(path, "/orgs/"), "/users")
				resp, err = r.listOrgUsers(actx, orgID)
			}
		case method == "POST" && strings.HasPrefix(path, "/orgs/") && strings.HasSuffix(path, "/users"):
			if actx, deny, ok := r.require(ctx, req, permUsersManage); !ok {
				resp, err = deny, nil
			} else {
				orgID := strings.TrimSuffix(strings.TrimPrefix(path, "/orgs/"), "/users")
				resp, err = r.createOrgUser(actx, orgID, req)
			}
		case method == "PATCH" && strings.Contains(path, "/users/") && strings.HasPrefix(path, "/orgs/"):
			if actx, deny, ok := r.require(ctx, req, permUsersManage); !ok {
				resp, err = deny, nil
			} else {
				parts := strings.Split(strings.TrimPrefix(path, "/orgs/"), "/users/")
				if len(parts) == 2 {
					resp, err = r.updateOrgUser(actx, parts[0], parts[1], req)
				} else {
					resp, err = response(400, map[string]string{"error": "invalid path"})
				}
			}
		case method == "DELETE" && strings.Contains(path, "/users/") && strings.HasPrefix(path, "/orgs/"):
			if actx, deny, ok := r.require(ctx, req, permUsersManage); !ok {
				resp, err = deny, nil
			} else {
				parts := strings.Split(strings.TrimPrefix(path, "/orgs/"), "/users/")
				if len(parts) == 2 {
					resp, err = r.deleteOrgUser(actx, parts[0], parts[1])
				} else {
					resp, err = response(400, map[string]string{"error": "invalid path"})
				}
			}
		case method == "POST" && strings.HasPrefix(path, "/orgs/") && strings.HasSuffix(path, "/invitations"):
			if actx, deny, ok := r.require(ctx, req, permUsersManage); !ok {
				resp, err = deny, nil
			} else {
				orgID := strings.TrimSuffix(strings.TrimPrefix(path, "/orgs/"), "/invitations")
				resp, err = r.inviteUser(actx, orgID, req)
			}
		case method == "GET" && path == "/users/me":
			if actx, deny, ok := r.require(ctx, req, permPatientsView); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.getUserProfile(actx)
			}
		case method == "POST" && path == "/users/me/change-password":
			if actx, deny, ok := r.require(ctx, req, permPatientsView); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.changePassword(actx, req)
			}
		case method == "POST" && path == "/auth/accept-invitation":
			resp, err = r.acceptInvitation(ctx, req)
		case method == "POST" && path == "/auth/register":
			resp, err = r.register(ctx, req)
		case method == "POST" && path == "/auth/login":
			resp, err = r.login(ctx, req)
		case method == "POST" && path == "/auth/forgot-password":
			resp, err = r.forgotPassword(ctx, req)
		case method == "POST" && path == "/auth/reset-password":
			resp, err = r.resetPassword(ctx, req)
		case method == "POST" && path == "/patients/onboard":
			if actx, deny, ok := r.require(ctx, req, permPatientsWrite); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.onboardPatient(actx, req)
			}
		case method == "GET" && path == "/patients":
			if actx, deny, ok := r.require(ctx, req, permPatientsView); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.listPatients(actx, req)
			}
		case method == "GET" && path == "/patients/search":
			if actx, deny, ok := r.require(ctx, req, permPatientsView); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.searchPatients(actx, req)
			}
		case method == "GET" && strings.HasPrefix(path, "/patients/"):
			if actx, deny, ok := r.require(ctx, req, permPatientsView); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.getPatient(actx, strings.TrimPrefix(path, "/patients/"))
			}
		case method == "PUT" && strings.HasPrefix(path, "/patients/"):
			if actx, deny, ok := r.require(ctx, req, permPatientsWrite); !ok {
				resp, err = deny, nil
			} else {
				id := strings.TrimPrefix(path, "/patients/")
				resp, err = r.updatePatient(actx, id, req)
			}
		case method == "DELETE" && strings.HasPrefix(path, "/patients/"):
			if actx, deny, ok := r.require(ctx, req, permPatientsDelete); !ok {
				resp, err = deny, nil
			} else {
				id := strings.TrimPrefix(path, "/patients/")
				resp, err = r.deletePatient(actx, id)
			}
		case method == "POST" && path == "/appointments":
			if actx, deny, ok := r.require(ctx, req, permAppointmentsWrite); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.createAppointment(actx, req)
			}
		case method == "GET" && path == "/appointments":
			if actx, deny, ok := r.require(ctx, req, permAppointmentsWrite); !ok {
				resp, err = deny, nil
			} else {
				resp, err = r.listAppointments(actx, req)
			}
		case method == "POST" && strings.HasSuffix(path, "/upload-url") && strings.HasPrefix(path, "/appointments/"):
			if actx, deny, ok := r.require(ctx, req, permTreatmentsManage); !ok {
				resp, err = deny, nil
			} else {
				id := strings.TrimSuffix(strings.TrimPrefix(path, "/appointments/"), "/upload-url")
				resp, err = r.getAppointmentUploadURL(actx, id, req)
			}
		case method == "GET" && strings.HasPrefix(path, "/appointments/"):
			if actx, deny, ok := r.require(ctx, req, permAppointmentsWrite); !ok {
				resp, err = deny, nil
			} else {
				id := strings.TrimPrefix(path, "/appointments/")
				resp, err = r.getAppointment(actx, id)
			}
		case method == "POST" && strings.HasSuffix(path, "/confirm") && strings.HasPrefix(path, "/appointments/"):
			if actx, deny, ok := r.require(ctx, req, permAppointmentsWrite); !ok {
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
			if actx, deny, ok := r.require(ctx, req, permAppointmentsWrite); !ok {
				resp, err = deny, nil
			} else {
				id := strings.TrimSuffix(strings.TrimPrefix(path, "/appointments/"), "/resend-confirmation")
				resp, err = r.resendAppointmentConfirmation(actx, id, req)
			}
		case method == "DELETE" && strings.HasPrefix(path, "/appointments/"):
			if actx, deny, ok := r.require(ctx, req, permAppointmentsDelete); !ok {
				resp, err = deny, nil
			} else {
				id := strings.TrimPrefix(path, "/appointments/")
				resp, err = r.deleteAppointment(actx, id)
			}
		case method == "PATCH" && strings.HasSuffix(path, "/payment") && strings.HasPrefix(path, "/appointments/"):
			if actx, deny, ok := r.require(ctx, req, permAppointmentsWrite); !ok {
				resp, err = deny, nil
			} else {
				id := strings.TrimSuffix(strings.TrimPrefix(path, "/appointments/"), "/payment")
				resp, err = r.registerPayment(actx, id, req)
			}
		case method == "PUT" && strings.HasPrefix(path, "/appointments/"):
			if actx, deny, ok := r.require(ctx, req, permAppointmentsWrite); !ok {
				resp, err = deny, nil
			} else {
				id := strings.TrimPrefix(path, "/appointments/")
				resp, err = r.updateAppointment(actx, id, req)
			}
		case method == "POST" && path == "/consents":
			if actx, deny, ok := r.require(ctx, req, permPatientsWrite); !ok {
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
		case method == "PUT" && strings.HasPrefix(path, "/odontograms/"):
			if actx, deny, ok := r.require(ctx, req, permTreatmentsManage); !ok {
				resp, err = deny, nil
			} else {
				id := strings.TrimPrefix(path, "/odontograms/")
				if req.PathParameters == nil {
					req.PathParameters = make(map[string]string)
				}
				if strings.HasSuffix(id, "/tooth-condition") {
					req.PathParameters["odontogramId"] = strings.TrimSuffix(id, "/tooth-condition")
					resp, err = r.odontogram.UpdateToothCondition(actx, req)
				} else {
					req.PathParameters["odontogramId"] = id
					resp, err = r.odontogram.UpdateOdontogram(actx, req)
				}
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

func (r *Router) platformBootstrap(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in struct {
		Secret   string `json:"secret"`
		Email    string `json:"email"`
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	out, err := r.auth.BootstrapPlatformAdmin(ctx, service.BootstrapPlatformAdminInput(in))
	if err != nil {
		return response(401, map[string]string{"error": err.Error()})
	}
	return response(200, out)
}

func (r *Router) listOrgUsers(ctx context.Context, orgID string) (events.APIGatewayV2HTTPResponse, error) {
	users, err := r.auth.ListOrgUsers(ctx, orgID)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(200, map[string]interface{}{"items": users})
}

func (r *Router) updateOrgUser(ctx context.Context, orgID, userID string, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in service.UpdateOrgUserInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	in.OrgID = orgID
	in.UserID = userID
	user, err := r.auth.UpdateOrgUser(ctx, in)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(200, user)
}

func (r *Router) deleteOrgUser(ctx context.Context, orgID, userID string) (events.APIGatewayV2HTTPResponse, error) {
	if err := r.auth.DeleteOrgUser(ctx, orgID, userID); err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(200, map[string]string{"deleted": userID})
}

func (r *Router) changePassword(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in service.ChangePasswordInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	auth, _ := ctx.Value(ctxAuthKey).(service.Authenticated)
	in.UserID = auth.User.ID
	if err := r.auth.ChangePassword(ctx, in); err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(200, map[string]string{"ok": "password changed"})
}

func (r *Router) inviteUser(ctx context.Context, orgID string, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in service.InviteUserInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	in.OrgID = orgID
	auth, _ := ctx.Value(ctxAuthKey).(service.Authenticated)
	if in.InvitedBy == "" && auth.User.ID != "" {
		in.InvitedBy = auth.User.ID
	}
	out, err := r.auth.InviteUser(ctx, in)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(201, out)
}

func (r *Router) acceptInvitation(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in service.AcceptInvitationInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	out, err := r.auth.AcceptInvitation(ctx, in)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(200, out)
}

func (r *Router) getOrganization(ctx context.Context, orgID string) (events.APIGatewayV2HTTPResponse, error) {
	org, err := r.auth.GetOrganization(ctx, orgID)
	if err != nil {
		return response(404, map[string]string{"error": err.Error()})
	}
	return response(200, org)
}

func (r *Router) updateOrganization(ctx context.Context, orgID string, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in service.UpdateOrganizationInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	org, err := r.auth.UpdateOrganization(ctx, orgID, in)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(200, org)
}

func (r *Router) deleteOrganization(ctx context.Context, orgID string) (events.APIGatewayV2HTTPResponse, error) {
	if err := r.auth.DeleteOrganization(ctx, orgID); err != nil {
		return response(404, map[string]string{"error": err.Error()})
	}
	return response(200, map[string]string{"status": "deleted"})
}

func (r *Router) getPlatformStats(ctx context.Context) (events.APIGatewayV2HTTPResponse, error) {
	stats, err := r.auth.GetPlatformStats(ctx)
	if err != nil {
		return response(500, map[string]string{"error": err.Error()})
	}
	return response(200, stats)
}

func (r *Router) getOrgStats(ctx context.Context, orgID string) (events.APIGatewayV2HTTPResponse, error) {
	stats, err := r.auth.GetOrgStats(ctx, orgID)
	if err != nil {
		return response(500, map[string]string{"error": err.Error()})
	}
	return response(200, stats)
}

func (r *Router) getUserProfile(ctx context.Context) (events.APIGatewayV2HTTPResponse, error) {
	auth := ctx.Value(ctxAuthKey).(service.Authenticated)
	profile, err := r.auth.GetUserProfile(ctx, auth.User.ID)
	if err != nil {
		return response(404, map[string]string{"error": err.Error()})
	}
	return response(200, profile)
}

func (r *Router) createOrganization(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in service.CreateOrganizationInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	org, err := r.auth.CreateOrganization(ctx, in)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(201, org)
}

func (r *Router) listOrganizations(ctx context.Context) (events.APIGatewayV2HTTPResponse, error) {
	orgs, err := r.auth.ListOrganizations(ctx)
	if err != nil {
		return response(500, map[string]string{"error": err.Error()})
	}
	return response(200, map[string]interface{}{"items": orgs})
}

func (r *Router) createOrgUser(ctx context.Context, orgID string, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in service.CreateOrgUserInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	in.OrgID = orgID
	user, err := r.auth.CreateOrgUser(ctx, in)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(201, user)
}

func (r *Router) createOrgAdmin(ctx context.Context, orgID string, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in service.CreateOrgAdminInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	in.OrgID = orgID
	user, err := r.auth.CreateOrgAdmin(ctx, in)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(201, map[string]string{
		"userId": user.ID,
		"email":  user.Email,
		"role":   user.Role,
	})
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
	patientID := req.QueryStringParameters["patientId"]
	if patientID != "" {
		items, err := r.appointments.ListByPatient(ctx, patientID)
		if err != nil {
			return response(400, map[string]string{"error": err.Error()})
		}
		if items == nil {
			items = []domain.Appointment{}
		}
		return response(200, map[string]any{"items": items})
	}
	doctorID := req.QueryStringParameters["doctorId"]
	date := req.QueryStringParameters["date"]
	items, err := r.appointments.ListByDoctorAndDate(ctx, doctorID, date)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	if items == nil {
		items = []domain.Appointment{}
	}
	return response(200, map[string]any{"items": items})
}

func (r *Router) getAppointment(ctx context.Context, id string) (events.APIGatewayV2HTTPResponse, error) {
	item, err := r.appointments.GetByID(ctx, id)
	if err != nil {
		return response(404, map[string]string{"error": err.Error()})
	}
	return response(200, item)
}

func (r *Router) deleteAppointment(ctx context.Context, id string) (events.APIGatewayV2HTTPResponse, error) {
	if err := r.appointments.Delete(ctx, id); err != nil {
		return response(404, map[string]string{"error": err.Error()})
	}
	return response(200, map[string]string{"status": "deleted"})
}

func (r *Router) updateAppointment(ctx context.Context, id string, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	var in service.UpdateAppointmentInput
	if err := json.Unmarshal([]byte(req.Body), &in); err != nil {
		return response(400, map[string]string{"error": "invalid_json"})
	}
	appt, err := r.appointments.UpdateAppointment(ctx, id, in)
	if err != nil {
		return response(400, map[string]string{"error": err.Error()})
	}
	return response(200, appt)
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
			"Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		},
	}, nil
}

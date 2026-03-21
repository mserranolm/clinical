# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Serverless clinical management system (odontology-focused, multi-tenant) with a Go Lambda backend and React/TypeScript frontend deployed on AWS.

## Agents & Skills

### Agents (`.claude/agents/`)

Invoke with `@agent-name` to get specialized context for a task:

| Agent | Cuándo usarlo |
|---|---|
| `@backend-engineer` | Endpoints Go, modelos, DynamoDB, RBAC, tests, Lambda |
| `@frontend-engineer` | Páginas React, componentes, API client, TypeScript, rutas |
| `@qa-engineer` | Tests Go, cobertura, edge cases clínicos, multi-tenant isolation |
| `@devops` | SAM deploy, CloudFormation, Lambda, CORS, CloudWatch, CodePipeline |

### Skills (slash commands)

| Comando | Descripción |
|---|---|
| `/scaffold-module <nombre>` | Genera módulo completo (backend Go + frontend React) siguiendo patrones del proyecto |
| `/deploy-backend` | Flujo completo de deploy (tests → build → sam deploy → fix CORS) |
| `/build-test [backend\|frontend]` | Compila y ejecuta tests; detecta errores antes de deploy |
| `/db-pattern <entidad>` | Diseña patrón DynamoDB (struct + interfaz repo + implementación) |
| `/triage-bug <descripción>` | Triagea un bug: causa raíz + plan de fix + test de regresión |

## Commands

### Backend (`backend/`)

```bash
# Run all tests
go test ./...

# Run a single test
go test ./internal/service/... -run TestFunctionName

# Build local binary (host architecture)
make build          # produces ./api

# Build for Lambda (arm64 Linux)
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -o bootstrap ./cmd/api

# SAM build (runs make build-ClinicalApiFunction internally)
sam build

# Deploy via SAM (use with care — affects live infra)
sam deploy

# Run local HTTP server (uses in-memory store by default)
LOCAL_HTTP=true go run ./cmd/api

# Lint (requires golangci-lint)
golangci-lint run ./...
```

**After every `sam deploy`**, run `scripts/fix-apigw-after-deploy.sh` to restore CORS settings.

### Frontend (`frontend/react-app/`)

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc + vite build → dist/
```

Dev server proxies `/api/*` to the backend (configured via `VITE_API_BASE_URL` env var).

## Architecture

### Backend

Single Go binary (`./cmd/api`) deployed as three Lambda functions sharing the same code, differentiated by the event type they receive:

- **ClinicalApiFunction** — handles all HTTP requests from API Gateway V2
- **Reminder24hFunction** — EventBridge cron (every 15 min) for appointment reminders
- **EndOfDayFunction** — EventBridge daily at 22:00 for end-of-day processing

The Lambda entry point (`cmd/api/main.go`) detects the event type via JSON unmarshaling and routes accordingly. When `LOCAL_HTTP=true`, it starts a plain HTTP server instead.

**Layer stack** (top-down):
1. `internal/api/router.go` — HTTP routing, JWT auth middleware, RBAC enforcement
2. `internal/service/` — Business logic (appointment, patient, consent, auth, odontogram, treatment plan)
3. `internal/store/dynamodb.go` — DynamoDB repositories (package `store`)
4. `internal/store/in_memory.go` — In-memory fallback for local dev (used when `ShouldUseDynamoDB()` returns false)

**RBAC** is enforced in `router.go` via `hasPermission(role, permission)`. Roles: `platform_admin`, `admin`, `doctor`, `assistant`. Permission constants are defined at the top of `router.go`.

**Notifications** (`internal/notifications/`) route through SNS (SMS) or SES (email) depending on the delivery method. SMS messages use Transactional type.

**DynamoDB tables** (8): appointments, patients, consents, consent-templates, odontograms, treatment-plans, users. All use PAY_PER_REQUEST billing.

**Config** (`internal/config/`) reads env vars. `cfg.ShouldUseDynamoDB()` returns true in Lambda or when `USE_DYNAMODB=true` locally. `cfg.IsLocal()` enables AWS named profile authentication.

### Frontend

React 18 SPA with React Router v6. Feature-organized under `src/modules/` (appointments, patients, consents, odontogram); route-level pages under `src/pages/`.

**Path aliases**: `@/` → `src/`, `@pages/`, `@components/`, `@modules/`, `@lib/`, `@api/`

**API client**: `src/api/clinical.ts` — single file with all backend calls. Uses `src/lib/http.ts` for the fetch wrapper.

**RBAC helpers**: `src/lib/rbac.ts` — mirrors backend roles on the frontend.

**Shared constants**: `src/lib/constants.ts` — `TIME_SLOTS`, `DURATION_BLOCKS`, `AUTO_REFRESH_OPTS`, `fmtTimeSlot()`.

**3D odontogram**: uses `@react-three/fiber` + `@react-three/drei` + `three.js`.

### Infrastructure

- `backend/template.yaml` — SAM template defining all Lambda functions, DynamoDB tables, API Gateway, IAM policies, and EventBridge schedules
- `backend/buildspec.yml` — CodeBuild spec: lint → test → `sam build` → `sam deploy` (main/develop branches only)
- `infrastructure/backend-pipeline.yaml` — CodePipeline stack (Source → Build → Deploy)
- `infrastructure/frontend-pipeline.yaml` — CodePipeline stack for frontend S3/CloudFront deployment
- `scripts/` — helper scripts for deploying pipelines, fixing API GW CORS, resetting dev DB

### Key design constraints

- API Gateway uses **HTTP API (V2)** format (`events.APIGatewayV2HTTPRequest`), but the template defines a REST API — the Lambda handler converts V1↔V2 as needed
- Lambda runtime: `provided.al2023`, architecture: `arm64` — binary must be named `bootstrap`
- Public endpoints (no auth): `GET /health`, `POST /auth/*`, `POST /platform/bootstrap`, `POST /public/consents/:id/accept`, `POST /public/appointments/:id/confirm`
- `OrgID` is derived from the JWT token, not the request body, to prevent cross-tenant data access

## AWS Credentials

- **Cuenta:** 975738006503
- **Profile:** `aski` (puede estar comentado en `~/.aws/config`)
- **Para deployar:** descomentar profile aski + `aws sso login --profile aski`
- **SAM:** usar `sam deploy --profile aski` explícito (samconfig.toml no especifica profile)

# Clinical Backend (AWS Serverless + Go)

Backend inicial para gestión clínica (odontología adaptable a otras especialidades) diseñado para correr en AWS **100% serverless**.

## Stack

- AWS Lambda (Go)
- API Gateway HTTP API
- DynamoDB (PAY_PER_REQUEST)
- EventBridge Scheduler (recordatorios)
- SNS/SES (integración sugerida para SMS/email)
- S3 (sugerido para imágenes de pacientes)

## Módulos incluidos

1. Onboarding de pacientes
2. Agenda por doctor + control de citas
3. Recordatorio de cita 24h antes (SMS/email configurable por flags)
4. Confirmación de cita por paciente
5. Cierre de agenda del doctor al final del día
6. Evolución por cita + registro de pago
7. Consentimiento informado por SMS/email

## Variables de entorno

- `ENVIRONMENT` (ej: dev/prod)
- `APPOINTMENT_TABLE`
- `PATIENT_TABLE`
- `CONSENT_TABLE`
- `SEND_SMS=true|false`
- `SEND_EMAIL=true|false`

## Endpoints iniciales

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /patients/onboard`
- `GET /patients/{id}`
- `POST /appointments`
- `GET /appointments?doctorId={doctorId}&date=YYYY-MM-DD`
- `POST /appointments/{id}/confirm`
- `POST /appointments/{id}/close-day`
- `POST /appointments/{id}/send-reminder`
- `POST /doctors/{doctorId}/end-day-reminder`
- `POST /consents`
- `POST /consents/{id}/accept`

## Despliegue (SAM)

```bash
sam build
sam deploy --guided
```

## Ejecución local sin Docker (recomendada si SAM local falla por ECR)

```bash
LOCAL_HTTP=true LOCAL_HTTP_PORT=3000 go run ./cmd/api
```

Esto levanta la API en `http://127.0.0.1:3000` sin contenedores.

## Nota de producción

Este arranque usa repositorios en memoria para acelerar el inicio. El siguiente paso es reemplazar `internal/store` por repositorios DynamoDB + S3 y conectar notificaciones reales (SNS/SES).

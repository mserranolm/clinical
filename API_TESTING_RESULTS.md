# 🧪 Clinical API Testing Results

## 📊 Overview

**API URL**: `https://egsnzyxipf.execute-api.us-east-1.amazonaws.com/prod`  
**API Gateway Type**: REST API (API Key required)  
**Test Date**: 2026-02-19  
**Status**: ✅ API protegida con `x-api-key` + frontend configurado para enviar API Key

## 🔐 API Key Usage

Para todas las pruebas manuales usa:

```bash
export API_URL="https://egsnzyxipf.execute-api.us-east-1.amazonaws.com/prod"
export API_KEY="<TU_API_KEY>"
```

> Nota: sin `x-api-key` la API responde `403 Forbidden`.

## ✅ Working Endpoints (con API Key)

### 1. Health Check
```bash
curl -X GET "$API_URL/health" \
  -H "x-api-key: $API_KEY"
```

### 2. Patient Onboarding
```bash
curl -X POST "$API_URL/patients/onboard" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"doctorId":"doc-123","firstName":"Juan","lastName":"Pérez","email":"juan@test.com","phone":"+34666777888","birthDate":"1990-05-15"}'
```

### 3. Get Patient by ID
```bash
curl -X GET "$API_URL/patients/{patientId}" \
  -H "x-api-key: $API_KEY"
```

### 4. Create Appointment
```bash
curl -X POST "$API_URL/appointments" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"patientId":"pat_*","doctorId":"doc-123","startAt":"2026-02-20T10:00:00Z","endAt":"2026-02-20T10:30:00Z","type":"consultation","notes":"Primera consulta"}'
```

### 5. Confirm Appointment
```bash
curl -X POST "$API_URL/appointments/{appointmentId}/confirm" \
  -H "x-api-key: $API_KEY"
```

### 6. Register User
```bash
curl -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"name":"Dr Smith","email":"doctor@test.com","password":"SecurePass123!"}'
```

### 7. Login User
```bash
curl -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"email":"doctor@test.com","password":"SecurePass123!"}'
```

## ⚠️ Endpoints Needing Fixes

### 1. List Appointments
```bash
curl -X GET "$API_URL/appointments?doctorId=doc-123&date=2026-02-20" \
  -H "x-api-key: $API_KEY"
```
**Error**: DynamoDB query validation error - missing KeyConditions or KeyConditionExpression

### 2. Get Odontogram by Patient
```bash
curl -X GET "$API_URL/odontograms/patient/{patientId}" \
  -H "x-api-key: $API_KEY"
```
**Error**: revisar implementación del endpoint en backend

### 3. Treatment Plans
```bash
curl -X POST "$API_URL/treatment-plans" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"patientId":"pat_*","doctorId":"doc-123","title":"Plan de Tratamiento"}'
```
**Error**: odontogramId is required

## 🧩 Frontend Integration (API Key)

El frontend ya está configurado para enviar API Key automáticamente en cada request:

- Header `x-api-key` en cliente HTTP: `frontend/react-app/src/lib/http.ts`
- URL base de producción: `frontend/react-app/src/lib/config.ts`
- Variables de entorno:
  - `frontend/react-app/.env`
  - `frontend/react-app/.env.example`

Variables necesarias:

```env
VITE_API_BASE_URL=https://egsnzyxipf.execute-api.us-east-1.amazonaws.com/prod
VITE_API_KEY=<TU_API_KEY>
```

## 🚀 Deployment Info

- **Region**: us-east-1
- **Stack Name**: clinical-backend
- **API Gateway Type**: REST API
- **Security**: API Key + Usage Plan (100 llamadas por día)

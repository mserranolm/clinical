# Clinical Frontend

Este directorio mantiene:

1. `index.html` y `src/` legacy (MVP vanilla JS)
2. `react-app/` (nuevo frontend React + TypeScript)

## Nuevo frontend React

Ruta: `frontend/react-app`

### Endpoints publicados tomados como base

- `https://cyey5rzsi3.execute-api.us-east-1.amazonaws.com` (ver `API_TESTING_RESULTS.md`)

### Configuración de API

El frontend React permite configurar el backend de 2 formas:

1. `.env` con `VITE_API_BASE_URL`
2. Runtime desde UI (se guarda en `localStorage` como `clinical_api_base_url`)

### Comandos

```bash
cd frontend/react-app
npm install
npm run dev
```

### Funcionalidades conectadas

- Registro/Login/Forgot/Reset
- Onboarding paciente
- Crear cita
- Crear consentimiento
- Crear odontograma
- Crear plan de tratamiento
- Health check + actividad

> Nota: en backend actual, el doctor se registra como usuario y el `userId` se usa como `doctorId`.
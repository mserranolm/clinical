# Clinical Frontend React

Frontend React + TypeScript para integrar las funcionalidades del backend Go publicado en AWS.

## Endpoints publicados (backend)

Se toma como referencia `API_TESTING_RESULTS.md` y su API base publicada:

- `https://cyey5rzsi3.execute-api.us-east-1.amazonaws.com`

## Configuración de API (requerida)

Este frontend permite configurar la URL del backend de dos formas:

1. **Variable de entorno (build-time)**
   - Copia `.env.example` a `.env`
   - Define `VITE_API_BASE_URL`

2. **Override en runtime (sin rebuild)**
   - Desde la UI, en el campo `Guardar API URL`
   - Se guarda en `localStorage` con clave `clinical_api_base_url`

Prioridad de resolución:

1. `localStorage.clinical_api_base_url`
2. `VITE_API_BASE_URL`
3. fallback: URL publicada en producción / localhost en desarrollo

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Arquitectura UI implementada

1. Landing page pública (visual y comercial)
2. Login/registro
3. Dashboard administrador autenticado con menú lateral
4. Páginas por módulo:
   - Dashboard (vista ejecutiva)
   - Pacientes
   - Citas
   - Consentimientos
   - Odontograma
   - Planes de tratamiento
   - Service Tester (módulo de pruebas)

## Cobertura funcional conectada al backend

- Auth: register, login, forgot, reset
- Pacientes: onboarding
- Citas: crear
- Consentimientos: crear
- Odontograma: crear
- Planes de tratamiento: crear
- Health check y logging en módulo Service Tester

## Nota

El backend actual registra doctor como usuario (`/auth/register`) y el `userId` se reutiliza como `doctorId`.

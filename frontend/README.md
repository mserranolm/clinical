# Clinical Frontend

React + TypeScript frontend for the clinical management system.

## Setup de desarrollo

**Requisitos**: Node.js 18+ and npm.

```bash
cd frontend/react-app
npm install
npm run dev        # http://localhost:5173
```

## Estructura de carpetas

```
frontend/react-app/
├── src/
│   ├── api/           # API client (clinical.ts)
│   ├── components/    # Shared UI components and layout
│   ├── lib/           # Utilities: rbac, datetime, session, http, notify, constants
│   ├── modules/       # Feature modules (appointments, patients, etc.)
│   ├── pages/         # Route-level page components
│   ├── types.ts       # Shared TypeScript types
│   └── App.tsx        # Router and auth shell
├── tsconfig.json      # TypeScript config (includes path aliases)
└── vite.config.ts     # Vite config (includes path aliases)
```

### Path aliases

The project uses TypeScript path aliases for clean imports:

| Alias          | Resolves to         |
|----------------|---------------------|
| `@/*`          | `src/*`             |
| `@pages/*`     | `src/pages/*`       |
| `@components/*`| `src/components/*`  |
| `@modules/*`   | `src/modules/*`     |
| `@lib/*`       | `src/lib/*`         |
| `@api/*`       | `src/api/*`         |

## Variables de entorno

Create `frontend/react-app/.env` (optional — API URL can also be set at runtime from the UI):

```env
VITE_API_BASE_URL=https://<api-id>.execute-api.us-east-1.amazonaws.com/prod
VITE_API_KEY=your-api-key
```

At runtime the UI falls back to `clinical_api_base_url` stored in localStorage.

## Build y deploy

```bash
cd frontend/react-app
npm run build          # outputs to dist/
```

Deploy is automated via AWS CodePipeline. See `../scripts/deploy-frontend-pipeline.sh`.

## Features principales

- **Autenticación**: registro, login, recuperación y reset de contraseña
- **Dashboard**: agenda del día con auto-refresh configurable
- **Citas**: vista de calendario/lista con creación y edición inline
- **Pacientes**: onboarding, historial clínico, odontograma y plan de tratamiento
- **Consentimientos**: plantillas y firma digital por el paciente
- **Admin de organización**: gestión de usuarios e invitaciones
- **Platform admin**: gestión multi-tenant de organizaciones

## RBAC

Roles: `platform_admin`, `admin`, `doctor`, `assistant`.
Permission helpers live in `src/lib/rbac.ts`.

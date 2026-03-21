---
description: Compila y ejecuta tests del backend Go y/o frontend React. Detecta errores antes de hacer deploy.
---

Ejecuta el flujo de build y test para el sistema clínico.

## Instrucciones

Ejecuta los siguientes pasos según el scope solicitado: $ARGUMENTS

Si no se especifica scope, ejecuta **backend + frontend**.

---

## BACKEND (directorio `backend/`)

### Paso 1 — Tests Go
```bash
cd backend
go test ./... -timeout 60s
```

Si hay tests fallando, **muestra los errores exactos** y detente. No continúes con el build.

### Paso 2 — Build local
```bash
make build
```

Verifica que produce el binario `./api` sin errores.

### Paso 3 — Lint (si golangci-lint disponible)
```bash
golangci-lint run ./...
```

---

## FRONTEND (directorio `frontend/react-app/`)

### Paso 1 — Type check TypeScript
```bash
cd frontend/react-app
npx tsc --noEmit
```

### Paso 2 — Build
```bash
npm run build
```

Verifica que produce `dist/` sin errores de compilación.

---

## Reporte final

Al terminar, muestra un resumen:

| Paso | Estado | Detalle |
|---|---|---|
| Go tests | ✓/✗ | N tests pasados / errores |
| Go build | ✓/✗ | binario ./api generado |
| Go lint | ✓/✗ | N warnings/errors |
| TS type check | ✓/✗ | N errores de tipos |
| Frontend build | ✓/✗ | dist/ generado |

Si algo falló, muestra el **error exacto** y sugiere cómo corregirlo.

**No ejecutes `sam deploy` ni subas nada** — este skill es solo para verificación local.

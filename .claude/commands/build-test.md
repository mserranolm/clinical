---
description: Compila y ejecuta tests del backend Go y/o frontend React. Uso: /build-test [backend|frontend]
---

Ejecuta build y tests para verificar el estado del código antes de hacer deploy. Scope: $ARGUMENTS

## BACKEND

```bash
cd backend
go test ./... -timeout 60s
```

Si hay tests fallando, muestra los errores exactos y detente.

```bash
make build
```

Verifica que produce el binario `./api`.

```bash
golangci-lint run ./...
```

(Solo si golangci-lint está instalado)

## FRONTEND

```bash
cd frontend/react-app
npx tsc --noEmit
npm run build
```

## Reporte final

Muestra tabla resumen:

| Paso | Estado | Detalle |
|---|---|---|
| Go tests | ✓/✗ | N tests / errores |
| Go build | ✓/✗ | binario ./api |
| Go lint | ✓/✗ | warnings |
| TS types | ✓/✗ | errores de tipos |
| Frontend build | ✓/✗ | dist/ generado |

**No ejecutes `sam deploy`** — este comando es solo verificación local.

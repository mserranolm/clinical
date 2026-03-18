---
description: Ejecuta el flujo completo de deploy del backend (tests → build → sam deploy → fix CORS). Uso: /deploy-backend [--skip-tests] [--env staging|prod]
---

Ejecuta el flujo de deploy del backend de forma segura. Argumentos: $ARGUMENTS

## Flujo de deploy

### PASO 0 — Verificar estado del repo

Antes de cualquier cosa, ejecuta:
```bash
git status
git diff --stat HEAD
```

Si hay cambios sin commitear **detente y pregunta** al usuario si quiere continuar o commitear primero.

### PASO 1 — Verificar que estás en el directorio correcto

```bash
cd backend
```

### PASO 2 — Ejecutar tests (a menos que se pase `--skip-tests`)

```bash
go test ./... -timeout 60s
```

Si los tests fallan, **detente y reporta los errores**. No continúes con el deploy.

### PASO 3 — Verificar build local

```bash
make build
```

Si el build falla, **detente y reporta los errores**.

### PASO 4 — SAM build (para Lambda arm64)

```bash
sam build
```

Este paso compila para `GOOS=linux GOARCH=arm64 CGO_ENABLED=0` y produce el binario `bootstrap`.

### PASO 5 — Confirmación antes de deploy

**SIEMPRE pregunta al usuario antes de ejecutar `sam deploy`**. Muestra:
- Branch actual
- Último commit
- Entorno destino (staging/prod)

Espera confirmación explícita.

### PASO 6 — SAM deploy

```bash
sam deploy
```

Monitorea el output. Si hay errores de CloudFormation, reporta el mensaje exacto.

### PASO 7 — Fix CORS post-deploy (OBLIGATORIO)

Este paso es **crítico** — sin él el frontend no puede comunicarse con la API:

```bash
cd ..
./scripts/fix-apigw-after-deploy.sh
```

### PASO 8 — Verificación de salud

```bash
# Verificar que el endpoint de health responde
curl -s $(aws apigatewayv2 get-apis --query 'Items[?Name==`ClinicalApi`].ApiEndpoint' --output text)/health
```

### Reporte final

Al terminar, muestra un resumen con:
- ✓/✗ Tests pasados
- ✓/✗ Build exitoso
- ✓/✗ SAM deploy completado
- ✓/✗ CORS fix aplicado
- ✓/✗ Health check OK
- URL del endpoint desplegado
- Tiempo total del deploy

Si algo falló, muestra el error exacto y **no marques ese paso como exitoso**.

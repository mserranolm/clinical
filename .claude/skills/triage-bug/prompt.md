---
description: Triagea un bug del sistema clínico: explora el código para encontrar la causa raíz, evalúa el impacto y propone un plan de fix con tests.
---

Triagea el siguiente bug del sistema clínico:

$ARGUMENTS

## Tu proceso

### Paso 1 — Entender el síntoma

Resume el bug en una oración:
- **Qué falla:** comportamiento observado
- **Qué se esperaba:** comportamiento correcto
- **Quién es afectado:** rol/módulo/entidad

### Paso 2 — Explorar el código

Lee los archivos relevantes para encontrar la causa raíz:

1. Si es un bug de **API/HTTP**: empieza en `backend/internal/api/router.go`
2. Si es un bug de **lógica de negocio**: busca en `backend/internal/service/`
3. Si es un bug de **datos/DynamoDB**: busca en `backend/internal/store/dynamodb.go`
4. Si es un bug de **frontend**: busca en `frontend/react-app/src/`
5. Si es un bug de **RBAC**: busca en `router.go` → `hasPermission()`
6. Si es un bug de **multi-tenancy**: verifica que `OrgID` venga del JWT

### Paso 3 — Identificar la causa raíz

Señala la línea exacta (archivo:línea) donde está el bug. Tipos comunes:

- **RBAC incorrecto** — permiso mal asignado a rol
- **Validación faltante** — falta verificar campo requerido
- **OrgID incorrecto** — se usa del body en vez del JWT
- **Query DynamoDB** — PK incorrecto o filtro erróneo
- **Estado de cita** — transición de estado inválida
- **Fecha/timezone** — error en formato de fecha (RFC3339 requerido)
- **CORS** — falta ejecutar fix-apigw-after-deploy.sh
- **TypeScript** — tipo incorrecto en API client o componente

### Paso 4 — Evaluar impacto

| Dimensión | Evaluación |
|---|---|
| Severidad | P0 (datos incorrectos) / P1 (feature rota) / P2 (UX degradada) / P3 (cosmético) |
| Módulos afectados | Lista de módulos/rutas impactados |
| Riesgo de regresión | Alto / Medio / Bajo |
| Requiere migración de datos | Sí / No |

### Paso 5 — Plan de fix

Propón el fix mínimo necesario:

1. **Archivo a modificar:** `ruta/al/archivo.go`
2. **Cambio:** describe qué líneas cambiar y cómo
3. **Test de regresión:** qué test escribir para prevenir que vuelva
4. **Verificación:** cómo probar que el fix funciona localmente

### Paso 6 — Recomendación de test

```go
// Test de regresión sugerido
func Test[Módulo]_[EscenarioBug](t *testing.T) {
    // Arrange: setup que reproduce el bug
    // Act: acción que lo triggereaba
    // Assert: verificar comportamiento correcto
}
```

## Formato de reporte

```
## Bug Report

**Síntoma:** [descripción una línea]
**Causa raíz:** [archivo:línea — explicación técnica]
**Severidad:** P[0-3]

## Fix propuesto

[código del fix]

## Test de regresión

[código del test]

## Pasos para verificar

1. [paso 1]
2. [paso 2]
```

## Principios

- **Causa raíz, no síntoma** — no parchear el síntoma si puedes corregir la causa
- **Fix mínimo** — el cambio más pequeño que soluciona el problema
- **Siempre test** — todo bug corregido lleva test de regresión
- **Seguridad primero** — si el bug involucra datos de pacientes, es P0 automáticamente

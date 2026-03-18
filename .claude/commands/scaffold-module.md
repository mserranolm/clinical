---
description: Genera un módulo clínico completo (backend Go + frontend React) siguiendo los patrones del proyecto. Uso: /scaffold-module <nombre> [descripción breve]
---

Genera un módulo completo para el sistema clínico. El módulo se llama: $ARGUMENTS

## Tu tarea

Crea todos los archivos necesarios para un nuevo módulo siguiendo los patrones exactos del proyecto. Antes de escribir nada, lee los siguientes archivos para entender los patrones actuales:

1. Lee `backend/internal/service/patient_service.go` — patrón de servicio Go
2. Lee `backend/internal/domain/models.go` — cómo se definen los modelos
3. Lee `backend/internal/store/dynamodb.go` (primeras 200 líneas) — cómo se implementan los repositorios
4. Lee `backend/internal/store/repositories.go` (primeras 150 líneas) — cómo se definen las interfaces
5. Lee `backend/internal/api/router.go` (primeras 100 líneas) — cómo se registran las rutas
6. Lee `frontend/react-app/src/api/clinical.ts` (primeras 80 líneas) — patrón del API client
7. Lee `frontend/react-app/src/pages/Patients/PatientsPage.tsx` — patrón de página React

Luego genera los siguientes archivos:

### 1. Modelo de dominio
Añade el struct al archivo `backend/internal/domain/models.go`. Diseña campos razonables basándote en el nombre del módulo.

### 2. Interfaz del repositorio
Añade la interfaz `[Nombre]Repository` al archivo `backend/internal/store/repositories.go` con métodos CRUD estándar:
- `Create(ctx, orgID string, item *domain.[Nombre]) error`
- `Get(ctx, orgID, id string) (*domain.[Nombre], error)`
- `List(ctx, orgID string) ([]*domain.[Nombre], error)`
- `Update(ctx, orgID string, item *domain.[Nombre]) error`
- `Delete(ctx, orgID, id string) error`

### 3. Implementación DynamoDB
Crea `backend/internal/store/dynamodb_[nombre].go` (en minúsculas, snake_case) con la implementación concreta usando DynamoDB. Sigue exactamente el mismo patrón que `dynamodb.go`:
- Tabla: `[nombre]s`
- PK: `orgID#[id]`
- Usa `attributevalue.MarshalMap` / `UnmarshalMap`

### 4. Servicio de negocio
Crea `backend/internal/service/[nombre]_service.go` con:
- Struct `[Nombre]Service` con dependencia al repo
- Constructor `New[Nombre]Service`
- Métodos CRUD con validaciones básicas
- Generación de ID con `uuid.NewString()`

### 5. Handlers HTTP en el router
Muestra exactamente **qué agregar** en `backend/internal/api/router.go`:
- Las rutas a agregar (GET list, GET by id, POST create, PUT update, DELETE)
- Los handler functions correspondientes
- El RBAC apropiado (usa roles existentes: `admin`, `doctor`, `assistant`)

**No modifiques `router.go` directamente** — muestra el código a insertar y di en qué línea aproximada va.

### 6. Tipos TypeScript
Crea `frontend/react-app/src/types/[nombre].ts` con las interfaces TypeScript que correspondan al modelo Go.

### 7. Funciones API client
Muestra qué agregar en `frontend/react-app/src/api/clinical.ts`:
- `list[Nombre]s()` — GET /[nombre]s
- `get[Nombre](id)` — GET /[nombre]s/:id
- `create[Nombre](data)` — POST /[nombre]s
- `update[Nombre](id, data)` — PUT /[nombre]s/:id
- `delete[Nombre](id)` — DELETE /[nombre]s/:id

### 8. Página React
Crea `frontend/react-app/src/pages/[Nombre]/[Nombre]Page.tsx` con:
- Layout con `DashboardLayout`
- Tabla con listado de items
- Botón para crear nuevo
- Modal o sección para crear/editar
- Manejo de loading/error
- Dark mode (usa clases Tailwind del proyecto)

### 9. Registro de ruta
Muestra qué agregar en `frontend/react-app/src/App.tsx` para registrar la nueva ruta.

### 10. Resumen final
Al terminar, muestra:
- Lista de archivos creados/modificados
- Comandos para probar localmente (backend y frontend)
- Si hay alguna tabla DynamoDB nueva a crear, menciona que hay que añadirla al `backend/template.yaml`

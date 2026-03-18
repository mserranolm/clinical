# Prompt para Claude Code: Implementar Docco Chatbot

## Contexto del Proyecto

Este es un sistema clínico odontológico serverless multi-tenant con backend Go Lambda y frontend React/TypeScript desplegado en AWS. Lee el `CLAUDE.md` para entender la arquitectura completa.

Necesito implementar **Docco**, un chatbot asistente inteligente integrado en el frontend que responde preguntas del usuario consultando datos reales de la base de datos (citas, pacientes, pagos, presupuestos, tratamientos, odontogramas) usando **Amazon Bedrock (Claude)** como motor de IA.

---

## Arquitectura de Docco

### Flujo completo:

```
Usuario escribe mensaje → Frontend envía POST /chat → Backend Go recibe →
→ Consulta datos relevantes de DynamoDB según contexto del usuario (orgID, doctorID, role) →
→ Construye prompt con datos + pregunta del usuario →
→ Llama a Amazon Bedrock (Claude 3 Sonnet/Haiku) →
→ Devuelve respuesta en lenguaje natural al frontend → Se muestra en el chat
```

---

## PARTE 1: Backend Go

### 1.1 Nuevo servicio: `internal/service/chat_service.go`

```go
// ChatService maneja la lógica del chatbot Docco
type ChatService struct {
    appointmentRepo store.AppointmentRepository
    patientRepo     store.PatientRepository
    paymentRepo     store.PaymentRepository
    budgetRepo      store.BudgetRepository
    treatmentRepo   store.TreatmentPlanRepository
    odontogramRepo  store.OdontogramRepository
    bedrockClient   BedrockClient
}
```

**Responsabilidades:**
- Recibir el mensaje del usuario + metadata (orgID, userID, role del JWT)
- Recopilar contexto de datos relevante consultando DynamoDB:
  - Citas de hoy y próximos 7 días del doctor
  - Resumen de pacientes recientes
  - Pagos pendientes
  - Presupuestos activos
- Construir un **system prompt** que incluya los datos como contexto
- Invocar Bedrock y devolver la respuesta

**Estructura del request/response:**

```go
type ChatRequest struct {
    Message string `json:"message"`
    // El conversationHistory es opcional para mantener contexto multi-turn
    ConversationHistory []ChatMessage `json:"conversationHistory,omitempty"`
}

type ChatMessage struct {
    Role    string `json:"role"`    // "user" o "assistant"
    Content string `json:"content"`
}

type ChatResponse struct {
    Reply     string `json:"reply"`
    Timestamp string `json:"timestamp"`
}
```

### 1.2 Integración con Amazon Bedrock

Crear `internal/bedrock/client.go`:

```go
package bedrock

import (
    "context"
    "encoding/json"
    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
)

type Client struct {
    runtime *bedrockruntime.Client
    modelID string // "anthropic.claude-3-haiku-20240307-v1:0" para costos bajos
}

func NewClient(ctx context.Context, modelID string) (*Client, error) {
    cfg, err := config.LoadDefaultConfig(ctx)
    if err != nil {
        return nil, err
    }
    return &Client{
        runtime: bedrockruntime.NewFromConfig(cfg),
        modelID: modelID,
    }, nil
}

func (c *Client) Invoke(ctx context.Context, systemPrompt string, messages []Message) (string, error) {
    // Usar la API Messages de Claude en Bedrock
    // POST con body: { anthropic_version, max_tokens, system, messages }
}
```

**Modelo recomendado:** `anthropic.claude-3-haiku-20240307-v1:0` — el más barato y rápido, suficiente para consultas de datos clínicos. Si necesitas más inteligencia para queries complejas, usa `anthropic.claude-3-sonnet-20240229-v1:0`.

### 1.3 System Prompt para Bedrock

El system prompt debe incluir los datos reales del doctor. Construirlo dinámicamente así:

```
Eres Docco, el asistente virtual del sistema clínico dental. Tu personalidad es amigable, profesional y eficiente.

REGLAS:
- Responde SOLO con la información que se te proporciona en el contexto. No inventes datos.
- Si no tienes datos para responder, dilo amablemente: "No tengo esa información disponible en este momento."
- Responde en el mismo idioma que el usuario.
- Sé conciso pero completo. Usa formato legible.
- Cuando listes citas, incluye: hora, nombre del paciente, motivo/notas si existe.
- Cuando menciones pagos, incluye montos y método de pago.
- NUNCA reveles información de otros doctores u organizaciones.
- Formato de hora: 12h (ej: 2:00 PM). Zona horaria: America/Caracas.

DATOS DEL USUARIO ACTUAL:
- Nombre: {userName}
- Rol: {userRole}
- Organización: {orgID}

CITAS DE HOY ({fecha}):
{citasDeHoyFormateadas}

CITAS DE MAÑANA ({fecha}):
{citasDeMañanaFormateadas}

CITAS PRÓXIMOS 7 DÍAS:
{resumenSemanal}

PACIENTES RECIENTES (últimos 20):
{listaPacientes}

PAGOS RECIENTES (últimos 10):
{listaPagos}

PRESUPUESTOS ACTIVOS:
{listaPresupuestos}

ESTADÍSTICAS RÁPIDAS:
- Total pacientes: {N}
- Citas hoy: {N}
- Citas esta semana: {N}
- Ingresos del mes: {monto}
```

### 1.4 Nuevo endpoint en `internal/api/router.go`

Agregar dentro de las rutas autenticadas:

```go
// Chat endpoint - Docco
r.HandleFunc("POST /chat", s.handleChat)
```

**Handler:**

```go
func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
    // 1. Extraer token JWT → obtener orgID, userID, role, userName
    // 2. Parsear ChatRequest del body
    // 3. Llamar chatService.ProcessMessage(ctx, orgID, userID, role, request)
    // 4. Devolver ChatResponse como JSON

    // Permiso mínimo: cualquier usuario autenticado puede chatear
    // RBAC: el servicio filtra datos según el role (doctor ve solo sus datos, admin ve todo)
}
```

**RBAC en el chat:**
- `doctor`: solo ve sus propias citas, pacientes y pagos
- `admin`: ve datos de toda la organización
- `assistant`: ve citas de los doctores que asiste
- `platform_admin`: ve estadísticas globales

### 1.5 SAM Template Updates (`backend/template.yaml`)

Agregar permisos de Bedrock a la función Lambda:

```yaml
# En la sección Policies de ClinicalApiFunction, agregar:
- Statement:
    - Effect: Allow
      Action:
        - bedrock:InvokeModel
      Resource:
        - !Sub "arn:aws:bedrock:${AWS::Region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
        - !Sub "arn:aws:bedrock:${AWS::Region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0"
```

Agregar variable de entorno:

```yaml
Environment:
  Variables:
    BEDROCK_MODEL_ID: "anthropic.claude-3-haiku-20240307-v1:0"
```

### 1.6 Manejo de datos en el ChatService

**Método principal:**

```go
func (s *ChatService) ProcessMessage(ctx context.Context, orgID, userID, role string, req ChatRequest) (*ChatResponse, error) {
    // 1. Recopilar datos según el role
    clinicalContext := s.gatherContext(ctx, orgID, userID, role)

    // 2. Construir system prompt con los datos
    systemPrompt := s.buildSystemPrompt(clinicalContext)

    // 3. Construir mensajes (historial + nuevo mensaje)
    messages := convertHistory(req.ConversationHistory)
    messages = append(messages, bedrock.Message{Role: "user", Content: req.Message})

    // 4. Invocar Bedrock
    reply, err := s.bedrockClient.Invoke(ctx, systemPrompt, messages)

    // 5. Devolver respuesta
    return &ChatResponse{
        Reply:     reply,
        Timestamp: time.Now().Format(time.RFC3339),
    }, nil
}

func (s *ChatService) gatherContext(ctx context.Context, orgID, userID, role string) ClinicalContext {
    // Hacer queries en paralelo con goroutines + WaitGroup
    var wg sync.WaitGroup
    var context ClinicalContext

    // Obtener citas de hoy
    wg.Add(1)
    go func() {
        defer wg.Done()
        today := time.Now().In(clinicTZ).Format("2006-01-02")
        appointments, _ := s.appointmentRepo.ListByDoctorAndDate(ctx, userID, today)
        context.TodayAppointments = appointments
    }()

    // Obtener citas de mañana
    wg.Add(1)
    go func() {
        defer wg.Done()
        tomorrow := time.Now().In(clinicTZ).Add(24 * time.Hour).Format("2006-01-02")
        appointments, _ := s.appointmentRepo.ListByDoctorAndDate(ctx, userID, tomorrow)
        context.TomorrowAppointments = appointments
    }()

    // Obtener pacientes recientes, pagos, etc.
    // ... más goroutines ...

    wg.Wait()
    return context
}
```

**IMPORTANTE:** Las queries deben usar los mismos métodos del store existente para respetar el multi-tenancy (orgID en contexto).

---

## PARTE 2: Frontend React/TypeScript

### 2.1 Nuevo componente: `src/modules/docco/DoccoChat.tsx`

**Estructura de archivos:**

```
src/modules/docco/
├── DoccoChat.tsx          # Componente principal (bubble + panel)
├── DoccoBubble.tsx        # Botón flotante animado
├── DoccoChatPanel.tsx     # Panel de chat deslizable
├── DoccoMessage.tsx       # Componente de cada mensaje
├── DoccoTypingIndicator.tsx # Animación de "escribiendo..."
├── useDoccoChat.ts        # Hook personalizado para la lógica del chat
├── docco-types.ts         # Tipos TypeScript
└── docco.css              # Estilos y animaciones
```

### 2.2 DoccoBubble.tsx — Botón flotante animado

```tsx
// Botón circular flotante posición bottom-right
// - Icono de un diente/molar sonriente con gorro de doctor (SVG personalizado)
// - O alternativamente un icono de robot/asistente dental
// - Animación de "breathing" (escala sutil de 1.0 a 1.05 en loop)
// - Cuando hay un mensaje nuevo o es la primera vez: animación de "bounce"
// - Badge de notificación si hay mensajes sin leer
// - Tooltip "¡Hola! Soy Docco, tu asistente" al hacer hover (solo la primera vez)
// - onClick: toggle del panel de chat
// - Posición: fixed, bottom: 24px, right: 24px, z-index: 50
// - Tamaño: 56px (mobile) / 64px (desktop)
// - Color: usar el color primario del tema (#0ea5e9 / sky-500 o el que use la app)

// Animación CSS sugerida:
// @keyframes docco-breathe {
//   0%, 100% { transform: scale(1); }
//   50% { transform: scale(1.05); }
// }
// @keyframes docco-bounce {
//   0%, 100% { transform: translateY(0); }
//   50% { transform: translateY(-10px); }
// }
```

### 2.3 DoccoChatPanel.tsx — Panel de chat

```tsx
// Panel que se desliza desde abajo-derecha
// - Dimensiones: width 380px, height 520px (desktop) / full-width en mobile
// - Animación de entrada: slide-up + fade-in (300ms ease-out)
// - Animación de salida: slide-down + fade-out (200ms ease-in)
// - Header: "Docco" con icono + botón de cerrar (X)
//   - Subtítulo: "Asistente Clínico Virtual"
//   - Indicador de estado: "En línea" con punto verde
// - Body: lista de mensajes scrolleable
//   - Auto-scroll al último mensaje
//   - Mensajes del usuario: alineados a la derecha, fondo azul, texto blanco
//   - Mensajes de Docco: alineados a la izquierda, fondo gris claro, texto oscuro
//   - Avatar de Docco al lado de sus mensajes (mismo icono pequeño)
//   - Timestamps sutiles debajo de cada mensaje
// - Mensaje de bienvenida automático al abrir por primera vez:
//   "¡Hola! 👋 Soy Docco, tu asistente clínico virtual. Puedo ayudarte con:
//    • Consultar tus citas de hoy y la semana
//    • Buscar información de pacientes
//    • Ver pagos y presupuestos pendientes
//    • Resumen de tu agenda
//    ¿En qué puedo ayudarte?"
// - Footer: input de texto + botón enviar
//   - Placeholder: "Escribe tu pregunta..."
//   - Enviar con Enter o click en botón
//   - Botón deshabilitado mientras espera respuesta
//   - Indicador de "Docco está escribiendo..." con animación de 3 puntos
// - Sugerencias rápidas (chips clickeables) debajo del mensaje de bienvenida:
//   - "¿Tengo citas hoy?"
//   - "Resumen de mi semana"
//   - "Pacientes atendidos hoy"
//   - "Pagos pendientes"
```

### 2.4 useDoccoChat.ts — Hook personalizado

```tsx
// Estado:
// - messages: ChatMessage[] (historial de conversación)
// - isOpen: boolean (panel abierto/cerrado)
// - isLoading: boolean (esperando respuesta de backend)
// - error: string | null

// Funciones:
// - sendMessage(text: string): envía mensaje al backend POST /chat
//   - Agrega mensaje del usuario al historial inmediatamente
//   - Envía request con mensaje + últimos 10 mensajes de historial
//   - Al recibir respuesta, agrega mensaje de Docco al historial
//   - Manejo de errores: mostrar mensaje "Lo siento, hubo un problema. Intenta de nuevo."
// - toggleChat(): abre/cierra el panel
// - clearChat(): limpia el historial

// El historial se mantiene en memoria (no persistir en localStorage por privacidad de datos clínicos)
// Limitar historial enviado al backend a los últimos 10 mensajes para no exceder tokens
```

### 2.5 API Client — Agregar en `src/api/clinical.ts`

```typescript
// Agregar nuevo método:
chat: async (message: string, conversationHistory?: ChatMessage[]): Promise<ChatResponse> => {
    return request<ChatResponse>('/chat', {
        method: 'POST',
        body: JSON.stringify({
            message,
            conversationHistory: conversationHistory?.slice(-10) // últimos 10
        })
    });
}
```

### 2.6 Integración en la app

En `src/App.tsx` o `src/components/layout/DashboardLayout.tsx`:

```tsx
// Renderizar <DoccoChat /> dentro del layout del dashboard
// Solo visible para usuarios autenticados
// Renderizar FUERA del contenido principal para que flote sobre todo
// Ejemplo:
// <DashboardLayout>
//   {children}
//   <DoccoChat />
// </DashboardLayout>
```

### 2.7 Soporte para Dark Mode

El componente debe respetar el tema actual de la aplicación:
- Light mode: fondo blanco, bordes grises suaves
- Dark mode: fondo slate-800, bordes slate-700, texto slate-100
- Usar las mismas clases Tailwind que el resto de la app

### 2.8 Responsive

- Desktop (>768px): panel flotante 380x520px
- Mobile (<768px): panel fullscreen con overlay, header con botón back

---

## PARTE 3: Detalles de Implementación

### 3.1 Manejo de errores

```go
// Backend: si Bedrock falla, devolver respuesta amigable
if err != nil {
    return &ChatResponse{
        Reply: "Lo siento, estoy teniendo problemas para procesar tu consulta en este momento. Por favor intenta de nuevo en unos segundos.",
        Timestamp: time.Now().Format(time.RFC3339),
    }, nil // No propagar error, devolver respuesta amigable
}
```

### 3.2 Rate limiting

- Limitar a **20 mensajes por minuto** por usuario para controlar costos de Bedrock
- Implementar un simple counter en memoria en el backend (no necesita DynamoDB para esto)
- Si excede: "Has enviado muchos mensajes. Espera un momento antes de continuar."

### 3.3 Límites de tokens

- `max_tokens` en Bedrock: **1024** (suficiente para respuestas clínicas concisas)
- System prompt: diseñar para que no exceda ~2000 tokens de contexto
- Si los datos son muchos, priorizar: citas de hoy > citas de mañana > pacientes > pagos

### 3.4 Logging

```go
// Loggear cada interacción (sin el contenido del mensaje por privacidad):
log.Printf("[DOCCO] user=%s org=%s role=%s tokens_used=%d latency_ms=%d",
    userID, orgID, role, tokensUsed, latencyMs)
```

### 3.5 Variables de entorno nuevas

```yaml
BEDROCK_MODEL_ID: "anthropic.claude-3-haiku-20240307-v1:0"
DOCCO_ENABLED: "true"          # Feature flag para habilitar/deshabilitar
DOCCO_MAX_TOKENS: "1024"       # Máximo tokens de respuesta
DOCCO_RATE_LIMIT: "20"         # Mensajes por minuto por usuario
```

---

## PARTE 4: Testing

### 4.1 Backend tests

```bash
# Crear tests en:
# internal/service/chat_service_test.go
# internal/bedrock/client_test.go

# Tests unitarios con mock de Bedrock:
# - TestProcessMessage_AppointmentQuery
# - TestProcessMessage_PatientSearch
# - TestProcessMessage_NoData
# - TestProcessMessage_RateLimitExceeded
# - TestGatherContext_DoctorRole
# - TestGatherContext_AdminRole
# - TestBuildSystemPrompt

go test ./internal/service/... -run TestChat -v
go test ./internal/bedrock/... -v
```

### 4.2 Frontend tests

- Verificar que el bubble se renderiza
- Verificar toggle del panel
- Verificar envío de mensaje
- Verificar que muestra respuesta
- Verificar estado de loading

---

## PARTE 5: Despliegue

### 5.1 Pasos de despliegue

1. **Habilitar Bedrock en la cuenta AWS:**
   - Ir a Amazon Bedrock Console → Model access
   - Solicitar acceso a `Anthropic Claude 3 Haiku` (y opcionalmente Sonnet)
   - Esperar aprobación (generalmente inmediata)

2. **Backend:**
   ```bash
   cd backend
   sam build
   sam deploy
   ./scripts/fix-apigw-after-deploy.sh
   ```

3. **Frontend:**
   ```bash
   cd frontend/react-app
   npm run build
   # Deploy al S3 bucket + invalidar CloudFront
   ```

### 5.2 Estimación de costos

- **Bedrock Claude 3 Haiku**: ~$0.00025 por input 1K tokens, ~$0.00125 por output 1K tokens
- Con ~3K tokens input (system prompt + datos) + 500 tokens output por consulta
- **Costo por consulta:** ~$0.001375 (menos de 1 centavo)
- **100 consultas/día:** ~$0.14/día ≈ **$4.13/mes**
- Si se usa Claude 3 Sonnet: ~10x más caro (~$41/mes para 100 consultas/día)

---

## PARTE 6: Ejemplos de Conversación Esperados

```
Usuario: "Hola, tengo citas hoy?"
Docco: "¡Hola! Sí, hoy tienes 3 citas programadas:
  • 9:00 AM - María García (Limpieza dental)
  • 11:30 AM - Carlos López (Control de ortodoncia)
  • 3:00 PM - Ana Martínez (Extracción molar)
¿Necesitas más detalles sobre alguna?"

Usuario: "Cuánto me debe Carlos López?"
Docco: "Carlos López tiene 1 presupuesto activo por Bs. 450.00 para tratamiento de ortodoncia. De las últimas citas, tiene un pago pendiente de Bs. 150.00 de la cita del 15 de marzo. ¿Quieres que te muestre más detalles?"

Usuario: "Resumen de mi semana"
Docco: "Aquí tienes tu resumen semanal (18-22 Mar):
  📅 Total de citas: 12
  ✅ Confirmadas: 8
  ⏳ Pendientes: 4
  💰 Ingresos estimados: Bs. 2,340.00

  Tu día más cargado es el jueves con 4 citas. ¿Algo más?"

Usuario: "qué pacientes atendí ayer?"
Docco: "Ayer (17 de marzo) atendiste a 2 pacientes:
  1. Pedro Ramírez - Restauración (completada)
  2. Laura Sánchez - Control post-operatorio (completada)
¿Te gustaría ver los detalles de alguna consulta?"
```

---

## Resumen de archivos a crear/modificar

### Archivos NUEVOS:
- `backend/internal/bedrock/client.go` — Cliente de Bedrock
- `backend/internal/service/chat_service.go` — Servicio del chat
- `backend/internal/service/chat_service_test.go` — Tests
- `frontend/react-app/src/modules/docco/DoccoChat.tsx` — Componente principal
- `frontend/react-app/src/modules/docco/DoccoBubble.tsx` — Bubble animado
- `frontend/react-app/src/modules/docco/DoccoChatPanel.tsx` — Panel de chat
- `frontend/react-app/src/modules/docco/DoccoMessage.tsx` — Mensaje individual
- `frontend/react-app/src/modules/docco/DoccoTypingIndicator.tsx` — Animación typing
- `frontend/react-app/src/modules/docco/useDoccoChat.ts` — Hook del chat
- `frontend/react-app/src/modules/docco/docco-types.ts` — Tipos
- `frontend/react-app/src/modules/docco/docco.css` — Estilos/animaciones

### Archivos a MODIFICAR:
- `backend/internal/api/router.go` — Agregar ruta `POST /chat` + handler
- `backend/template.yaml` — Agregar permisos Bedrock + env vars
- `frontend/react-app/src/api/clinical.ts` — Agregar método `chat()`
- `frontend/react-app/src/components/layout/DashboardLayout.tsx` — Agregar `<DoccoChat />`
- `backend/go.mod` / `backend/go.sum` — Agregar dependencia bedrock SDK

---

## Orden de implementación sugerido

1. **Backend primero:** bedrock client → chat service → router endpoint → tests
2. **Frontend después:** tipos → hook → componentes UI → integración en layout
3. **Deploy:** SAM build/deploy → frontend build/deploy
4. **Testing E2E:** probar conversaciones reales

---

**NOTA IMPORTANTE:** Lee el CLAUDE.md del proyecto antes de comenzar. Respeta los patrones existentes: repository pattern, service layer, RBAC enforcement in router, DynamoDB key design, y la estructura de módulos del frontend.

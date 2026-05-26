---
name: sync-asisten
description: Detecta diferencias entre el módulo asisten de alo-ai-engine y el agente WhatsApp de clinical, luego aplica los cambios necesarios.
trigger: /sync-asisten
---

# Skill: sync-asisten

Uso: `/sync-asisten`

Compara el engine del agente "asisten" en `../alo-ai-engine` con la implementación equivalente en `clinical`, reporta diferencias por severidad y aplica los cambios aprobados.

## Archivos fuente a leer (alo-ai-engine)

- `../alo-ai-engine/backend/src/shared/PromptEngine.ts` — bloques del prompt
- `../alo-ai-engine/backend/src/shared/IAClient.ts` — parámetros Bedrock + caching
- `../alo-ai-engine/backend/src/types/index.ts` — AssistantConfig interface
- `../alo-ai-engine/backend/src/functions/aiWorker.ts` — señales ANSWER/HANDOFF, handoff logic
- `../alo-ai-engine/backend/src/shared/ModelRouter.ts` — model tiers

## Archivos equivalentes en clinical

- `backend/internal/service/whatsapp_ai_service.go` — prompt engine + model routing
- `backend/internal/bedrock/client.go` — parámetros Bedrock + caching
- `backend/internal/store/whatsapp.go` — tipos de config
- `backend/internal/api/whatsapp_handler.go` — señales ANSWER/HANDOFF, handoff logic

## Proceso

### 1. Leer y comparar en 5 dimensiones

**A. Bloques del prompt**
Comparar `assembleAssistantPrompt()` en PromptEngine.ts vs `buildWhatsAppSystemPrompt()` en whatsapp_ai_service.go:

- ¿Existen los mismos bloques?
- ¿El contenido/lógica de cada bloque es equivalente?
- ¿Hay bloques nuevos en alo-ai-engine que falten en clinical?

**B. Parámetros Bedrock**
Comparar `IAClient.ts` vs `bedrock/client.go`:

- Temperatura (alo-ai-engine usa 0.4)
- MaxTokens (ambos usan 1024)
- Prompt caching activado/no

**C. Schema de config**
Comparar `AssistantConfig` en types/index.ts vs `WhatsAppConfig` en store/whatsapp.go:

- Campos nuevos en alo-ai-engine que falten en clinical
- Campos eliminados
- Tipos cambiados

**D. Señales de respuesta**
Comparar parseAssistantSignal/aiWorker.ts vs parseAssistantSignal en whatsapp_handler.go:

- ¿Hay nuevas señales además de [ANSWER] y [HANDOFF]?
- ¿La lógica de handoff es equivalente?

**E. Model routing**
Comparar ModelRouter.ts vs resolveModelID() en whatsapp_ai_service.go:

- ¿Hay nuevos tiers?
- ¿Los model IDs por defecto cambiaron?
- ¿Las variables de entorno cambiaron de nombre?

### 2. Reportar diff por severidad

Después de leer ambos proyectos, presentar el reporte en este formato:

```
## Sync Report: alo-ai-engine → clinical

### 🔴 Breaking (comportamiento diferente — debe aplicarse)
- [descripción específica con archivo + línea de referencia]

### 🟡 Enhancement (feature en asisten pero faltante en clinical)
- [descripción específica]

### 🟢 Cosmético (nombres, orden — opcional)
- [descripción específica]

### ✅ En paridad
- [lista de dimensiones ya sincronizadas]
```

### 3. Aplicar cambios

Con aprobación del usuario, aplicar los cambios en orden:

1. 🔴 primero (breaking)
2. 🟡 después (enhancements)
3. 🟢 solo si el usuario lo pide explícitamente

Para cada cambio:

- Editar el archivo Go correspondiente
- Ejecutar `cd backend && go test ./... && go build ./...` para verificar
- Commit con mensaje descriptivo

## Notas importantes

- alo-ai-engine está en TypeScript; clinical está en Go. Traducir conceptos, no copiar código literal.
- Los nombres de campos en TypeScript usan camelCase; en Go usan PascalCase para campos exportados.
- El prompt caching de alo-ai-engine usa `ConverseCommand` de AWS SDK v3; clinical usa `InvokeModel` de SDK v2. La lógica es equivalente pero las APIs son diferentes.
- Si alo-ai-engine agrega un nuevo tipo de negocio o módulo que no aplica a clinical (ej: módulo "sales"), ignorarlo.

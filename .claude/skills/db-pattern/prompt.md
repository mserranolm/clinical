---
description: Diseña y documenta el patrón DynamoDB para una nueva entidad clínica. Genera la interfaz del repo, implementación y actualiza repositories.go.
---

Diseña el patrón DynamoDB para una nueva entidad en el sistema clínico.

Entidad solicitada: $ARGUMENTS

## Reglas fundamentales

1. **Nunca crear tabla nueva** — siempre añadir nuevo patrón a la tabla existente del recurso más cercano (o crear nueva tabla en `template.yaml` solo si es absolutamente necesario)
2. **Multi-tenant obligatorio** — PK siempre incluye `orgID` como prefijo: `orgID#resourceID`
3. **OrgID del JWT** — nunca del request body
4. **Serialización** — usar `attributevalue.MarshalMap` / `UnmarshalMap`

## Tablas existentes

| Tabla | PK pattern | Entidades |
|---|---|---|
| appointments | `orgID#appointmentID` | Citas |
| patients | `orgID#patientID` | Pacientes |
| consents | `orgID#consentID` | Consentimientos firmados |
| consent-templates | `orgID#templateID` | Plantillas |
| odontograms | `orgID#patientID` | Odontograma (1 por paciente) |
| treatment-plans | `orgID#planID` | Planes de tratamiento |
| users | `orgID#userID` | Usuarios |

## Lo que debes generar

### 1. Modelo de dominio (`backend/internal/domain/models.go`)

Diseña el struct Go con campos apropiados:
```go
type [Entidad] struct {
    ID        string    `dynamodbav:"id" json:"id"`
    OrgID     string    `dynamodbav:"orgId" json:"orgId"`
    CreatedAt time.Time `dynamodbav:"createdAt" json:"createdAt"`
    UpdatedAt time.Time `dynamodbav:"updatedAt" json:"updatedAt"`
    // campos específicos de la entidad...
}
```

### 2. Interfaz del repositorio (`backend/internal/store/repositories.go`)

```go
type [Entidad]Repository interface {
    Create(ctx context.Context, orgID string, item *domain.[Entidad]) error
    Get(ctx context.Context, orgID, id string) (*domain.[Entidad], error)
    List(ctx context.Context, orgID string) ([]*domain.[Entidad], error)
    Update(ctx context.Context, orgID string, item *domain.[Entidad]) error
    Delete(ctx context.Context, orgID, id string) error
}
```

Añade métodos adicionales si la entidad los necesita (ej: `ListByPatient`, `ListByDate`).

### 3. Implementación DynamoDB (`backend/internal/store/dynamodb_[entidad].go`)

```go
package store

import (
    "context"
    "github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
    // ...
)

func (r *DynamoRepository) Create[Entidad](ctx context.Context, orgID string, item *domain.[Entidad]) error {
    item.ID = uuid.NewString()
    item.OrgID = orgID
    item.CreatedAt = time.Now()
    item.UpdatedAt = time.Now()

    av, err := attributevalue.MarshalMap(item)
    if err != nil {
        return err
    }

    _, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
        TableName: aws.String(r.tables.[entidad]s),
        Item:      av,
    })
    return err
}
```

### 4. Implementación in-memory (`backend/internal/store/in_memory.go`)

Añade la implementación in-memory para desarrollo local y tests.

### 5. Tabla en template.yaml (si es necesaria)

Si requiere tabla nueva, muestra el recurso CloudFormation a añadir:

```yaml
[Entidad]sTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: !Sub "${AWS::StackName}-[entidad]s"
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: id
        AttributeType: S
    KeySchema:
      - AttributeName: id
        KeyType: HASH
```

### 6. Decisiones documentadas

Explica:
- **¿Por qué ese PK/SK?** — trade-offs de acceso
- **¿Indices secundarios (GSI)?** — si hay queries por campos distintos al PK
- **¿TTL?** — si los datos deben expirar automáticamente
- **¿Tabla nueva o patrón en existente?** — justificación

## Checklist de salida

- [ ] Struct de dominio con tags `dynamodbav` y `json`
- [ ] Interfaz del repositorio completa
- [ ] Implementación DynamoDB con MarshalMap/UnmarshalMap
- [ ] Implementación in-memory para tests
- [ ] Tabla añadida a template.yaml (si es nueva)
- [ ] IAM policy actualizada en template.yaml para la nueva tabla
- [ ] `go build ./...` pasa sin errores

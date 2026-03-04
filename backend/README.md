# Clinical Backend (AWS Serverless + Go)

Sistema completo de gestión clínica (odontología adaptable a otras especialidades) diseñado para AWS **100% serverless** con CI/CD automatizado.

## 🏗️ Arquitectura

- **Backend**: AWS Lambda (Go 1.22)
- **API**: API Gateway HTTP API
- **Base de datos**: DynamoDB (PAY_PER_REQUEST)
- **Scheduler**: EventBridge para recordatorios automáticos
- **Notificaciones**: SNS/SES para SMS/email
- **Almacenamiento**: S3 para imágenes de pacientes
- **CI/CD**: AWS CodePipeline + CodeBuild

## 📦 Módulos incluidos

1. **Onboarding de pacientes** - Registro completo con antecedentes médicos
2. **Agenda por doctor** - Control de citas con disponibilidad
3. **Recordatorios automáticos** - 24h antes vía SMS/email
4. **Confirmación de citas** - Por parte del paciente
5. **Cierre diario** - Automatización al final del día
6. **Evolución clínica** - Notas y plan de tratamiento
7. **Registro de pagos** - Control financiero por cita
8. **Consentimiento informado** - Envío y aceptación digital

## 🚀 Desarrollo Local

### Setup inicial (una sola vez)

Configure tu perfil AWS SSO o credenciales locales antes de iniciar.

**¿Por qué conectar a AWS en local?**
- Debugging real con DynamoDB
- Testing completo antes del deploy
- Verificar permisos y configuración
- Detectar problemas temprano

### Ejecutar servidor de desarrollo

```bash
cd backend
make local
```

O directamente:

```bash
cd backend
USE_DYNAMODB=false LOCAL_HTTP=true LOCAL_HTTP_PORT=3000 go run ./cmd/api
```

### Ejecutar tests

```bash
cd backend
make test

# Con cobertura
go test -v -race -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

## 🔄 CI/CD Pipeline

### Configurar Pipeline con CodePipeline

```bash
# Deploy backend pipeline
../scripts/deploy-backend-pipeline.sh

# After deploying, fix API Gateway stage if needed
../scripts/fix-apigw-after-deploy.sh
```

### Pipeline automático

El pipeline se ejecuta automáticamente en:
- **Push a `main`** → Deploy a **production**
- **Push a `develop`** → Deploy a **staging** 
- **Otras ramas** → Build y test solamente

### Fases del Pipeline

1. **Source** - CodeCommit/GitHub
2. **Build** - CodeBuild con:
   - Tests unitarios + coverage
   - Linting (golangci-lint)
   - Security scan (gosec)
   - SAM build y package
   - Deploy automático (ramas configuradas)

## 📊 Variables de entorno

### Desarrollo local
```bash
ENVIRONMENT=dev
LOCAL_HTTP=true
LOCAL_HTTP_PORT=3000
USE_DYNAMODB=false  # true para usar DynamoDB real
AWS_PROFILE=your-sso-profile  # Para desarrollo con AWS
```

### Producción (Lambda)
```bash
ENVIRONMENT=production
APPOINTMENT_TABLE=clinical-appointments
PATIENT_TABLE=clinical-patients  
CONSENT_TABLE=clinical-consents
SEND_SMS=true
SEND_EMAIL=true
USE_DYNAMODB=true
```

## 🛠️ Deployment Manual

### Backend solamente

```bash
cd backend
sam build --use-container
sam deploy --guided
```

### Con Pipeline completo

```bash
# Ver scripts disponibles en la raíz del proyecto
ls ../scripts/
```

## 📡 API Endpoints

### Autenticación
- `POST /auth/register` - Registro de usuario
- `POST /auth/login` - Login
- `POST /auth/forgot-password` - Recuperar contraseña
- `POST /auth/reset-password` - Reset contraseña

### Pacientes
- `POST /patients/onboard` - Registro de paciente
- `GET /patients/{id}` - Obtener paciente

### Citas
- `POST /appointments` - Crear cita
- `GET /appointments?doctorId={id}&date=YYYY-MM-DD` - Listar citas
- `POST /appointments/{id}/confirm` - Confirmar cita
- `POST /appointments/{id}/close-day` - Cerrar día
- `POST /appointments/{id}/send-reminder` - Enviar recordatorio

### Consentimientos
- `POST /consents` - Crear consentimiento
- `POST /consents/{id}/accept` - Aceptar consentimiento

### Automatizaciones
- `POST /doctors/{doctorId}/end-day-reminder` - Recordatorio fin de día

## 🔧 Arquitectura Técnica

### Detección automática de entorno
- **Lambda**: Usa DynamoDB + permisos IAM del rol
- **Local**: Usa in-memory por defecto, DynamoDB con SSO opcional

### Creación automática de tablas
- El sistema crea las tablas DynamoDB automáticamente
- Usa convención: `{PROJECT}-{RESOURCE}-{ENVIRONMENT}`
- Tags automáticos para gestión

### Manejo de permisos dinámicos
- **Lambda**: Rol IAM con permisos DynamoDB específicos
- **Local**: Profile SSO configurado por usuario
- **Fallback**: Repositorios in-memory si falla DynamoDB

## 🧪 Testing

### Ejecutar tests

```bash
cd backend
go test -v -race -coverprofile=coverage.out ./...
go tool cover -html=coverage.out  # Ver coverage en browser
```

### Linting

```bash
cd backend
golangci-lint run --timeout=5m
```

### Security scan

```bash
cd backend
gosec ./...
```

## 📚 Estructura del proyecto

```
backend/
├── cmd/api/                 # Entry point de la aplicación
├── internal/
│   ├── api/                 # HTTP handlers y routing
│   ├── config/              # Configuración de entorno
│   ├── domain/              # Modelos de dominio
│   ├── notifications/       # Sistema de notificaciones
│   ├── scheduler/           # Schedulers para recordatorios
│   ├── service/             # Lógica de negocio
│   └── store/               # Repositorios (DynamoDB + in-memory)
├── scripts/                 # Scripts de deployment y setup
├── buildspec.yml            # Configuración CodeBuild
├── template.yaml            # Template SAM/CloudFormation
└── go.mod                   # Dependencias Go

infrastructure/
├── backend-pipeline.yaml    # Pipeline CI/CD del backend
└── frontend-pipeline.yaml   # Pipeline CI/CD del frontend
```

## 🚨 Troubleshooting

### Error "tabla no encontrada"
- Verificar permisos IAM del role Lambda
- Las tablas se crean automáticamente en primer uso

### Pipeline falla en Deploy
- Verificar que el rol CodeBuild tenga permisos CloudFormation
- Revisar que S3 bucket de artifacts exista

### Error de credenciales en local
```bash
aws configure sso
aws sso login --profile your-profile
```

### DynamoDB timeout en local
- Usar `USE_DYNAMODB=false` para desarrollo rápido
- Verificar conectividad AWS en tu perfil

## 📈 Monitoreo

- **CloudWatch Logs**: `/aws/lambda/clinical-*`
- **CloudWatch Metrics**: Lambda duration, errors, invocations
- **DynamoDB Metrics**: Read/Write capacity, throttling
- **Pipeline**: CodePipeline console para estado de deployments

## 🔄 Próximos pasos

1. **Frontend moderno**: Migrar a React/Next.js
2. **Autenticación robusta**: Integrar AWS Cognito
3. **Calendario visual**: UI para gestión de citas
4. **Reportes**: Analytics y dashboards
5. **Facturación**: Sistema de cobros automático
6. **Multi-tenancy**: Soporte para múltiples clínicas

## 📞 Soporte

Para issues técnicos:
1. Revisar logs en CloudWatch
2. Verificar configuración de permisos
3. Consultar esta documentación
4. Ejecutar tests locales para debugging

---

**Versión**: 2.0.0 con DynamoDB + CI/CD  
**Compatibilidad**: Go 1.22+, AWS SAM CLI 1.100+

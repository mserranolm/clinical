# 🏥 Clinical Management System

> Sistema de gestión clínica serverless para consultorios odontológicos, adaptable a otras especialidades médicas.

[![AWS](https://img.shields.io/badge/AWS-Serverless-orange)](https://aws.amazon.com/)
[![Go](https://img.shields.io/badge/Go-1.22+-blue)](https://golang.org/)
[![API Gateway](https://img.shields.io/badge/API%20Gateway-HTTP%20API-green)](https://aws.amazon.com/api-gateway/)
[![DynamoDB](https://img.shields.io/badge/DynamoDB-NoSQL-purple)](https://aws.amazon.com/dynamodb/)

## 🌟 Descripción

Sistema completo de gestión clínica diseñado específicamente para consultorios odontológicos, con capacidad de adaptación a otras especialidades médicas. Implementa una arquitectura serverless moderna en AWS con enfoque en escalabilidad, seguridad y eficiencia de costos.

### ✨ Características Principales

- **🦷 Odontograma Digital Completo**: Registro detallado de 32 dientes con todas sus superficies
- **📅 Gestión de Citas**: Creación, confirmación y seguimiento de appointments
- **👥 Gestión de Pacientes**: Onboarding y administración completa de pacientes
- **🔐 Sistema de Autenticación**: Registro, login, y recuperación de contraseñas
- **📄 Consentimientos Informados**: Creación y gestión via SMS/email
- **📋 Planes de Tratamiento**: Planificación y seguimiento de tratamientos
- **📧 Notificaciones Automatizadas**: Recordatorios 24h antes de las citas
- **🔔 Recordatorios de Cierre**: Notificaciones al final del día para médicos

## 🏗️ Arquitectura

### Backend Serverless (AWS)
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Gateway   │────│ Lambda Functions │────│   DynamoDB      │
│   (HTTP API)    │    │     (Go 1.22)    │    │   (6 Tables)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ├── EventBridge (Schedules)
                                ├── SNS/SES (Notifications)  
                                └── S3 (Patient Images)
```

### Stack Tecnológico
- **Lenguaje**: Go 1.22
- **Runtime**: AWS Lambda con custom runtime
- **API**: API Gateway HTTP API (APIGatewayV2)
- **Base de Datos**: DynamoDB con modo PAY_PER_REQUEST
- **Notificaciones**: SNS (SMS) + SES (Email)
- **Almacenamiento**: S3 para imágenes de pacientes
- **Schedules**: EventBridge para automatizaciones
- **IaC**: AWS SAM (Serverless Application Model)

## 🚀 Estado del Proyecto

### ✅ Implementado y Funcionando
- [x] **API Gateway HTTP API** desplegado en us-east-1
- [x] **12/15 endpoints API** funcionando correctamente
- [x] **6 tablas DynamoDB** creadas y configuradas:
  - `clinical-patients` - Información de pacientes
  - `clinical-appointments` - Gestión de citas
  - `clinical-consents` - Documentos de consentimiento
  - `clinical-users` - Autenticación de usuarios
  - `clinical-odontograms` - Odontogramas digitales
  - `clinical-treatment-plans` - Planes de tratamiento
- [x] **Logging detallado** implementado en CloudWatch
- [x] **Autenticación completa** (registro, login, reset password)
- [x] **Gestión de pacientes** funcional
- [x] **Creación de citas** y confirmación
- [x] **Consentimientos informados** con verificación
- [x] **Odontograma completo** (32 dientes con 5 superficies cada uno)

### 🔧 En Desarrollo
- [ ] **3 endpoints** requieren ajustes menores
- [ ] **Pipeline CI/CD** (configuración completa disponible)
- [ ] **API Keys y Rate Limiting** (100 requests/mes)
- [ ] **Frontend web** (planeado)

## 📊 API Endpoints

**Base URL**: `https://cyey5rzsi3.execute-api.us-east-1.amazonaws.com`

### 🏥 Gestión de Pacientes
- `POST /patients/onboard` - Registro de nuevo paciente
- `GET /patients/{id}` - Obtener información del paciente

### 📅 Gestión de Citas  
- `POST /appointments` - Crear nueva cita
- `GET /appointments` - Listar citas (⚠️ en desarrollo)
- `POST /appointments/{id}/confirm` - Confirmar cita

### 🔐 Autenticación
- `POST /auth/register` - Registro de usuario
- `POST /auth/login` - Iniciar sesión
- `POST /auth/forgot-password` - Solicitar reset de contraseña
- `POST /auth/reset-password` - Resetear contraseña

### 📄 Consentimientos
- `POST /consents` - Crear consentimiento informado
- `GET /consents/verify/{token}` - Verificar/aceptar consentimiento

### 🦷 Odontograma
- `POST /odontograms` - Crear odontograma inicial
- `GET /odontograms` - Obtener odontograma (⚠️ en desarrollo)
- `PUT /odontograms` - Actualizar condición de dientes

### 📋 Planes de Tratamiento
- `POST /treatment-plans` - Crear plan de tratamiento (⚠️ requiere odontogramId)
- `GET /treatment-plans` - Obtener planes
- `PUT /treatment-plans` - Actualizar plan

### 🩺 Sistema
- `GET /health` - Health check del API

> 📖 **Documentación detallada**: Ver [API_TESTING_RESULTS.md](API_TESTING_RESULTS.md) para ejemplos de uso completos.

## 🚀 Despliegue

### Prerrequisitos
- AWS CLI v2 configurado
- SAM CLI instalado
- Go 1.22+ instalado
- Perfil AWS SSO configurado (`aski`)

### Despliegue Rápido
```bash
# Clonar repositorio
git clone <repo-url>
cd clinical/backend

# Autenticarse con AWS
aws sso login --profile aski

# Build y deploy
sam build
sam deploy --stack-name clinical-backend \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM \
  --profile aski \
  --resolve-s3 \
  --no-confirm-changeset
```

> 📚 **Guía completa**: Ver [DEPLOYMENT.md](DEPLOYMENT.md) para instrucciones detalladas.

## 🧪 Pruebas

### Test de Health Check
```bash
curl -X GET "https://cyey5rzsi3.execute-api.us-east-1.amazonaws.com/health"
# Respuesta esperada: {"message":"Clinical API is running","status":"ok"}
```

### Test de Creación de Paciente
```bash
curl -X POST "https://cyey5rzsi3.execute-api.us-east-1.amazonaws.com/patients/onboard" \
  -H "Content-Type: application/json" \
  -d '{
    "doctorId": "doc-123",
    "firstName": "Juan",
    "lastName": "Pérez", 
    "email": "juan@test.com",
    "phone": "+34666777888",
    "birthDate": "1990-05-15"
  }'
```

## 📂 Estructura del Proyecto

```
clinical/
├── backend/                    # Backend serverless
│   ├── cmd/api/               # Punto de entrada Lambda
│   ├── internal/
│   │   ├── api/              # Handlers HTTP
│   │   ├── service/          # Lógica de negocio
│   │   ├── store/            # Repositorios DynamoDB
│   │   └── config/           # Configuración
│   ├── template.yaml         # SAM template
│   └── go.mod               # Dependencias Go
├── infrastructure/           # Infraestructura IaC
│   └── pipeline.yaml        # Pipeline CI/CD
├── DEPLOYMENT.md            # Guía de despliegue
├── API_TESTING_RESULTS.md   # Resultados de pruebas API
└── README.md               # Este archivo
```

## 🛠️ Desarrollo Local

### Configuración del Entorno
```bash
# Variables de entorno para desarrollo local
cp .env.example .env.local

# Ejecutar servidor HTTP local
go run cmd/api/main.go
# API disponible en: http://localhost:3000
```

### Variables de Entorno
```bash
ENVIRONMENT=dev
USE_DYNAMODB=false          # true para usar DynamoDB, false para in-memory
LOCAL_HTTP_PORT=3000
AWS_PROFILE=aski
```

## 🔐 Seguridad

### Configuración Actual (Desarrollo)
- ✅ **Autenticación JWT** implementada
- ✅ **Validación de entrada** en todos los endpoints
- ✅ **CORS habilitado** para desarrollo
- ⚠️ **API Keys deshabilitadas** temporalmente para pruebas

### Configuración Recomendada (Producción)
- [ ] **API Gateway API Keys** (100 requests/mes)
- [ ] **Rate Limiting** configurado
- [ ] **VPC Endpoints** para DynamoDB
- [ ] **WAF** para protección adicional
- [ ] **Secrets Manager** para datos sensibles

## 📊 Monitoreo

### CloudWatch Logs
```bash
# Ver logs en tiempo real
aws logs tail "/aws/lambda/clinical-backend-ClinicalApiFunction-*" \
  --since 1m --profile aski --region us-east-1
```

### Métricas Disponibles
- **Latencia de API**: Tiempo de respuesta promedio
- **Errores**: Rate de errores por endpoint
- **Invocaciones**: Número de requests por función
- **DynamoDB**: Read/Write capacity y throttling

## 🚧 Roadmap

### Próximas Funcionalidades
- [ ] **Frontend Web Responsivo** (HTML/CSS/JS)
- [ ] **Dashboard de Métricas** para doctores
- [ ] **Reportes PDF** de historias clínicas
- [ ] **Integración WhatsApp** para notificaciones
- [ ] **Backup Automatizado** de datos críticos
- [ ] **Multi-tenancy** para múltiples clínicas

### Mejoras Técnicas
- [ ] **Tests Automatizados** (unit + integration)
- [ ] **Pipeline CI/CD** completamente funcional
- [ ] **Blue/Green Deployments**
- [ ] **Optimización de Cold Starts**

## 🤝 Contribución

### Para Desarrolladores
1. Fork del repositorio
2. Crear feature branch: `git checkout -b feature/nueva-funcionalidad`
3. Commit cambios: `git commit -am 'Agregar nueva funcionalidad'`
4. Push al branch: `git push origin feature/nueva-funcionalidad`
5. Crear Pull Request

### Estándares de Código
- **Go**: Seguir `gofmt` y `golint`
- **Commits**: Conventional Commits format
- **Tests**: Mínimo 80% coverage para nuevas features

## 📝 Licencia

Este proyecto está bajo la Licencia MIT - ver [LICENSE](LICENSE) para detalles.

## 👤 Autor

**Manuel Serrano**
- 🔗 LinkedIn: [linkedin.com/in/manuelserranolm](https://linkedin.com/in/manuelserranolm)
- 📧 Email: manuel.serrano.dev@gmail.com
- 🐙 GitHub: [@mserranolm](https://github.com/mserranolm)

---

⭐ **¿Te gusta el proyecto?** ¡Dale una estrella en GitHub!

📞 **¿Necesitas soporte?** Abre un [Issue](../../issues) o contacta al autor.

🚀 **¿Quieres contribuir?** Lee nuestra [guía de contribución](#-contribución) y únete al equipo.

---

*Hecho con ❤️ para la comunidad médica hispanohablante*

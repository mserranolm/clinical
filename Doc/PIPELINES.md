# 🚀 Clinical CI/CD Pipelines

Sistema de integración y despliegue continuo para el proyecto Clinical Management System con pipelines separados para backend y frontend, activados solo cuando hay cambios en sus respectivas carpetas.

## 📋 Información General

### Arquitectura de Pipelines
```
clinical/
├── backend/           # → Pipeline Backend (SAM → Lambda + API Gateway)
├── frontend/          # → Pipeline Frontend (S3 + CloudFront)
├── infrastructure/    # Templates CloudFormation
└── scripts/          # Scripts de despliegue
```

### Características Principales
- **🎯 Activación Selectiva**: Cada pipeline se ejecuta solo cuando hay cambios en su carpeta específica
- **🔄 Integración con GitHub**: Webhooks automáticos para detectar cambios en `main`
- **🏗️ Backend Pipeline**: Despliega infraestructura serverless (Lambda + API Gateway + DynamoDB)
- **🌐 Frontend Pipeline**: Despliega aplicación web a CloudFront con S3
- **📊 Monitoreo Completo**: CloudWatch logs y métricas en AWS Console

## 🔧 Backend Pipeline

### ¿Qué hace?
- **Triggers**: Cambios en `backend/` folder en rama `main`
- **Build**: Compilación Go 1.22 con SAM CLI
- **Deploy**: AWS Lambda + API Gateway HTTP + DynamoDB
- **Región**: us-east-1 (Norte de Virginia)

### Infraestructura Creada
- **Lambda Functions**: API principal + funciones de recordatorios
- **API Gateway**: HTTP API para todos los endpoints
- **DynamoDB**: 6 tablas (patients, appointments, consents, users, odontograms, treatment-plans)
- **EventBridge**: Reglas para recordatorios automáticos
- **IAM Roles**: Permisos necesarios para Lambda y DynamoDB

### Tecnologías
- **Runtime**: Go 1.22 con custom bootstrap
- **Build Tool**: AWS SAM CLI
- **Deploy Strategy**: CloudFormation stack updates
- **Artifact Storage**: S3 bucket automático

## 🌐 Frontend Pipeline

### ¿Qué hace?
- **Triggers**: Cambios en `frontend/` folder en rama `main`
- **Build**: No build necesario (vanilla HTML/CSS/JS)
- **Deploy**: S3 + CloudFront distribution
- **Cache**: Optimizado para SPA con invalidaciones automáticas

### Infraestructura Creada
- **S3 Bucket**: Hosting estático con configuración web
- **CloudFront**: CDN global con HTTPS automático
- **Origin Access Identity**: Acceso seguro desde CloudFront a S3
- **Custom Error Pages**: Redirects para SPA (404 → index.html)

### Características
- **Performance**: CDN global con cache optimizado
- **Security**: HTTPS forzado, Origin Access Identity
- **SPA Support**: Manejo correcto de rutas client-side
- **Cache Strategy**: HTML sin cache, assets con cache largo

## 🚀 Despliegue de Pipelines

### Prerrequisitos
```bash
# 1. AWS CLI configurado con SSO
aws sso login --profile aski

# 2. GitHub Personal Access Token
# Crear en: GitHub → Settings → Developer settings → Personal access tokens
# Permisos necesarios: repo, admin:repo_hook

# 3. Verificar estructura del proyecto
ls -la
# Debe contener: backend/ frontend/ infrastructure/ scripts/
```

### 1. Desplegar Pipeline Backend
```bash
# Ejecutar script con parámetros
./scripts/deploy-backend-pipeline.sh <GITHUB_OWNER> <GITHUB_TOKEN>

# Ejemplo:
./scripts/deploy-backend-pipeline.sh mserranolm ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**¿Qué crea?**
- Stack: `clinical-backend-pipeline`
- Pipeline: Monitorea `backend/` folder
- Webhook: GitHub → CodePipeline automático
- Permisos: IAM roles para CodeBuild y CodePipeline

### 2. Desplegar Pipeline Frontend
```bash
# Ejecutar script con parámetros  
./scripts/deploy-frontend-pipeline.sh <GITHUB_OWNER> <GITHUB_TOKEN>

# Ejemplo:
./scripts/deploy-frontend-pipeline.sh mserranolm ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**¿Qué crea?**
- Stack: `clinical-frontend-pipeline`
- Website: URL de CloudFront público
- Pipeline: Monitorea `frontend/` folder
- S3 + CloudFront: Infraestructura web completa

### 3. Verificar Despliegue
```bash
# Ver stacks creados
aws cloudformation list-stacks --profile aski --region us-east-1 \
  --query 'StackSummaries[?StackStatus==`CREATE_COMPLETE`||StackStatus==`UPDATE_COMPLETE`].StackName'

# Ver pipelines activos
aws codepipeline list-pipelines --region us-east-1 --profile aski
```

## 🔄 Flujo de Trabajo

### Desarrollo Backend
```bash
# 1. Hacer cambios en backend/
vim backend/internal/api/router.go

# 2. Commit y push a main
git add backend/
git commit -m "Add new API endpoint"
git push origin main

# 3. Pipeline se activa automáticamente
# - GitHub webhook notifica cambio
# - CodePipeline inicia build
# - CodeBuild compila Go + SAM deploy
# - Lambda function updated en ~3-5 minutos
```

### Desarrollo Frontend
```bash
# 1. Hacer cambios en frontend/
vim frontend/src/app.js

# 2. Commit y push a main
git add frontend/
git commit -m "Update UI components"
git push origin main

# 3. Pipeline se activa automáticamente
# - GitHub webhook notifica cambio
# - CodePipeline inicia build
# - S3 sync + CloudFront invalidation
# - Website updated en ~2-3 minutos
```

## 📊 Monitoreo y Troubleshooting

### AWS Console URLs
```bash
# Backend Pipeline
https://console.aws.amazon.com/codesuite/codepipeline/pipelines/clinical-backend-pipeline/view

# Frontend Pipeline  
https://console.aws.amazon.com/codesuite/codepipeline/pipelines/clinical-frontend-pipeline/view

# CloudWatch Logs
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logs:
```

### Estados de Pipeline
- **🟢 Succeeded**: Despliegue exitoso
- **🟡 In Progress**: Build/deploy en progreso
- **🔴 Failed**: Error - revisar logs en CodeBuild
- **⚪ Stopped**: Pipeline pausado manualmente

### Logs Importantes
```bash
# Backend Build Logs
aws logs tail "/aws/codebuild/clinical-backend-build" --region us-east-1 --profile aski

# Frontend Build Logs
aws logs tail "/aws/codebuild/clinical-frontend-build" --region us-east-1 --profile aski

# Lambda Execution Logs (después del deploy)
aws logs tail "/aws/lambda/clinical-backend-ClinicalApiFunction-*" --region us-east-1 --profile aski
```

## 🛠️ Configuración Avanzada

### Cambiar Ramas de Monitoreo
```bash
# Actualizar pipeline para monitorear rama 'develop'
aws cloudformation update-stack \
  --stack-name clinical-backend-pipeline \
  --region us-east-1 \
  --profile aski \
  --use-previous-template \
  --parameters ParameterKey=BranchName,ParameterValue=develop \
  --capabilities CAPABILITY_NAMED_IAM
```

### Filtros de Carpeta (Avanzado)
Los pipelines actuales se activan con cualquier cambio en `main`. Para filtrado más granular, se puede agregar lógica en los buildspec:

```yaml
# En buildspec, agregar:
pre_build:
  commands:
    - |
      if ! git diff --name-only HEAD~1 HEAD | grep -q "^backend/"; then
        echo "No changes in backend/, skipping build"
        exit 0
      fi
```

### Variables de Entorno Personalizadas
```yaml
# En CodeBuild Project, agregar:
Environment:
  EnvironmentVariables:
    - Name: CUSTOM_DOMAIN
      Value: api.yourdomain.com
    - Name: ENVIRONMENT  
      Value: production
```

## 🔒 Security & Permisos

### GitHub Token Requerimientos
- **Scope**: `repo` (acceso completo al repositorio)
- **Webhook**: Creación automática de webhooks
- **Expiration**: Sin expiración recomendado para CI/CD

### AWS IAM Permisos Creados
**Backend Pipeline**:
- CodeBuild → CloudFormation, Lambda, API Gateway, DynamoDB
- CodePipeline → S3, CodeBuild
- Lambda Execution → DynamoDB, CloudWatch Logs

**Frontend Pipeline**:
- CodeBuild → S3, CloudFront
- CodePipeline → S3, CodeBuild  
- CloudFront → S3 Origin Access

### Buenas Prácticas
- **Tokens**: Rotar GitHub tokens cada 6 meses
- **Permisos**: Principio de menor privilegio aplicado
- **Secrets**: GitHub tokens almacenados como parámetros seguros
- **Monitoring**: CloudWatch alerts en fallos de pipeline

## 🚨 Troubleshooting Común

### Error: "GitHub token invalid"
```bash
# Verificar token
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user

# Regenerar token en GitHub Settings → Developer settings
```

### Error: "Stack already exists"
```bash
# Eliminar stack existente
aws cloudformation delete-stack \
  --stack-name clinical-backend-pipeline \
  --region us-east-1 \
  --profile aski

# Esperar eliminación completa, luego redeployar
```

### Error: "Go build failed"
```bash
# Revisar logs específicos
aws logs get-log-events \
  --log-group-name "/aws/codebuild/clinical-backend-build" \
  --log-stream-name "$(aws logs describe-log-streams --log-group-name "/aws/codebuild/clinical-backend-build" --query 'logStreams[0].logStreamName' --output text)" \
  --region us-east-1 \
  --profile aski
```

### Frontend no actualiza
```bash
# Verificar invalidación CloudFront
aws cloudfront list-invalidations \
  --distribution-id $CLOUDFRONT_ID \
  --region us-east-1 \
  --profile aski

# Forzar invalidación manual
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_ID \
  --paths "/*" \
  --region us-east-1 \
  --profile aski
```

## 📈 Métricas y Costos

### Costos Estimados (mensual)
- **Backend Pipeline**: $5-15/mes (principalmente CodeBuild minutes)
- **Frontend Pipeline**: $1-5/mes (S3 storage + CloudFront requests)
- **GitHub Webhooks**: Gratis
- **CloudWatch Logs**: $1-3/mes

### Optimizaciones
- **Build Cache**: Reutilización de dependencias Go
- **Incremental Builds**: Solo construir si hay cambios reales
- **CloudFront**: Cache agresivo para assets estáticos
- **S3**: Lifecycle policies para artifacts antiguos

## 🎯 Roadmap

### Próximas Mejoras
- [ ] **Notification System**: Slack/email para fallos de pipeline
- [ ] **Multi-Environment**: Pipelines para dev/staging/prod
- [ ] **Blue/Green Deployments**: Zero-downtime para backend
- [ ] **Testing Integration**: Tests automáticos antes del deploy
- [ ] **Security Scanning**: Análisis de vulnerabilidades
- [ ] **Performance Monitoring**: Métricas post-deployment

### Integraciones Futuras
- [ ] **SonarQube**: Análisis de calidad de código
- [ ] **Snyk**: Seguridad de dependencias
- [ ] **Terraform**: Migración de CloudFormation
- [ ] **ArgoCD**: GitOps para Kubernetes (si se migra)

---

**🔗 Enlaces Útiles**
- [AWS CodePipeline Documentation](https://docs.aws.amazon.com/codepipeline/)
- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [CloudFront Distribution Configuration](https://docs.aws.amazon.com/cloudfront/)
- [GitHub Webhooks Guide](https://docs.github.com/en/developers/webhooks-and-events)

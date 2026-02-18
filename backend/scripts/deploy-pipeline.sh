#!/bin/bash

# Script para desplegar el pipeline de CI/CD con CodePipeline y CodeBuild
set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuración por defecto
PROJECT_NAME="clinical-backend"
AWS_REGION=${AWS_REGION:-us-east-1}
ENVIRONMENT=${ENVIRONMENT:-dev}
STACK_NAME="${PROJECT_NAME}-pipeline-${ENVIRONMENT}"

# Función de ayuda
usage() {
    echo "Uso: $0 [opciones]"
    echo
    echo "Opciones:"
    echo "  -e, --environment ENV     Entorno (dev, staging, production). Default: dev"
    echo "  -r, --region REGION       Región AWS. Default: us-east-1"
    echo "  -p, --project NAME        Nombre del proyecto. Default: clinical-backend"
    echo "  -g, --github OWNER/REPO   Usar GitHub como fuente (formato: owner/repo)"
    echo "  -t, --token TOKEN         Token de GitHub (requerido si usa GitHub)"
    echo "  -c, --codecommit REPO     Usar CodeCommit como fuente. Default: clinical-backend"
    echo "  -b, --branch BRANCH       Rama a monitorear. Default: main"
    echo "  -n, --notification EMAIL  Email para notificaciones del pipeline"
    echo "  --dry-run                 Solo mostrar lo que se haría"
    echo "  -h, --help                Mostrar esta ayuda"
    echo
    echo "Ejemplos:"
    echo "  $0 -e production -r us-west-2"
    echo "  $0 -g myuser/myrepo -t ghp_token123 -e staging"
    echo "  $0 -c my-codecommit-repo -b develop"
}

# Parsear argumentos
GITHUB_REPO=""
GITHUB_TOKEN=""
CODECOMMIT_REPO="clinical-backend"
BRANCH_NAME="main"
NOTIFICATION_EMAIL=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            STACK_NAME="${PROJECT_NAME}-pipeline-${ENVIRONMENT}"
            shift 2
            ;;
        -r|--region)
            AWS_REGION="$2"
            shift 2
            ;;
        -p|--project)
            PROJECT_NAME="$2"
            STACK_NAME="${PROJECT_NAME}-pipeline-${ENVIRONMENT}"
            shift 2
            ;;
        -g|--github)
            GITHUB_REPO="$2"
            shift 2
            ;;
        -t|--token)
            GITHUB_TOKEN="$2"
            shift 2
            ;;
        -c|--codecommit)
            CODECOMMIT_REPO="$2"
            shift 2
            ;;
        -b|--branch)
            BRANCH_NAME="$2"
            shift 2
            ;;
        -n|--notification)
            NOTIFICATION_EMAIL="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "Opción desconocida: $1"
            usage
            exit 1
            ;;
    esac
done

# Validaciones
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    log_error "Entorno debe ser: dev, staging, o production"
    exit 1
fi

if [[ -n "$GITHUB_REPO" && -z "$GITHUB_TOKEN" ]]; then
    log_error "Token de GitHub requerido cuando se usa GitHub como fuente"
    exit 1
fi

if [[ -n "$GITHUB_REPO" && ! "$GITHUB_REPO" =~ ^[^/]+/[^/]+$ ]]; then
    log_error "Formato de repositorio GitHub inválido. Usar: owner/repo"
    exit 1
fi

# Verificar dependencias
if ! command -v aws &> /dev/null; then
    log_error "AWS CLI no está instalado"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    log_error "jq no está instalado. Instalar con: brew install jq"
    exit 1
fi

# Verificar credenciales AWS
if ! aws sts get-caller-identity &> /dev/null; then
    log_error "Credenciales AWS no configuradas o expiradas"
    log_info "Ejecuta: aws configure sso"
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
log_info "Cuenta AWS: $AWS_ACCOUNT_ID"
log_info "Región: $AWS_REGION"
log_info "Entorno: $ENVIRONMENT"

# Construir parámetros de CloudFormation
PARAMETERS="ParameterKey=ProjectName,ParameterValue=$PROJECT_NAME"
PARAMETERS="$PARAMETERS ParameterKey=Environment,ParameterValue=$ENVIRONMENT"
PARAMETERS="$PARAMETERS ParameterKey=BranchName,ParameterValue=$BRANCH_NAME"

if [[ -n "$GITHUB_REPO" ]]; then
    IFS='/' read -r GITHUB_OWNER GITHUB_REPO_NAME <<< "$GITHUB_REPO"
    PARAMETERS="$PARAMETERS ParameterKey=GitHubOwner,ParameterValue=$GITHUB_OWNER"
    PARAMETERS="$PARAMETERS ParameterKey=GitHubRepo,ParameterValue=$GITHUB_REPO_NAME"
    PARAMETERS="$PARAMETERS ParameterKey=GitHubToken,ParameterValue=$GITHUB_TOKEN"
    log_info "Fuente: GitHub ($GITHUB_REPO)"
else
    PARAMETERS="$PARAMETERS ParameterKey=CodeCommitRepo,ParameterValue=$CODECOMMIT_REPO"
    log_info "Fuente: CodeCommit ($CODECOMMIT_REPO)"
fi

if [[ -n "$NOTIFICATION_EMAIL" ]]; then
    PARAMETERS="$PARAMETERS ParameterKey=NotificationEmail,ParameterValue=$NOTIFICATION_EMAIL"
    log_info "Notificaciones: $NOTIFICATION_EMAIL"
fi

TEMPLATE_PATH="../infrastructure/pipeline.yaml"
if [[ ! -f "$TEMPLATE_PATH" ]]; then
    log_error "Template no encontrado: $TEMPLATE_PATH"
    exit 1
fi

# Comando de deployment
DEPLOY_CMD="aws cloudformation deploy \
  --template-file $TEMPLATE_PATH \
  --stack-name $STACK_NAME \
  --parameter-overrides $PARAMETERS \
  --capabilities CAPABILITY_NAMED_IAM \
  --region $AWS_REGION \
  --tags \
    Project=$PROJECT_NAME \
    Environment=$ENVIRONMENT \
    ManagedBy=script"

if [[ "$DRY_RUN" == "true" ]]; then
    log_info "DRY RUN - Comando que se ejecutaría:"
    echo "$DEPLOY_CMD"
    exit 0
fi

# Deployment
log_info "🚀 Desplegando pipeline de CI/CD..."
echo

if eval "$DEPLOY_CMD"; then
    log_success "Pipeline desplegado exitosamente!"
    
    # Obtener información del stack
    STACK_INFO=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs' 2>/dev/null || echo "[]")
    
    if [[ "$STACK_INFO" != "[]" ]]; then
        echo
        log_info "📋 Información del Pipeline:"
        echo "$STACK_INFO" | jq -r '.[] | "  \(.OutputKey): \(.OutputValue)"'
    fi
    
    # Mostrar URLs útiles
    echo
    log_info "🔗 Enlaces útiles:"
    PIPELINE_URL="https://${AWS_REGION}.console.aws.amazon.com/codesuite/codepipeline/pipelines/${PROJECT_NAME}-pipeline-${ENVIRONMENT}/view"
    CODEBUILD_URL="https://${AWS_REGION}.console.aws.amazon.com/codesuite/codebuild/projects/${PROJECT_NAME}-build-${ENVIRONMENT}"
    
    echo "  Pipeline:  $PIPELINE_URL"
    echo "  CodeBuild: $CODEBUILD_URL"
    
    echo
    log_success "🎉 ¡Deployment completado!"
    log_info "El pipeline se ejecutará automáticamente con los próximos commits a la rama '$BRANCH_NAME'"
    
else
    log_error "❌ Error en el deployment"
    exit 1
fi

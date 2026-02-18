#!/bin/bash

# Script para ejecutar el servidor local con configuración automática
set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Ir al directorio backend
cd "$(dirname "$0")/.."

# Verificar que existe .env.local
if [[ ! -f ".env.local" ]]; then
    log_error "Archivo .env.local no encontrado"
    log_info "Ejecuta primero: ./scripts/setup-local-dev.sh"
    exit 1
fi

# Cargar variables del .env.local
log_info "Cargando configuración de .env.local..."
set -a  # export automático de variables
source .env.local
set +a

# Verificar configuración crítica
if [[ "$USE_DYNAMODB" == "true" && -n "$AWS_PROFILE" ]]; then
    log_info "🗄️ Configuración: DynamoDB AWS con perfil '$AWS_PROFILE'"
    
    # Verificar que AWS SSO esté activo
    if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &>/dev/null; then
        log_warning "AWS SSO no está activo o expirado"
        log_info "Ejecutando: aws sso login --profile $AWS_PROFILE"
        
        if aws sso login --profile "$AWS_PROFILE"; then
            log_success "AWS SSO login exitoso"
        else
            log_error "Error en AWS SSO login"
            log_info "Cambiando a modo in-memory para esta sesión"
            export USE_DYNAMODB=false
        fi
    else
        ACCOUNT_ID=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text 2>/dev/null)
        log_success "AWS SSO activo (Cuenta: $ACCOUNT_ID)"
    fi
elif [[ "$USE_DYNAMODB" == "false" ]]; then
    log_info "🗂️ Configuración: Repositorios in-memory (desarrollo rápido)"
else
    log_warning "Configuración incompleta, usando in-memory por defecto"
    export USE_DYNAMODB=false
fi

# Verificar que el puerto esté disponible
if lsof -i :"$LOCAL_HTTP_PORT" &>/dev/null; then
    log_warning "Puerto $LOCAL_HTTP_PORT está en uso"
    log_info "¿Deseas continuar? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

# Verificar dependencias Go
if ! go mod verify &>/dev/null; then
    log_info "Verificando dependencias Go..."
    go mod download
fi

log_info "🚀 Iniciando servidor Clinical Backend..."
log_info "📡 URL: http://localhost:$LOCAL_HTTP_PORT"
log_info "🗄️ DynamoDB: $USE_DYNAMODB"
log_info "👤 AWS Profile: ${AWS_PROFILE:-'N/A'}"
log_info ""
log_info "Presiona Ctrl+C para detener"
echo

# Ejecutar servidor
exec go run ./cmd/api

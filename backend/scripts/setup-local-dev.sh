#!/bin/bash

# Script para configurar el entorno de desarrollo local
# Este script configura AWS SSO y variables de entorno para desarrollo local

set -e

echo "🔧 Configurando entorno de desarrollo local para Clinical Backend..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para mostrar mensajes
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar si AWS CLI está instalado
if ! command -v aws &> /dev/null; then
    log_error "AWS CLI no está instalado. Por favor instala AWS CLI v2."
    echo "Instrucciones: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Verificar si Go está instalado
if ! command -v go &> /dev/null; then
    log_error "Go no está instalado. Por favor instala Go 1.22+"
    exit 1
fi

# Verificar versión de Go
GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
if [[ $(echo -e "1.22\n$GO_VERSION" | sort -V | head -n1) != "1.22" ]]; then
    log_error "Se requiere Go 1.22 o superior. Versión actual: $GO_VERSION"
    exit 1
fi

log_success "Go versión $GO_VERSION está instalado"

# Crear archivo .env para desarrollo local
ENV_FILE=".env.local"
if [[ ! -f "$ENV_FILE" ]]; then
    log_info "Creando archivo de configuración local: $ENV_FILE"
    cat > "$ENV_FILE" << EOF
# Configuración para desarrollo local
ENVIRONMENT=dev
LOCAL_HTTP=true
LOCAL_HTTP_PORT=3000

# DynamoDB Configuration (usar 'true' para testing con DynamoDB real)
USE_DYNAMODB=false
APPOINTMENT_TABLE=clinical-appointments-dev
PATIENT_TABLE=clinical-patients-dev
CONSENT_TABLE=clinical-consents-dev

# AWS Profile para desarrollo (configurar después de SSO)
# AWS_PROFILE=your-sso-profile

# Notificaciones (deshabilitadas por defecto en desarrollo)
SEND_SMS=false
SEND_EMAIL=false

# Para usar DynamoDB Local (opcional)
# AWS_ENDPOINT_URL_DYNAMODB=http://localhost:8000
EOF
    log_success "Archivo $ENV_FILE creado"
else
    log_info "Archivo $ENV_FILE ya existe"
fi

# Verificar si SAM CLI está instalado
if ! command -v sam &> /dev/null; then
    log_warning "SAM CLI no está instalado. Recomendado para despliegues."
    log_info "Para instalar: brew install aws/tap/aws-sam-cli"
fi

# Configurar perfil AWS SSO (interactivo)
echo
log_info "Configuración de AWS SSO:"
echo "Para usar DynamoDB en desarrollo, necesitas configurar AWS SSO o credenciales."
echo
echo "Opciones disponibles:"
echo "1. Continuar sin configurar AWS (usar repositorios in-memory)"
echo "2. Configurar AWS SSO profile"
echo "3. Usar credenciales AWS existentes"
echo

read -p "Selecciona una opción (1-3): " choice

case $choice in
    1)
        log_info "Continuando sin configuración AWS. Se usarán repositorios in-memory."
        ;;
    2)
        echo
        log_info "Para configurar AWS SSO, ejecuta:"
        echo "  aws configure sso"
        echo
        log_info "Después, actualiza AWS_PROFILE en $ENV_FILE con el nombre de tu profile"
        log_info "y cambia USE_DYNAMODB=true para usar DynamoDB real"
        ;;
    3)
        log_info "Asegúrate de que tus credenciales AWS estén configuradas:"
        echo "  aws configure"
        echo
        log_info "Luego cambia USE_DYNAMODB=true en $ENV_FILE"
        ;;
    *)
        log_warning "Opción no válida. Continuando sin configuración AWS."
        ;;
esac

# Instalar dependencias Go
log_info "Instalando dependencias Go..."
go mod tidy
go mod download
log_success "Dependencias instaladas"

# Construir el proyecto
log_info "Compilando proyecto..."
if go build -o bin/api ./cmd/api; then
    log_success "Proyecto compilado exitosamente"
else
    log_error "Error al compilar el proyecto"
    exit 1
fi

# Instrucciones finales
echo
log_success "🎉 Configuración completada!"
echo
echo "Para iniciar el servidor de desarrollo:"
echo "  source $ENV_FILE"
echo "  LOCAL_HTTP=true LOCAL_HTTP_PORT=3000 go run ./cmd/api"
echo
echo "O usar el binario compilado:"
echo "  source $ENV_FILE"
echo "  LOCAL_HTTP=true LOCAL_HTTP_PORT=3000 ./bin/api"
echo
echo "El servidor estará disponible en: http://localhost:3000"
echo
echo "Para usar DynamoDB real:"
echo "1. Configura AWS SSO o credenciales"
echo "2. Actualiza USE_DYNAMODB=true en $ENV_FILE"
echo "3. Opcionalmente actualiza AWS_PROFILE en $ENV_FILE"
echo
log_info "¡Happy coding! 🚀"

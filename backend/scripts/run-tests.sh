#!/bin/bash

# Script para ejecutar tests de integración con la configuración local
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
log_info "🔧 Cargando configuración de .env.local..."
set -a
source .env.local
set +a

echo
log_info "🧪 Clinical Backend - Test Suite"
log_info "================================="
log_info "🗄️ DynamoDB: $USE_DYNAMODB"
log_info "👤 AWS Profile: ${AWS_PROFILE:-'N/A'}"
log_info "🌍 Entorno: $ENVIRONMENT"
echo

# Función para ejecutar diferentes tipos de tests
run_unit_tests() {
    log_info "🔬 Ejecutando tests unitarios..."
    go test -v -race -short -coverprofile=coverage.out ./internal/...
    if [[ $? -eq 0 ]]; then
        log_success "Tests unitarios completados"
        
        # Mostrar coverage
        COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}')
        log_info "📊 Cobertura total: $COVERAGE"
        
        # Generar reporte HTML
        go tool cover -html=coverage.out -o coverage.html
        log_info "📋 Reporte HTML generado: coverage.html"
    else
        log_error "Tests unitarios fallaron"
        return 1
    fi
}

run_integration_tests() {
    log_info "🔗 Ejecutando tests de integración..."
    
    # Verificar AWS SSO si es necesario
    if [[ "$USE_DYNAMODB" == "true" && -n "$AWS_PROFILE" ]]; then
        if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &>/dev/null; then
            log_warning "AWS SSO no está activo"
            log_info "Ejecutando: aws sso login --profile $AWS_PROFILE"
            aws sso login --profile "$AWS_PROFILE"
        fi
        
        ACCOUNT_ID=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text 2>/dev/null)
        log_info "✅ AWS conectado (Cuenta: $ACCOUNT_ID)"
    fi
    
    go test -v -race -tags=integration ./test/...
    if [[ $? -eq 0 ]]; then
        log_success "Tests de integración completados"
    else
        log_error "Tests de integración fallaron"
        return 1
    fi
}

run_endpoint_tests() {
    log_info "🌐 Ejecutando tests de endpoints..."
    log_warning "Asegúrate de que el servidor esté corriendo en puerto $LOCAL_HTTP_PORT"
    log_info "Para iniciar: ./scripts/run-local.sh"
    echo
    
    # Verificar si el servidor está corriendo
    if ! curl -s -f "http://localhost:$LOCAL_HTTP_PORT/health" &>/dev/null; then
        # Intentar otros endpoints comunes
        if ! curl -s "http://localhost:$LOCAL_HTTP_PORT/" &>/dev/null; then
            log_warning "Servidor no detectado en puerto $LOCAL_HTTP_PORT"
            log_info "¿Deseas continuar con los tests? (y/n)"
            read -r response
            if [[ ! "$response" =~ ^[Yy]$ ]]; then
                log_info "Tests de endpoint cancelados"
                return 0
            fi
        fi
    fi
    
    # Ejecutar tests específicos de endpoints
    go test -v -race -tags=endpoint ./test/...
}

show_help() {
    echo "Uso: $0 [opción]"
    echo
    echo "Opciones:"
    echo "  unit         Ejecutar solo tests unitarios"
    echo "  integration  Ejecutar solo tests de integración (requiere AWS)"
    echo "  endpoint     Ejecutar solo tests de endpoints (requiere servidor activo)"
    echo "  all          Ejecutar todos los tests (por defecto)"
    echo "  coverage     Ver reporte de cobertura en el navegador"
    echo "  -h, --help   Mostrar esta ayuda"
}

# Parsear argumentos
case "${1:-all}" in
    unit)
        run_unit_tests
        ;;
    integration)
        run_integration_tests
        ;;
    endpoint)
        run_endpoint_tests
        ;;
    all)
        log_info "🚀 Ejecutando suite completa de tests..."
        echo
        
        run_unit_tests && \
        echo && \
        run_integration_tests && \
        echo && \
        run_endpoint_tests
        
        if [[ $? -eq 0 ]]; then
            echo
            log_success "🎉 Todos los tests completados exitosamente!"
        else
            log_error "❌ Algunos tests fallaron"
            exit 1
        fi
        ;;
    coverage)
        if [[ -f "coverage.html" ]]; then
            log_info "🌐 Abriendo reporte de cobertura..."
            open coverage.html || log_info "Abre manualmente: coverage.html"
        else
            log_warning "Reporte de cobertura no encontrado"
            log_info "Ejecuta primero: $0 unit"
        fi
        ;;
    -h|--help)
        show_help
        ;;
    *)
        log_error "Opción no válida: $1"
        show_help
        exit 1
        ;;
esac

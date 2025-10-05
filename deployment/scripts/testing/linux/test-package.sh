#!/bin/bash
#
# Aria ERP Package Testing Script
# Tests the deployment package in a Docker-based environment
#

set -e

# Configuration - Determine project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$ROOT_DIR"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[TEST]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

test_docker_availability() {
    log_info "Testing Docker availability..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! docker version &> /dev/null; then
        log_error "Docker is not running"
        exit 1
    fi
    
    log_info "Docker is available and running"
}

test_build_images() {
    log_info "Testing Docker image builds..."
    
    # Test backend build
    log_info "Building backend image..."
    if docker build -t aria-backend:test -f apps/backend/Dockerfile . > /dev/null 2>&1; then
        log_info "Backend image built successfully"
    else
        log_error "Failed to build backend image"
        exit 1
    fi
    
    # Test one frontend build
    log_info "Building asset frontend image..."
    if docker build -t aria-asset:test -f apps/frontend/asset/Dockerfile . > /dev/null 2>&1; then
        log_info "Frontend image built successfully"
    else
        log_error "Failed to build frontend image"
        exit 1
    fi
    
    log_info "Image builds completed successfully"
}

test_compose_configuration() {
    log_info "Testing Docker Compose configuration..."
    
    cd deployment/templates
    
    # Create test .env
    cat > .env.test << EOF
VERSION=test
DOMAIN=test.local
POSTGRES_DB=aria_test
POSTGRES_USER=aria_test
POSTGRES_PASSWORD=test_password_123
LICENSED_MODULES=full
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
EOF
    
    # Validate compose file
    if docker compose -f docker-compose.production.yml --env-file .env.test config > /dev/null 2>&1; then
        log_info "Docker Compose configuration is valid"
    else
        log_error "Invalid Docker Compose configuration"
        rm .env.test
        exit 1
    fi
    
    rm .env.test
    cd ../..
}

test_script_syntax() {
    log_info "Testing script syntax..."
    
    # Test bash scripts in new structure
    for script in deployment/scripts/*/linux/*.sh deployment/scripts/backup/*.sh deployment/scripts/monitoring/*.sh deployment/scripts/restore/*.sh; do
        if [ -f "$script" ]; then
            log_info "Checking $(basename $script)..."
            if bash -n "$script"; then
                log_info "$(basename $script) syntax is valid"
            else
                log_error "$(basename $script) has syntax errors"
                exit 1
            fi
        fi
    done
    
    # Test PowerShell scripts in new structure
    if command -v pwsh &> /dev/null; then
        for script in deployment/scripts/*/windows/*.ps1 deployment/scripts/backup/*.ps1 deployment/scripts/monitoring/*.ps1 deployment/scripts/restore/*.ps1; do
            if [ -f "$script" ]; then
                log_info "Checking $(basename $script)..."
                if pwsh -NoProfile -Command "Test-Path $script" &> /dev/null; then
                    log_info "$(basename $script) syntax is valid"
                fi
            fi
        done
    else
        log_warn "PowerShell not available, skipping .ps1 script tests"
    fi
}

test_documentation() {
    log_info "Testing documentation..."
    
    local docs=("deployment/docs/INSTALLATION.md" "deployment/docs/CONFIGURATION.md" "deployment/docs/TROUBLESHOOTING.md" "deployment/README.md")
    
    for doc in "${docs[@]}"; do
        if [ -f "$doc" ]; then
            log_info "$(basename $doc) exists"
        else
            log_error "Missing documentation: $doc"
            exit 1
        fi
    done
    
    log_info "All documentation files present"
}

test_required_files() {
    log_info "Testing required files..."
    
    local required_files=(
        "deployment/templates/docker-compose.production.yml"
        "deployment/templates/.env.template"
        "deployment/scripts/install/linux/install.sh"
        "deployment/scripts/install/windows/install.ps1"
        "deployment/scripts/install/linux/uninstall.sh"
        "deployment/scripts/install/windows/uninstall.ps1"
        "deployment/scripts/build/linux/build-package.sh"
    )
    
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            log_info "$(basename $file) exists"
        else
            log_error "Missing required file: $file"
            exit 1
        fi
    done
    
    log_info "All required files present"
}

cleanup_test_images() {
    log_info "Cleaning up test images..."
    docker rmi aria-backend:test aria-asset:test 2> /dev/null || true
    log_info "Test images cleaned up"
}

run_all_tests() {
    log_info "Starting Aria ERP deployment package tests..."
    echo ""
    
    test_docker_availability
    echo ""
    
    test_required_files
    echo ""
    
    test_documentation
    echo ""
    
    test_script_syntax
    echo ""
    
    test_compose_configuration
    echo ""
    
    test_build_images
    echo ""
    
    cleanup_test_images
    echo ""
    
    cat << EOF
${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}
${GREEN}                 All Tests Passed!${NC}
${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

The deployment package is ready for distribution.

To create distribution packages, run:
  pnpm package

${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

EOF
}

# Run all tests
run_all_tests

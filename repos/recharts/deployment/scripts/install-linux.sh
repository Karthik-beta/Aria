#!/bin/bash
# Aria ERP Installation Script for Linux
# This script installs and configures Aria ERP on a Linux system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/aria"
SERVICE_NAME="aria-erp"
MIN_DOCKER_VERSION="24.0"
MIN_COMPOSE_VERSION="2.20"

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}==>${NC} $1"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Check system requirements
check_requirements() {
    log_step "Checking system requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        log_info "Please install Docker first: https://docs.docker.com/engine/install/"
        exit 1
    fi
    
    DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+' | head -1)
    log_info "Docker version: $DOCKER_VERSION"
    
    if ! command -v docker compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        log_info "Please install Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    COMPOSE_VERSION=$(docker compose version | grep -oP '\d+\.\d+' | head -1)
    log_info "Docker Compose version: $COMPOSE_VERSION"
    
    # Check disk space (minimum 20GB)
    AVAILABLE_SPACE=$(df / | tail -1 | awk '{print $4}')
    if [ "$AVAILABLE_SPACE" -lt 20971520 ]; then
        log_warn "Less than 20GB disk space available"
    fi
    
    # Check memory (minimum 4GB)
    TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
    if [ "$TOTAL_MEM" -lt 4096 ]; then
        log_warn "Less than 4GB RAM available (recommended: 8GB)"
    fi
    
    log_info "✓ System requirements check passed"
}

# Create installation directory
create_install_dir() {
    log_step "Creating installation directory..."
    
    if [ -d "$INSTALL_DIR" ]; then
        log_warn "Installation directory already exists: $INSTALL_DIR"
        read -p "Do you want to continue? This will overwrite existing files. (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_error "Installation cancelled"
            exit 1
        fi
        log_info "Backing up existing installation..."
        mv "$INSTALL_DIR" "${INSTALL_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    mkdir -p "$INSTALL_DIR"
    log_info "✓ Installation directory created: $INSTALL_DIR"
}

# Copy application files
copy_files() {
    log_step "Copying application files..."
    
    # Copy from current directory to install directory
    cp -r ./* "$INSTALL_DIR/"
    
    # Set proper permissions
    chown -R root:root "$INSTALL_DIR"
    chmod -R 755 "$INSTALL_DIR"
    
    log_info "✓ Application files copied"
}

# Configure environment
configure_environment() {
    log_step "Configuring environment..."
    
    if [ ! -f "$INSTALL_DIR/.env" ]; then
        if [ -f "$INSTALL_DIR/.env.production.template" ]; then
            cp "$INSTALL_DIR/.env.production.template" "$INSTALL_DIR/.env"
            log_warn "Environment file created from template"
            log_warn "IMPORTANT: Edit $INSTALL_DIR/.env and set all required values"
            log_warn "Especially: POSTGRES_PASSWORD, JWT_SECRET, DOMAIN"
        else
            log_error "Environment template not found"
            exit 1
        fi
    else
        log_info "Existing environment file found, keeping it"
    fi
    
    log_info "✓ Environment configured"
}

# Generate SSL certificates
generate_ssl_certificates() {
    log_step "Generating SSL certificates..."
    
    # Check if certificates already exist
    if [ -f "$INSTALL_DIR/deployment/caddy/certs/server.crt" ]; then
        log_info "SSL certificates already exist, skipping generation"
        return
    fi
    
    # Generate certificates using the provided script
    if [ -f "$INSTALL_DIR/deployment/ssl/generate-certs.sh" ]; then
        cd "$INSTALL_DIR/deployment/ssl"
        chmod +x generate-certs.sh
        
        # Run certificate generation
        CERT_DIR="$INSTALL_DIR/deployment/caddy/certs" \
        DOMAIN="${DOMAIN:-localhost}" \
        ./generate-certs.sh
        
        cd "$INSTALL_DIR"
        log_info "✓ SSL certificates generated"
    else
        log_warn "Certificate generation script not found, skipping"
    fi
}

# Build Docker images
build_images() {
    log_step "Building Docker images..."
    
    cd "$INSTALL_DIR"
    
    # Pull base images first
    log_info "Pulling base images..."
    docker compose -f docker-compose.production.yml pull --quiet || true
    
    # Build custom images
    log_info "Building application images (this may take a while)..."
    docker compose -f docker-compose.production.yml build --no-cache
    
    log_info "✓ Docker images built successfully"
}

# Install systemd service
install_service() {
    log_step "Installing systemd service..."
    
    # Copy service file
    cp "$INSTALL_DIR/deployment/systemd/aria-erp.service" "/etc/systemd/system/$SERVICE_NAME.service"
    
    # Reload systemd
    systemctl daemon-reload
    
    # Enable service
    systemctl enable "$SERVICE_NAME.service"
    
    log_info "✓ Systemd service installed and enabled"
}

# Start application
start_application() {
    log_step "Starting Aria ERP application..."
    
    systemctl start "$SERVICE_NAME.service"
    
    # Wait for services to start
    log_info "Waiting for services to start (this may take up to 2 minutes)..."
    sleep 30
    
    # Check service status
    if systemctl is-active --quiet "$SERVICE_NAME.service"; then
        log_info "✓ Service started successfully"
    else
        log_error "Service failed to start"
        log_info "Check logs with: sudo journalctl -u $SERVICE_NAME.service -f"
        exit 1
    fi
}

# Health check
health_check() {
    log_step "Performing health check..."
    
    MAX_ATTEMPTS=12
    ATTEMPT=0
    
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if curl -f -s -o /dev/null http://localhost/health; then
            log_info "✓ Health check passed"
            return 0
        fi
        
        ATTEMPT=$((ATTEMPT + 1))
        log_info "Waiting for application to be ready... ($ATTEMPT/$MAX_ATTEMPTS)"
        sleep 10
    done
    
    log_warn "Health check timed out, but service is running"
    log_info "Check application logs: sudo docker compose -f $INSTALL_DIR/docker-compose.production.yml logs"
}

# Display installation summary
display_summary() {
    echo
    echo "========================================"
    echo "  Aria ERP Installation Complete! "
    echo "========================================"
    echo
    log_info "Installation directory: $INSTALL_DIR"
    log_info "Service name: $SERVICE_NAME"
    echo
    log_info "Useful commands:"
    echo "  Start:   sudo systemctl start $SERVICE_NAME"
    echo "  Stop:    sudo systemctl stop $SERVICE_NAME"
    echo "  Restart: sudo systemctl restart $SERVICE_NAME"
    echo "  Status:  sudo systemctl status $SERVICE_NAME"
    echo "  Logs:    sudo journalctl -u $SERVICE_NAME -f"
    echo
    log_info "Docker Compose commands:"
    echo "  Logs:    sudo docker compose -f $INSTALL_DIR/docker-compose.production.yml logs -f"
    echo "  Down:    sudo docker compose -f $INSTALL_DIR/docker-compose.production.yml down"
    echo "  Restart: sudo docker compose -f $INSTALL_DIR/docker-compose.production.yml restart"
    echo
    log_warn "IMPORTANT: Before accessing the application:"
    echo "  1. Edit $INSTALL_DIR/.env and set all required values"
    echo "  2. Restart the service: sudo systemctl restart $SERVICE_NAME"
    echo
    log_info "Access the application at:"
    echo "  HTTP:  http://$(hostname -I | awk '{print $1}')"
    echo "  HTTPS: https://$(hostname -I | awk '{print $1}')"
    echo
    echo "========================================"
}

# Main installation flow
main() {
    log_info "Starting Aria ERP installation..."
    echo
    
    check_root
    check_requirements
    create_install_dir
    copy_files
    configure_environment
    generate_ssl_certificates
    build_images
    install_service
    start_application
    health_check
    display_summary
    
    log_info "Installation completed successfully!"
}

# Run main function
main "$@"

#!/bin/bash
#
# Aria ERP Installation Script for Linux
# Supports: Ubuntu 20.04+, Debian 11+, CentOS 8+, RHEL 8+
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/aria-erp"
SERVICE_NAME="aria-erp"
VERSION=""
MODULES=""
DOMAIN="localhost"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root. Use: sudo $0"
        exit 1
    fi
}

# Attempt to install Docker automatically using the official convenience script
install_docker() {
    log_info "Docker not found. Attempting automated installation using the official Docker convenience script..."

    if ! command -v curl &> /dev/null; then
        log_error "curl is required to install Docker automatically. Please install curl or install Docker manually."
        return 1
    fi

    if curl -fsSL https://get.docker.com -o /tmp/get-docker.sh; then
        sh /tmp/get-docker.sh
        rm -f /tmp/get-docker.sh
    else
        log_error "Failed to download Docker install script. Please install Docker manually: https://docs.docker.com/engine/install/"
        return 1
    fi

    if command -v systemctl &> /dev/null; then
        systemctl enable docker || true
        systemctl start docker || true
    fi

    if ! command -v docker &> /dev/null; then
        log_error "Docker install attempted but 'docker' command not found. Install Docker manually."
        return 1
    fi

    log_info "Docker installed successfully."
    return 0
}

# Attempt to ensure Docker Compose is available (plugin or binary)
install_docker_compose() {
    log_info "Checking Docker Compose availability..."

    if docker compose version &> /dev/null; then
        log_info "Docker Compose (v2) is already available via 'docker compose'."
        return 0
    fi

    log_info "Attempting to install Docker Compose plugin/package..."

    if command -v apt-get &> /dev/null; then
        apt-get update
        apt-get install -y docker-compose-plugin || true
    elif command -v dnf &> /dev/null; then
        dnf install -y docker-compose-plugin || true
    elif command -v yum &> /dev/null; then
        yum install -y docker-compose-plugin || true
    fi

    if docker compose version &> /dev/null; then
        log_info "Docker Compose installed successfully."
        return 0
    fi

    log_warn "Docker Compose not available. You can still use the 'docker-compose' binary or install the compose plugin manually: https://docs.docker.com/compose/install/"
    return 1
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    local missing_deps=()
    
    if ! command -v docker &> /dev/null; then
        # Try to install Docker automatically; if it fails, mark as missing
        if ! install_docker; then
            missing_deps+=("docker")
        fi
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        # Try to install compose plugin/binary
        if ! install_docker_compose; then
            missing_deps+=("docker-compose")
        fi
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_info "Please install the missing dependencies manually or ensure the installer has network access."
        log_info "Docker docs: https://docs.docker.com/"
        exit 1
    fi
    
    log_info "All dependencies are installed."
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --install-dir)
                INSTALL_DIR="$2"
                shift 2
                ;;
            --modules)
                MODULES="$2"
                shift 2
                ;;
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --version)
                VERSION="$2"
                shift 2
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

show_help() {
    cat << EOF
Aria ERP Installation Script for Linux

Usage: $0 [OPTIONS]

Options:
    --install-dir PATH    Installation directory (default: /opt/aria-erp)
    --modules LIST        Comma-separated modules: asset,crm,hrms,inventory or 'full' (default: full)
    --domain DOMAIN       Domain name (default: localhost)
    --version VERSION     Version to install (default: latest)
    --help                Show this help message

Example:
    sudo $0 --modules asset,crm --domain erp.company.com
EOF
}

create_directories() {
    log_info "Creating installation directories..."
    
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$INSTALL_DIR/config/traefik"
    mkdir -p "$INSTALL_DIR/volumes/postgres"
    mkdir -p "$INSTALL_DIR/volumes/traefik"
    mkdir -p "$INSTALL_DIR/volumes/uploads"
    mkdir -p "$INSTALL_DIR/logs/backend"
    
    log_info "Directories created successfully."
}

copy_files() {
    log_info "Copying configuration files..."
    
    # Copy docker-compose file
    cp docker-compose.production.yml "$INSTALL_DIR/docker-compose.yml"
    
    # Copy environment template
    if [ ! -f "$INSTALL_DIR/.env" ]; then
        cp .env.template "$INSTALL_DIR/.env"
        log_info "Created .env file. Please update the configuration."
    else
        log_warn ".env file already exists. Skipping..."
    fi
    
    # Copy Traefik configuration
    if [ -d "config/traefik" ]; then
        cp -r config/traefik/* "$INSTALL_DIR/config/traefik/"
    fi
}

configure_environment() {
    log_info "Configuring environment..."
    
    local env_file="$INSTALL_DIR/.env"
    
    # Update configuration
    sed -i "s|DOMAIN=.*|DOMAIN=$DOMAIN|g" "$env_file"
    
    if [ -n "$MODULES" ]; then
        sed -i "s|LICENSED_MODULES=.*|LICENSED_MODULES=$MODULES|g" "$env_file"
    fi
    
    if [ -n "$VERSION" ]; then
        sed -i "s|VERSION=.*|VERSION=$VERSION|g" "$env_file"
    fi
    
    # Generate secure password if default is present
    if grep -q "changeme_secure_password" "$env_file"; then
        local new_password=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
        sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$new_password|g" "$env_file"
        log_info "Generated secure database password."
    fi
}

install_systemd_service() {
    log_info "Installing systemd service..."
    
    cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=Aria ERP System
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/docker compose --env-file .env up -d
ExecStop=/usr/bin/docker compose down
ExecReload=/usr/bin/docker compose restart
TimeoutStartSec=300
Restart=on-failure
RestartSec=30s

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    
    log_info "Systemd service installed successfully."
}

start_service() {
    log_info "Starting Aria ERP..."
    
    cd "$INSTALL_DIR"
    systemctl start "$SERVICE_NAME"
    
    # Wait for services to be ready
    log_info "Waiting for services to start..."
    sleep 10
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log_info "Aria ERP started successfully!"
    else
        log_error "Failed to start Aria ERP. Check logs with: journalctl -u $SERVICE_NAME"
        exit 1
    fi
}

show_completion_message() {
    cat << EOF

${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}
${GREEN}                 Aria ERP Installation Complete!${NC}
${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

Installation Directory: $INSTALL_DIR
Domain: $DOMAIN
Modules: ${MODULES:-full}

Service Management:
  Start:   sudo systemctl start $SERVICE_NAME
  Stop:    sudo systemctl stop $SERVICE_NAME
  Restart: sudo systemctl restart $SERVICE_NAME
  Status:  sudo systemctl status $SERVICE_NAME
  Logs:    sudo journalctl -u $SERVICE_NAME -f

Configuration File: $INSTALL_DIR/.env

${YELLOW}Important:${NC}
- Update the .env file with your configuration
- Configure SSL certificates in: $INSTALL_DIR/volumes/traefik/
- Backend API: https://$DOMAIN/api
- Frontends: https://[module].$DOMAIN (e.g., https://asset.$DOMAIN)

For more information, visit: $INSTALL_DIR/docs/

${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

EOF
}

# Main installation flow
main() {
    log_info "Starting Aria ERP installation..."
    
    check_root
    parse_arguments "$@"
    check_dependencies
    create_directories
    copy_files
    configure_environment
    install_systemd_service
    start_service
    show_completion_message
}

# Run main function
main "$@"

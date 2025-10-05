#!/bin/bash
#
# Aria ERP Uninstallation Script for Linux
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

confirm_uninstall() {
    log_warn "This will remove Aria ERP and all associated data (application files, containers, volumes created by Aria). Docker engine will NOT be removed."
    read -p "Are you sure you want to continue? (yes/no): " -r
    echo
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Uninstallation cancelled."
        exit 0
    fi
}

# No command-line flags are supported for destructive Docker removal. Docker engine is preserved.

stop_service() {
    log_info "Stopping Aria ERP service..."
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        systemctl stop "$SERVICE_NAME"
    fi
    
    if systemctl is-enabled --quiet "$SERVICE_NAME"; then
        systemctl disable "$SERVICE_NAME"
    fi
    
    log_info "Service stopped."
}

remove_containers() {
    log_info "Removing Docker containers..."
    
    if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
        cd "$INSTALL_DIR"
        docker compose down -v 2>/dev/null || true
    fi
    
    log_info "Containers removed."
}

remove_service() {
    log_info "Removing systemd service..."
    
    if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
        rm "/etc/systemd/system/${SERVICE_NAME}.service"
        systemctl daemon-reload
    fi
    
    log_info "Service removed."
}

# Docker engine removal intentionally omitted. The system Docker installation is not modified by this script.

remove_installation() {
    log_info "Removing installation directory..."
    
    if [ -d "$INSTALL_DIR" ]; then
        rm -rf "$INSTALL_DIR"
    fi
    
    log_info "Installation directory removed."
}

main() {
    log_info "Starting Aria ERP uninstallation..."
    
    check_root
    confirm_uninstall
    stop_service
    remove_containers
    remove_service
    remove_installation
    
    # Docker engine and host-wide Docker data are left intact by design.
    
    log_info "Aria ERP has been completely removed."
}

main "$@"

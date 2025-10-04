#!/bin/bash
# Aria ERP - Configuration Restoration Script (Linux)
# Restores configuration files from backup with validation

set -euo pipefail

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
ARIA_HOME=${ARIA_HOME:-"/opt/aria-erp"}
BACKUP_SUFFIX="pre-restore-$(date +%Y%m%d_%H%M%S)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

# Confirm action
confirm_action() {
    local prompt=$1
    read -p "$prompt [y/N]: " -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warn "Operation cancelled by user"
        exit 0
    fi
}

# Backup current configuration
backup_current_config() {
    local backup_dir="$ARIA_HOME/config-backups/config-$BACKUP_SUFFIX"
    
    log_info "Backing up current configuration..."
    mkdir -p "$backup_dir"
    
    # Backup .env
    if [[ -f "$ARIA_HOME/.env" ]]; then
        cp "$ARIA_HOME/.env" "$backup_dir/.env"
        log_info "Backed up .env file"
    fi
    
    # Backup docker-compose.yml
    if [[ -f "$ARIA_HOME/docker-compose.yml" ]]; then
        cp "$ARIA_HOME/docker-compose.yml" "$backup_dir/docker-compose.yml"
        log_info "Backed up docker-compose.yml"
    fi
    
    # Backup Traefik config
    if [[ -d "$ARIA_HOME/config/traefik" ]]; then
        cp -r "$ARIA_HOME/config/traefik" "$backup_dir/"
        log_info "Backed up Traefik configuration"
    fi
    
    log_success "Current configuration backed up to: $backup_dir"
    echo "$backup_dir"
}

# Validate configuration files
validate_config() {
    local config_dir=$1
    local validation_failed=0
    
    log_info "Validating configuration files..."
    
    # Check .env file
    if [[ -f "$config_dir/.env" ]]; then
        # Check for required variables
        local required_vars=("POSTGRES_DB" "POSTGRES_USER" "POSTGRES_PASSWORD")
        for var in "${required_vars[@]}"; do
            if ! grep -q "^${var}=" "$config_dir/.env"; then
                log_warn "Missing required variable: $var in .env"
                validation_failed=1
            fi
        done
        log_success ".env file structure valid"
    else
        log_error ".env file not found in backup"
        return 1
    fi
    
    # Check docker-compose.yml
    if [[ -f "$config_dir/docker-compose.yml" ]]; then
        if command -v docker-compose &> /dev/null; then
            if docker-compose -f "$config_dir/docker-compose.yml" config &> /dev/null; then
                log_success "docker-compose.yml syntax valid"
            else
                log_error "docker-compose.yml syntax invalid"
                return 1
            fi
        else
            log_warn "docker-compose not available for validation, skipping"
        fi
    else
        log_error "docker-compose.yml not found in backup"
        return 1
    fi
    
    if [[ $validation_failed -eq 1 ]]; then
        log_warn "Configuration validation completed with warnings"
    else
        log_success "Configuration validation passed"
    fi
    
    return 0
}

# Restore .env file
restore_env_file() {
    local source_file=$1
    local target_file="$ARIA_HOME/.env"
    
    log_info "Restoring .env file..."
    
    cp "$source_file" "$target_file"
    chmod 600 "$target_file"
    
    log_success ".env file restored"
}

# Restore docker-compose.yml
restore_compose_file() {
    local source_file=$1
    local target_file="$ARIA_HOME/docker-compose.yml"
    
    log_info "Restoring docker-compose.yml..."
    
    cp "$source_file" "$target_file"
    chmod 644 "$target_file"
    
    log_success "docker-compose.yml restored"
}

# Restore Traefik configuration
restore_traefik_config() {
    local source_dir=$1
    local target_dir="$ARIA_HOME/config/traefik"
    
    log_info "Restoring Traefik configuration..."
    
    # Create directory if it doesn't exist
    mkdir -p "$target_dir"
    
    # Copy files
    cp -r "$source_dir"/* "$target_dir/"
    
    # Set permissions
    find "$target_dir" -type f -exec chmod 644 {} \;
    find "$target_dir" -type d -exec chmod 755 {} \;
    
    log_success "Traefik configuration restored"
}

# Restart services
restart_services() {
    log_info "Restarting Aria ERP services..."
    
    cd "$ARIA_HOME"
    
    # Check if services are running
    if docker-compose ps -q | grep -q .; then
        log_info "Stopping services..."
        docker-compose down || {
            log_warn "Failed to stop services gracefully"
        }
    fi
    
    log_info "Starting services with new configuration..."
    if docker-compose up -d; then
        log_success "Services restarted successfully"
        return 0
    else
        log_error "Failed to start services"
        return 1
    fi
}

# Rollback configuration
rollback_config() {
    local backup_dir=$1
    
    log_warn "Rolling back configuration..."
    
    if [[ -d "$backup_dir" ]]; then
        # Restore from backup
        [[ -f "$backup_dir/.env" ]] && cp "$backup_dir/.env" "$ARIA_HOME/.env"
        [[ -f "$backup_dir/docker-compose.yml" ]] && cp "$backup_dir/docker-compose.yml" "$ARIA_HOME/docker-compose.yml"
        [[ -d "$backup_dir/traefik" ]] && cp -r "$backup_dir/traefik"/* "$ARIA_HOME/config/traefik/"
        
        log_success "Configuration rolled back"
        restart_services
    else
        log_error "Backup directory not found, cannot rollback"
    fi
}

# Main function
main() {
    echo "========================================"
    echo "   Aria ERP Configuration Restoration"
    echo "========================================"
    echo ""
    
    check_root
    
    # Get backup directory
    if [[ $# -eq 0 ]]; then
        log_error "Usage: $0 <backup-directory>"
        log_info "Example: $0 /path/to/aria-erp-backup-20250104_120000"
        exit 1
    fi
    
    local backup_dir=$1
    
    # Check if backup directory exists
    if [[ ! -d "$backup_dir" ]]; then
        log_error "Backup directory not found: $backup_dir"
        exit 1
    fi
    
    # Check if config directory exists in backup
    local config_backup_dir="$backup_dir/config"
    if [[ ! -d "$config_backup_dir" ]]; then
        log_error "Configuration backup not found in: $backup_dir"
        exit 1
    fi
    
    log_info "Using configuration from: $config_backup_dir"
    
    # Validate configuration
    if ! validate_config "$config_backup_dir"; then
        log_error "Configuration validation failed"
        exit 1
    fi
    
    # Confirm restoration
    echo ""
    log_warn "WARNING: This will replace your current configuration!"
    echo ""
    confirm_action "Are you sure you want to proceed with configuration restoration?"
    
    # Backup current configuration
    local current_backup
    current_backup=$(backup_current_config)
    
    # Restore configuration files
    [[ -f "$config_backup_dir/.env" ]] && restore_env_file "$config_backup_dir/.env"
    [[ -f "$config_backup_dir/docker-compose.yml" ]] && restore_compose_file "$config_backup_dir/docker-compose.yml"
    [[ -d "$config_backup_dir/traefik" ]] && restore_traefik_config "$config_backup_dir/traefik"
    
    # Restart services
    if ! restart_services; then
        log_error "Failed to restart services with new configuration"
        confirm_action "Do you want to rollback to previous configuration?"
        rollback_config "$current_backup"
        exit 1
    fi
    
    echo ""
    echo "========================================"
    log_success "Configuration restoration completed!"
    log_info "Previous configuration backed up to: $current_backup"
    echo "========================================"
}

# Run main function
main "$@"

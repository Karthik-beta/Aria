#!/bin/bash
# Aria ERP - Backup Manager (Linux)
# Automated backup system with smart storage detection and rotation

set -euo pipefail

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
BACKUP_COMPRESSION=${BACKUP_COMPRESSION:-gzip}
COMPOSE_FILE=${COMPOSE_FILE:-"/opt/aria-erp/docker-compose.yml"}
ENV_FILE=${ENV_FILE:-"/opt/aria-erp/.env"}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${BLUE}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

# Detect backup storage location
detect_storage() {
    local storage_result
    
    log_info "Detecting backup storage location..."
    
    if ! storage_result=$("$SCRIPT_DIR/detect-storage.sh"); then
        log_error "Failed to detect suitable backup storage"
        return 1
    fi
    
    echo "$storage_result"
}

# Create backup directory structure
setup_backup_directory() {
    local backup_base=$1
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="${backup_base}/aria-erp-backup-${timestamp}"
    
    mkdir -p "$backup_dir"
    echo "$backup_dir"
}

# Backup database
backup_database() {
    local backup_dir=$1
    local db_container="aria-database"
    
    log_info "Backing up PostgreSQL database..."
    
    # Check if database container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${db_container}$"; then
        log_error "Database container '${db_container}' is not running"
        return 1
    fi
    
    # Get database credentials from environment
    local db_name=${POSTGRES_DB:-aria}
    local db_user=${POSTGRES_USER:-aria}
    
    # Perform database backup
    local db_backup_file="${backup_dir}/database.sql"
    
    if docker exec "$db_container" pg_dump -U "$db_user" "$db_name" > "$db_backup_file"; then
        log_success "Database backed up to: $db_backup_file"
        
        # Compress if requested
        if [[ "$BACKUP_COMPRESSION" == "gzip" ]]; then
            gzip "$db_backup_file"
            log_info "Database backup compressed: ${db_backup_file}.gz"
        fi
        return 0
    else
        log_error "Database backup failed"
        return 1
    fi
}

# Backup configuration files
backup_config() {
    local backup_dir=$1
    
    log_info "Backing up configuration files..."
    
    local config_backup_dir="${backup_dir}/config"
    mkdir -p "$config_backup_dir"
    
    # Backup environment file
    if [[ -f "$ENV_FILE" ]]; then
        cp "$ENV_FILE" "${config_backup_dir}/.env"
        log_info "Backed up .env file"
    fi
    
    # Backup docker-compose file
    if [[ -f "$COMPOSE_FILE" ]]; then
        cp "$COMPOSE_FILE" "${config_backup_dir}/docker-compose.yml"
        log_info "Backed up docker-compose.yml"
    fi
    
    # Backup Traefik configuration
    local traefik_config="/opt/aria-erp/config/traefik"
    if [[ -d "$traefik_config" ]]; then
        cp -r "$traefik_config" "${config_backup_dir}/"
        log_info "Backed up Traefik configuration"
    fi
    
    log_success "Configuration files backed up"
}

# Create backup manifest
create_manifest() {
    local backup_dir=$1
    local manifest_file="${backup_dir}/backup-manifest.txt"
    
    cat > "$manifest_file" << EOF
Aria ERP Backup Manifest
========================
Backup Date: $(date '+%Y-%m-%d %H:%M:%S')
Hostname: $(hostname)
Backup Directory: $backup_dir

Contents:
EOF
    
    find "$backup_dir" -type f | while read -r file; do
        local size=$(du -h "$file" | cut -f1)
        echo "  - ${file#$backup_dir/} (${size})" >> "$manifest_file"
    done
    
    log_info "Backup manifest created"
}

# Cleanup old backups
cleanup_old_backups() {
    local backup_base=$1
    
    log_info "Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days..."
    
    local deleted_count=0
    
    # Find and delete old backup directories
    find "$backup_base" -maxdepth 1 -type d -name "aria-erp-backup-*" -mtime "+${BACKUP_RETENTION_DAYS}" | while read -r old_backup; do
        log_info "Deleting old backup: $old_backup"
        rm -rf "$old_backup"
        ((deleted_count++))
    done
    
    if [[ $deleted_count -gt 0 ]]; then
        log_success "Deleted $deleted_count old backup(s)"
    else
        log_info "No old backups to delete"
    fi
}

# Verify backup integrity
verify_backup() {
    local backup_dir=$1
    
    log_info "Verifying backup integrity..."
    
    # Check if database backup exists
    local db_backup=$(find "$backup_dir" -name "database.sql*" | head -1)
    if [[ -z "$db_backup" ]]; then
        log_error "Database backup file not found"
        return 1
    fi
    
    # Check if config directory exists
    if [[ ! -d "${backup_dir}/config" ]]; then
        log_error "Configuration backup directory not found"
        return 1
    fi
    
    # Check if manifest exists
    if [[ ! -f "${backup_dir}/backup-manifest.txt" ]]; then
        log_error "Backup manifest not found"
        return 1
    fi
    
    log_success "Backup verification passed"
    return 0
}

# Main backup process
main() {
    echo "========================================"
    echo "   Aria ERP Automated Backup System"
    echo "========================================"
    echo ""
    
    check_root
    
    # Detect storage location
    local storage_info
    if ! storage_info=$(detect_storage); then
        log_error "Cannot proceed without valid backup storage"
        exit 1
    fi
    
    local storage_type=${storage_info%%:*}
    local storage_path=${storage_info#*:}
    
    log_info "Using backup storage: $storage_type at $storage_path"
    
    # Create backup directory
    local backup_dir
    if ! backup_dir=$(setup_backup_directory "$storage_path"); then
        log_error "Failed to create backup directory"
        exit 1
    fi
    
    log_info "Backup directory: $backup_dir"
    
    # Perform backups
    local backup_failed=0
    
    if ! backup_database "$backup_dir"; then
        log_error "Database backup failed"
        backup_failed=1
    fi
    
    if ! backup_config "$backup_dir"; then
        log_error "Configuration backup failed"
        backup_failed=1
    fi
    
    # Create manifest
    create_manifest "$backup_dir"
    
    # Verify backup
    if ! verify_backup "$backup_dir"; then
        log_error "Backup verification failed"
        backup_failed=1
    fi
    
    # Cleanup old backups
    cleanup_old_backups "$storage_path"
    
    # Final status
    echo ""
    echo "========================================"
    if [[ $backup_failed -eq 0 ]]; then
        log_success "Backup completed successfully!"
        log_info "Backup location: $backup_dir"
        log_info "Total size: $(du -sh "$backup_dir" | cut -f1)"
        exit 0
    else
        log_error "Backup completed with errors"
        exit 1
    fi
}

# Run main function
main "$@"

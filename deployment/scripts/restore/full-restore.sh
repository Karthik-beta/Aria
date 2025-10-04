#!/bin/bash
# Aria ERP - Full System Recovery Script (Linux)
# Orchestrates complete system restoration including database and configuration

set -euo pipefail

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Recovery state
RECOVERY_STATE="initial"
PRE_RECOVERY_BACKUP=""

# Logging
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

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# Check root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

# Display banner
show_banner() {
    echo ""
    echo "========================================"
    echo "   Aria ERP Full System Recovery"
    echo "========================================"
    echo ""
    echo "This script will:"
    echo "  1. Verify backup integrity"
    echo "  2. Create pre-recovery backup"
    echo "  3. Stop all services"
    echo "  4. Restore database"
    echo "  5. Restore configuration"
    echo "  6. Restart services"
    echo "  7. Verify system health"
    echo ""
    echo "========================================"
    echo ""
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

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        return 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        return 1
    fi
    
    log_success "Docker is available"
    
    # Check docker-compose
    if ! command -v docker-compose &> /dev/null; then
        log_warn "docker-compose not found, some operations may fail"
    else
        log_success "docker-compose is available"
    fi
    
    # Check restoration scripts
    if [[ ! -f "$SCRIPT_DIR/restore-database.sh" ]]; then
        log_error "Database restoration script not found"
        return 1
    fi
    
    if [[ ! -f "$SCRIPT_DIR/restore-config.sh" ]]; then
        log_error "Configuration restoration script not found"
        return 1
    fi
    
    log_success "Restoration scripts found"
    
    # Check health monitoring
    if [[ -f "$SCRIPT_DIR/../monitoring/health-check.sh" ]]; then
        log_success "Health check script available"
    else
        log_warn "Health check script not found"
    fi
    
    return 0
}

# Select backup
select_backup() {
    log_step "Selecting backup for restoration..."
    
    # Find backup directories
    local backup_locations=(
        "/opt/aria-erp/backups"
        "/media"
        "/mnt"
    )
    
    local backup_dirs=()
    for location in "${backup_locations[@]}"; do
        if [[ -d "$location" ]]; then
            while IFS= read -r -d '' backup_dir; do
                backup_dirs+=("$backup_dir")
            done < <(find "$location" -maxdepth 2 -type d -name "aria-erp-backup-*" -print0 2>/dev/null | head -20)
        fi
    done
    
    if [[ ${#backup_dirs[@]} -eq 0 ]]; then
        log_error "No backups found"
        return 1
    fi
    
    # Sort by date (newest first)
    IFS=$'\n' backup_dirs=($(sort -r <<<"${backup_dirs[*]}"))
    unset IFS
    
    echo "Available backups:"
    echo "=================="
    
    local index=1
    for backup_dir in "${backup_dirs[@]}"; do
        local backup_name=$(basename "$backup_dir")
        local timestamp=$(echo "$backup_name" | sed 's/aria-erp-backup-//')
        local size=$(du -sh "$backup_dir" 2>/dev/null | cut -f1)
        
        echo "[$index] $timestamp - Size: $size"
        echo "    Path: $backup_dir"
        
        # Check contents
        [[ -f "$backup_dir/database.sql" || -f "$backup_dir/database.sql.gz" ]] && echo "    ✓ Database backup"
        [[ -d "$backup_dir/config" ]] && echo "    ✓ Configuration backup"
        [[ -f "$backup_dir/backup-manifest.txt" ]] && echo "    ✓ Manifest"
        
        echo ""
        ((index++))
    done
    
    read -p "Select backup number (1-${#backup_dirs[@]}) or 'q' to quit: " selection
    
    if [[ "$selection" == "q" ]] || [[ "$selection" == "Q" ]]; then
        log_warn "Operation cancelled by user"
        exit 0
    fi
    
    if ! [[ "$selection" =~ ^[0-9]+$ ]] || [[ $selection -lt 1 ]] || [[ $selection -gt ${#backup_dirs[@]} ]]; then
        log_error "Invalid selection"
        return 1
    fi
    
    echo "${backup_dirs[$((selection-1))]}"
}

# Verify backup
verify_backup() {
    local backup_dir=$1
    
    log_step "Verifying backup integrity..."
    
    local verification_failed=0
    
    # Check database backup
    if [[ -f "$backup_dir/database.sql.gz" ]]; then
        if gzip -t "$backup_dir/database.sql.gz" 2>/dev/null; then
            log_success "Database backup integrity verified"
        else
            log_error "Database backup is corrupted"
            verification_failed=1
        fi
    elif [[ -f "$backup_dir/database.sql" ]]; then
        log_success "Database backup found"
    else
        log_error "Database backup missing"
        verification_failed=1
    fi
    
    # Check configuration backup
    if [[ -d "$backup_dir/config" ]]; then
        [[ -f "$backup_dir/config/.env" ]] && log_success "Environment file found"
        [[ -f "$backup_dir/config/docker-compose.yml" ]] && log_success "Compose file found"
        [[ -d "$backup_dir/config/traefik" ]] && log_success "Traefik config found"
    else
        log_warn "Configuration backup missing"
    fi
    
    # Check manifest
    if [[ -f "$backup_dir/backup-manifest.txt" ]]; then
        log_success "Backup manifest found"
    else
        log_warn "Backup manifest missing"
    fi
    
    return $verification_failed
}

# Create pre-recovery snapshot
create_pre_recovery_snapshot() {
    log_step "Creating pre-recovery snapshot..."
    
    local snapshot_dir="/tmp/aria-pre-recovery-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$snapshot_dir"
    
    # Snapshot current database if possible
    if docker ps --format '{{.Names}}' | grep -q "^aria-database$"; then
        log_info "Snapshotting current database..."
        local db_name=${POSTGRES_DB:-aria}
        local db_user=${POSTGRES_USER:-aria}
        
        if docker exec aria-database pg_dump -U "$db_user" "$db_name" > "$snapshot_dir/database-snapshot.sql" 2>/dev/null; then
            gzip "$snapshot_dir/database-snapshot.sql"
            log_success "Database snapshot created"
        else
            log_warn "Could not create database snapshot"
        fi
    fi
    
    # Snapshot current configuration
    local aria_home="/opt/aria-erp"
    [[ -f "$aria_home/.env" ]] && cp "$aria_home/.env" "$snapshot_dir/"
    [[ -f "$aria_home/docker-compose.yml" ]] && cp "$aria_home/docker-compose.yml" "$snapshot_dir/"
    [[ -d "$aria_home/config/traefik" ]] && cp -r "$aria_home/config/traefik" "$snapshot_dir/"
    
    PRE_RECOVERY_BACKUP="$snapshot_dir"
    log_success "Pre-recovery snapshot saved to: $snapshot_dir"
}

# Stop services
stop_services() {
    log_step "Stopping Aria ERP services..."
    
    cd /opt/aria-erp
    
    if docker-compose ps -q 2>/dev/null | grep -q .; then
        if docker-compose down; then
            log_success "Services stopped"
            RECOVERY_STATE="services_stopped"
            return 0
        else
            log_error "Failed to stop services"
            return 1
        fi
    else
        log_info "Services are already stopped"
        RECOVERY_STATE="services_stopped"
        return 0
    fi
}

# Start services
start_services() {
    log_step "Starting Aria ERP services..."
    
    cd /opt/aria-erp
    
    if docker-compose up -d; then
        log_success "Services started"
        RECOVERY_STATE="services_started"
        
        # Wait for services to initialize
        log_info "Waiting for services to initialize..."
        sleep 10
        
        return 0
    else
        log_error "Failed to start services"
        return 1
    fi
}

# Restore database
restore_database() {
    local backup_dir=$1
    
    log_step "Restoring database..."
    
    # Start database container only
    if ! docker ps --format '{{.Names}}' | grep -q "^aria-database$"; then
        log_info "Starting database container..."
        docker start aria-database 2>/dev/null || {
            cd /opt/aria-erp
            docker-compose up -d aria-database
        }
        sleep 5
    fi
    
    # Use restore-database.sh script
    export BACKUP_DIR="$backup_dir"
    
    # We'll manually perform restoration to avoid interactive prompts
    local db_name=${POSTGRES_DB:-aria}
    local db_user=${POSTGRES_USER:-aria}
    
    local db_backup=""
    if [[ -f "$backup_dir/database.sql.gz" ]]; then
        gunzip -c "$backup_dir/database.sql.gz" > /tmp/aria-recovery-db.sql
        db_backup="/tmp/aria-recovery-db.sql"
    elif [[ -f "$backup_dir/database.sql" ]]; then
        db_backup="$backup_dir/database.sql"
    else
        log_error "Database backup not found"
        return 1
    fi
    
    # Restore database
    docker exec aria-database psql -U "$db_user" -d postgres -c "DROP DATABASE IF EXISTS $db_name;" &>/dev/null
    docker exec aria-database psql -U "$db_user" -d postgres -c "CREATE DATABASE $db_name;" &>/dev/null
    
    if docker exec -i aria-database psql -U "$db_user" -d "$db_name" < "$db_backup" &>/dev/null; then
        log_success "Database restored"
        RECOVERY_STATE="database_restored"
        [[ -f "/tmp/aria-recovery-db.sql" ]] && rm -f /tmp/aria-recovery-db.sql
        return 0
    else
        log_error "Database restoration failed"
        [[ -f "/tmp/aria-recovery-db.sql" ]] && rm -f /tmp/aria-recovery-db.sql
        return 1
    fi
}

# Restore configuration
restore_configuration() {
    local backup_dir=$1
    
    log_step "Restoring configuration..."
    
    local config_dir="$backup_dir/config"
    
    if [[ ! -d "$config_dir" ]]; then
        log_warn "Configuration backup not found, skipping"
        return 0
    fi
    
    local aria_home="/opt/aria-erp"
    
    [[ -f "$config_dir/.env" ]] && cp "$config_dir/.env" "$aria_home/.env"
    [[ -f "$config_dir/docker-compose.yml" ]] && cp "$config_dir/docker-compose.yml" "$aria_home/docker-compose.yml"
    [[ -d "$config_dir/traefik" ]] && cp -r "$config_dir/traefik"/* "$aria_home/config/traefik/"
    
    log_success "Configuration restored"
    RECOVERY_STATE="config_restored"
}

# Verify system health
verify_system_health() {
    log_step "Verifying system health..."
    
    local health_script="$SCRIPT_DIR/../monitoring/health-check.sh"
    
    if [[ -f "$health_script" ]]; then
        if bash "$health_script" &>/dev/null; then
            log_success "System health check passed"
            return 0
        else
            local status=$?
            if [[ $status -eq 1 ]]; then
                log_warn "System health check shows degraded state"
                return 1
            else
                log_error "System health check failed"
                return 1
            fi
        fi
    else
        log_warn "Health check script not available, skipping verification"
        return 0
    fi
}

# Rollback recovery
rollback_recovery() {
    log_warn "Initiating recovery rollback..."
    
    case $RECOVERY_STATE in
        "services_started"|"config_restored"|"database_restored")
            log_info "Stopping services..."
            docker-compose down &>/dev/null || true
            ;;&
        
        "database_restored"|"config_restored")
            if [[ -n "$PRE_RECOVERY_BACKUP" ]] && [[ -d "$PRE_RECOVERY_BACKUP" ]]; then
                log_info "Restoring pre-recovery snapshot..."
                
                # Restore configuration
                [[ -f "$PRE_RECOVERY_BACKUP/.env" ]] && cp "$PRE_RECOVERY_BACKUP/.env" "/opt/aria-erp/.env"
                [[ -f "$PRE_RECOVERY_BACKUP/docker-compose.yml" ]] && cp "$PRE_RECOVERY_BACKUP/docker-compose.yml" "/opt/aria-erp/docker-compose.yml"
                [[ -d "$PRE_RECOVERY_BACKUP/traefik" ]] && cp -r "$PRE_RECOVERY_BACKUP/traefik"/* "/opt/aria-erp/config/traefik/"
                
                # Restore database if snapshot exists
                if [[ -f "$PRE_RECOVERY_BACKUP/database-snapshot.sql.gz" ]]; then
                    docker start aria-database &>/dev/null || docker-compose up -d aria-database &>/dev/null
                    sleep 5
                    
                    local db_name=${POSTGRES_DB:-aria}
                    local db_user=${POSTGRES_USER:-aria}
                    
                    gunzip -c "$PRE_RECOVERY_BACKUP/database-snapshot.sql.gz" > /tmp/aria-rollback.sql
                    docker exec aria-database psql -U "$db_user" -d postgres -c "DROP DATABASE IF EXISTS $db_name;" &>/dev/null
                    docker exec aria-database psql -U "$db_user" -d postgres -c "CREATE DATABASE $db_name;" &>/dev/null
                    docker exec -i aria-database psql -U "$db_user" -d "$db_name" < /tmp/aria-rollback.sql &>/dev/null
                    rm -f /tmp/aria-rollback.sql
                    
                    log_info "Database rolled back"
                fi
                
                # Restart services
                cd /opt/aria-erp
                docker-compose up -d &>/dev/null
                
                log_success "Rollback completed"
            else
                log_error "Pre-recovery snapshot not found, cannot rollback completely"
            fi
            ;;
        
        "services_stopped")
            log_info "Services were stopped, attempting to restart..."
            cd /opt/aria-erp
            docker-compose up -d &>/dev/null && log_success "Services restarted"
            ;;
    esac
}

# Main recovery process
main() {
    show_banner
    check_root
    
    # Prerequisites
    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        exit 1
    fi
    
    # Select backup
    local backup_dir
    if ! backup_dir=$(select_backup); then
        exit 1
    fi
    
    log_info "Selected backup: $backup_dir"
    
    # Verify backup
    if ! verify_backup "$backup_dir"; then
        log_error "Backup verification failed"
        exit 1
    fi
    
    # Final confirmation
    echo ""
    log_warn "WARNING: This will restore your entire Aria ERP system!"
    log_warn "Current data will be replaced with backup from:"
    log_warn "  $backup_dir"
    echo ""
    confirm_action "Are you absolutely sure you want to proceed?"
    
    # Create pre-recovery snapshot
    create_pre_recovery_snapshot
    
    # Execute recovery steps
    local recovery_failed=0
    
    if ! stop_services; then
        log_error "Failed to stop services"
        recovery_failed=1
    fi
    
    if [[ $recovery_failed -eq 0 ]] && ! restore_database "$backup_dir"; then
        log_error "Database restoration failed"
        recovery_failed=1
    fi
    
    if [[ $recovery_failed -eq 0 ]] && ! restore_configuration "$backup_dir"; then
        log_error "Configuration restoration failed"
        recovery_failed=1
    fi
    
    if [[ $recovery_failed -eq 0 ]] && ! start_services; then
        log_error "Failed to start services"
        recovery_failed=1
    fi
    
    if [[ $recovery_failed -eq 0 ]] && ! verify_system_health; then
        log_warn "System health verification failed"
        recovery_failed=1
    fi
    
    # Handle recovery result
    if [[ $recovery_failed -eq 1 ]]; then
        echo ""
        log_error "Recovery process encountered errors"
        confirm_action "Do you want to rollback to pre-recovery state?"
        rollback_recovery
        exit 1
    else
        echo ""
        echo "========================================"
        log_success "Full system recovery completed successfully!"
        log_info "Pre-recovery snapshot: $PRE_RECOVERY_BACKUP"
        log_info "This snapshot will be kept for 7 days"
        echo "========================================"
    fi
}

# Run main function
main "$@"

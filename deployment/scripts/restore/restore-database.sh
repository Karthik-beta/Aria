#!/bin/bash
# Aria ERP - Database Restoration Script (Linux)
# Restores PostgreSQL database from backup with safety checks and rollback

set -euo pipefail

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
COMPOSE_FILE=${COMPOSE_FILE:-"/opt/aria-erp/docker-compose.yml"}
ENV_FILE=${ENV_FILE:-"/opt/aria-erp/.env"}
DB_CONTAINER="aria-database"

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

# List available backups
list_backups() {
    local backup_base=$1
    
    log_info "Searching for backups in: $backup_base"
    echo ""
    
    local backups=($(find "$backup_base" -maxdepth 1 -type d -name "aria-erp-backup-*" | sort -r))
    
    if [[ ${#backups[@]} -eq 0 ]]; then
        log_error "No backups found in $backup_base"
        return 1
    fi
    
    echo "Available backups:"
    echo "=================="
    
    local index=1
    for backup in "${backups[@]}"; do
        local backup_name=$(basename "$backup")
        local timestamp=$(echo "$backup_name" | sed 's/aria-erp-backup-//')
        local size=$(du -sh "$backup" | cut -f1)
        local date_formatted=$(date -d "${timestamp:0:8}" '+%Y-%m-%d' 2>/dev/null || echo "${timestamp:0:8}")
        local time_formatted="${timestamp:9:2}:${timestamp:11:2}:${timestamp:13:2}"
        
        echo "[$index] $date_formatted $time_formatted - Size: $size"
        echo "    Path: $backup"
        
        # Check for database backup file
        if [[ -f "$backup/database.sql" ]] || [[ -f "$backup/database.sql.gz" ]]; then
            echo "    Database: ✓ Found"
        else
            echo "    Database: ✗ Missing"
        fi
        
        # Check for manifest
        if [[ -f "$backup/backup-manifest.txt" ]]; then
            echo "    Manifest: ✓ Found"
        fi
        
        echo ""
        ((index++))
    done
    
    # Return array via global variable
    BACKUP_LIST=("${backups[@]}")
    return 0
}

# Select backup
select_backup() {
    local backup_base=$1
    
    if ! list_backups "$backup_base"; then
        return 1
    fi
    
    echo ""
    read -p "Select backup number (1-${#BACKUP_LIST[@]}) or 'q' to quit: " selection
    
    if [[ "$selection" == "q" ]] || [[ "$selection" == "Q" ]]; then
        log_warn "Operation cancelled by user"
        exit 0
    fi
    
    if ! [[ "$selection" =~ ^[0-9]+$ ]] || [[ $selection -lt 1 ]] || [[ $selection -gt ${#BACKUP_LIST[@]} ]]; then
        log_error "Invalid selection"
        return 1
    fi
    
    local selected_backup="${BACKUP_LIST[$((selection-1))]}"
    echo "$selected_backup"
}

# Verify backup integrity
verify_backup() {
    local backup_dir=$1
    
    log_info "Verifying backup integrity..."
    
    # Check if backup directory exists
    if [[ ! -d "$backup_dir" ]]; then
        log_error "Backup directory not found: $backup_dir"
        return 1
    fi
    
    # Check for database backup
    local db_backup=""
    if [[ -f "$backup_dir/database.sql.gz" ]]; then
        db_backup="$backup_dir/database.sql.gz"
        
        # Test gzip integrity
        if ! gzip -t "$db_backup" 2>/dev/null; then
            log_error "Database backup is corrupted (gzip test failed)"
            return 1
        fi
    elif [[ -f "$backup_dir/database.sql" ]]; then
        db_backup="$backup_dir/database.sql"
    else
        log_error "Database backup file not found"
        return 1
    fi
    
    log_success "Database backup found: $db_backup"
    
    # Check file size
    local size=$(stat -f%z "$db_backup" 2>/dev/null || stat -c%s "$db_backup" 2>/dev/null)
    if [[ $size -lt 100 ]]; then
        log_error "Database backup appears to be empty or corrupted (size: $size bytes)"
        return 1
    fi
    
    log_info "Backup size: $(numfmt --to=iec-i --suffix=B $size 2>/dev/null || echo "$size bytes")"
    
    # Check manifest
    if [[ -f "$backup_dir/backup-manifest.txt" ]]; then
        log_success "Backup manifest found"
    else
        log_warn "Backup manifest missing (backup may be incomplete)"
    fi
    
    log_success "Backup integrity verified"
    return 0
}

# Create pre-restore backup
create_pre_restore_backup() {
    local backup_dir="/tmp/aria-pre-restore-$(date +%Y%m%d_%H%M%S)"
    
    log_info "Creating pre-restore backup to: $backup_dir"
    mkdir -p "$backup_dir"
    
    # Get database credentials
    local db_name=${POSTGRES_DB:-aria}
    local db_user=${POSTGRES_USER:-aria}
    
    # Check if database container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
        log_warn "Database container not running, skipping pre-restore backup"
        echo "$backup_dir"
        return 0
    fi
    
    # Backup current database
    if docker exec "$DB_CONTAINER" pg_dump -U "$db_user" "$db_name" > "$backup_dir/database-pre-restore.sql" 2>/dev/null; then
        gzip "$backup_dir/database-pre-restore.sql"
        log_success "Pre-restore backup created"
    else
        log_warn "Failed to create pre-restore backup (database may be empty)"
    fi
    
    echo "$backup_dir"
}

# Stop database connections
stop_database_connections() {
    local db_name=${POSTGRES_DB:-aria}
    local db_user=${POSTGRES_USER:-aria}
    
    log_info "Terminating active database connections..."
    
    docker exec "$DB_CONTAINER" psql -U "$db_user" -d postgres -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$db_name' AND pid <> pg_backend_pid();" \
        &>/dev/null || true
    
    log_success "Database connections terminated"
}

# Restore database
restore_database() {
    local backup_dir=$1
    local db_name=${POSTGRES_DB:-aria}
    local db_user=${POSTGRES_USER:-aria}
    
    log_info "Starting database restoration..."
    
    # Find database backup file
    local db_backup=""
    if [[ -f "$backup_dir/database.sql.gz" ]]; then
        db_backup="$backup_dir/database.sql.gz"
        log_info "Decompressing backup..."
        gunzip -c "$db_backup" > /tmp/aria-restore-temp.sql
        db_backup="/tmp/aria-restore-temp.sql"
    elif [[ -f "$backup_dir/database.sql" ]]; then
        db_backup="$backup_dir/database.sql"
    else
        log_error "Database backup file not found"
        return 1
    fi
    
    # Stop connections
    stop_database_connections
    
    # Drop and recreate database
    log_info "Dropping existing database..."
    docker exec "$DB_CONTAINER" psql -U "$db_user" -d postgres -c "DROP DATABASE IF EXISTS $db_name;" || {
        log_error "Failed to drop database"
        return 1
    }
    
    log_info "Creating fresh database..."
    docker exec "$DB_CONTAINER" psql -U "$db_user" -d postgres -c "CREATE DATABASE $db_name;" || {
        log_error "Failed to create database"
        return 1
    }
    
    # Restore from backup
    log_info "Restoring database from backup..."
    if docker exec -i "$DB_CONTAINER" psql -U "$db_user" -d "$db_name" < "$db_backup"; then
        log_success "Database restored successfully"
        
        # Cleanup temp file
        [[ -f "/tmp/aria-restore-temp.sql" ]] && rm -f /tmp/aria-restore-temp.sql
        
        return 0
    else
        log_error "Database restoration failed"
        [[ -f "/tmp/aria-restore-temp.sql" ]] && rm -f /tmp/aria-restore-temp.sql
        return 1
    fi
}

# Verify restoration
verify_restoration() {
    local db_name=${POSTGRES_DB:-aria}
    local db_user=${POSTGRES_USER:-aria}
    
    log_info "Verifying database restoration..."
    
    # Check database exists and is accessible
    if docker exec "$DB_CONTAINER" psql -U "$db_user" -d "$db_name" -c "SELECT 1;" &>/dev/null; then
        log_success "Database is accessible"
    else
        log_error "Database is not accessible"
        return 1
    fi
    
    # Get table count
    local table_count=$(docker exec "$DB_CONTAINER" psql -U "$db_user" -d "$db_name" -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | xargs)
    
    log_info "Tables in database: $table_count"
    
    if [[ $table_count -gt 0 ]]; then
        log_success "Database restoration verified"
        return 0
    else
        log_warn "Database appears to be empty"
        return 1
    fi
}

# Rollback restoration
rollback_restoration() {
    local pre_restore_backup=$1
    
    log_warn "Rolling back to pre-restore state..."
    
    if [[ -f "$pre_restore_backup/database-pre-restore.sql.gz" ]]; then
        log_info "Restoring from pre-restore backup..."
        
        local db_name=${POSTGRES_DB:-aria}
        local db_user=${POSTGRES_USER:-aria}
        
        # Decompress and restore
        gunzip -c "$pre_restore_backup/database-pre-restore.sql.gz" > /tmp/aria-rollback-temp.sql
        
        stop_database_connections
        
        docker exec "$DB_CONTAINER" psql -U "$db_user" -d postgres -c "DROP DATABASE IF EXISTS $db_name;" &>/dev/null
        docker exec "$DB_CONTAINER" psql -U "$db_user" -d postgres -c "CREATE DATABASE $db_name;" &>/dev/null
        docker exec -i "$DB_CONTAINER" psql -U "$db_user" -d "$db_name" < /tmp/aria-rollback-temp.sql &>/dev/null
        
        rm -f /tmp/aria-rollback-temp.sql
        
        log_success "Rollback completed"
    else
        log_error "Pre-restore backup not found, cannot rollback"
    fi
}

# Main function
main() {
    echo "========================================"
    echo "   Aria ERP Database Restoration"
    echo "========================================"
    echo ""
    
    check_root
    
    # Check if database container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
        log_error "Database container is not running"
        log_info "Start the container with: docker start $DB_CONTAINER"
        exit 1
    fi
    
    # Detect backup location
    local backup_base=""
    if [[ -d "/opt/aria-erp/backups" ]]; then
        backup_base="/opt/aria-erp/backups"
    elif [[ -n "$(find /media -maxdepth 2 -type d -name 'aria-erp-backup-*' 2>/dev/null | head -1)" ]]; then
        backup_base=$(dirname "$(find /media -maxdepth 2 -type d -name 'aria-erp-backup-*' 2>/dev/null | head -1)")
    elif [[ -n "$(find /mnt -maxdepth 2 -type d -name 'aria-erp-backup-*' 2>/dev/null | head -1)" ]]; then
        backup_base=$(dirname "$(find /mnt -maxdepth 2 -type d -name 'aria-erp-backup-*' 2>/dev/null | head -1)")
    else
        log_error "Cannot find backup directory"
        exit 1
    fi
    
    # Select backup
    local selected_backup
    if ! selected_backup=$(select_backup "$backup_base"); then
        exit 1
    fi
    
    log_info "Selected backup: $selected_backup"
    
    # Verify backup
    if ! verify_backup "$selected_backup"; then
        log_error "Backup verification failed"
        exit 1
    fi
    
    # Confirm restoration
    echo ""
    log_warn "WARNING: This will replace your current database!"
    log_warn "All current data will be lost unless you have a backup."
    echo ""
    confirm_action "Are you sure you want to proceed with database restoration?"
    
    # Create pre-restore backup
    local pre_restore_backup
    pre_restore_backup=$(create_pre_restore_backup)
    
    # Perform restoration
    if restore_database "$selected_backup"; then
        if verify_restoration; then
            log_success "Database restoration completed successfully!"
            
            # Cleanup pre-restore backup after 24 hours (optional)
            log_info "Pre-restore backup saved at: $pre_restore_backup"
            log_info "This backup will be kept for manual cleanup"
        else
            log_error "Database restoration verification failed"
            confirm_action "Do you want to rollback to previous state?"
            rollback_restoration "$pre_restore_backup"
            exit 1
        fi
    else
        log_error "Database restoration failed"
        confirm_action "Do you want to rollback to previous state?"
        rollback_restoration "$pre_restore_backup"
        exit 1
    fi
    
    echo ""
    echo "========================================"
    log_success "Restoration process completed"
    echo "========================================"
}

# Run main function
main "$@"

#!/bin/bash
# Aria ERP Log Rotation Script for Linux
# This script rotates application logs and cleans up old log files
# Run this script via cron for automatic log management

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOYMENT_DIR="$(dirname "$SCRIPT_DIR")"
LOGS_DIR="${DEPLOYMENT_DIR}/logs"
LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-30}"
LOG_COMPRESS_ENABLED="${LOG_COMPRESS_ENABLED:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to rotate Traefik access logs
rotate_traefik_logs() {
    local traefik_log_dir="${LOGS_DIR}/traefik"
    
    if [ ! -d "$traefik_log_dir" ]; then
        log_warn "Traefik log directory not found: $traefik_log_dir"
        return
    fi
    
    log_info "Rotating Traefik logs..."
    
    # Find and rotate access.log if it exists and is larger than 100MB
    if [ -f "${traefik_log_dir}/access.log" ]; then
        local file_size=$(stat -f%z "${traefik_log_dir}/access.log" 2>/dev/null || stat -c%s "${traefik_log_dir}/access.log" 2>/dev/null || echo 0)
        local max_size=$((100 * 1024 * 1024)) # 100MB
        
        if [ "$file_size" -gt "$max_size" ]; then
            local timestamp=$(date +%Y%m%d-%H%M%S)
            log_info "Traefik access.log is larger than 100MB, rotating..."
            
            mv "${traefik_log_dir}/access.log" "${traefik_log_dir}/access-${timestamp}.log"
            
            # Signal Traefik to reopen log file
            docker kill -s USR1 aria-proxy 2>/dev/null || log_warn "Could not signal Traefik container"
            
            # Compress rotated log if enabled
            if [ "$LOG_COMPRESS_ENABLED" = "true" ]; then
                gzip "${traefik_log_dir}/access-${timestamp}.log" &
            fi
        fi
    fi
}

# Function to rotate PostgreSQL logs
rotate_postgres_logs() {
    local postgres_log_dir="${LOGS_DIR}/postgres"
    
    if [ ! -d "$postgres_log_dir" ]; then
        log_warn "PostgreSQL log directory not found: $postgres_log_dir"
        return
    fi
    
    log_info "Checking PostgreSQL logs..."
    # PostgreSQL handles its own rotation via log_rotation_age and log_rotation_size
    # We just need to clean up old files
}

# Function to rotate backend application logs
rotate_backend_logs() {
    local backend_log_dir="${LOGS_DIR}/backend"
    
    if [ ! -d "$backend_log_dir" ]; then
        log_warn "Backend log directory not found: $backend_log_dir"
        return
    fi
    
    log_info "Rotating backend logs..."
    
    # Rotate any .log files larger than 50MB
    find "$backend_log_dir" -name "*.log" -type f | while read -r logfile; do
        local file_size=$(stat -f%z "$logfile" 2>/dev/null || stat -c%s "$logfile" 2>/dev/null || echo 0)
        local max_size=$((50 * 1024 * 1024)) # 50MB
        
        if [ "$file_size" -gt "$max_size" ]; then
            local timestamp=$(date +%Y%m%d-%H%M%S)
            local filename=$(basename "$logfile" .log)
            local dirname=$(dirname "$logfile")
            
            log_info "Rotating $logfile..."
            mv "$logfile" "${dirname}/${filename}-${timestamp}.log"
            
            # Compress rotated log if enabled
            if [ "$LOG_COMPRESS_ENABLED" = "true" ]; then
                gzip "${dirname}/${filename}-${timestamp}.log" &
            fi
        fi
    done
}

# Function to clean up old logs based on retention policy
cleanup_old_logs() {
    log_info "Cleaning up logs older than ${LOG_RETENTION_DAYS} days..."
    
    if [ ! -d "$LOGS_DIR" ]; then
        log_warn "Logs directory not found: $LOGS_DIR"
        return
    fi
    
    # Find and delete old log files
    local deleted_count=0
    
    # Delete old .log files
    while IFS= read -r -d '' file; do
        log_info "Deleting old log: $(basename "$file")"
        rm -f "$file"
        ((deleted_count++))
    done < <(find "$LOGS_DIR" -name "*.log" -type f -mtime +${LOG_RETENTION_DAYS} -print0 2>/dev/null)
    
    # Delete old .log.gz files
    while IFS= read -r -d '' file; do
        log_info "Deleting old compressed log: $(basename "$file")"
        rm -f "$file"
        ((deleted_count++))
    done < <(find "$LOGS_DIR" -name "*.log.gz" -type f -mtime +${LOG_RETENTION_DAYS} -print0 2>/dev/null)
    
    if [ $deleted_count -eq 0 ]; then
        log_info "No old logs to delete"
    else
        log_info "Deleted $deleted_count old log file(s)"
    fi
}

# Function to display disk usage
show_disk_usage() {
    log_info "Current disk usage for logs directory:"
    du -sh "$LOGS_DIR" 2>/dev/null || log_warn "Could not calculate disk usage"
}

# Main execution
main() {
    log_info "=== Aria ERP Log Rotation ==="
    log_info "Retention policy: ${LOG_RETENTION_DAYS} days"
    log_info "Compression enabled: ${LOG_COMPRESS_ENABLED}"
    echo ""
    
    # Check if logs directory exists
    if [ ! -d "$LOGS_DIR" ]; then
        log_error "Logs directory not found: $LOGS_DIR"
        exit 1
    fi
    
    # Show disk usage before rotation
    show_disk_usage
    echo ""
    
    # Rotate logs for each service
    rotate_traefik_logs
    rotate_postgres_logs
    rotate_backend_logs
    
    # Clean up old logs
    cleanup_old_logs
    
    # Show disk usage after rotation
    echo ""
    show_disk_usage
    
    log_info "Log rotation completed successfully"
}

# Run main function
main "$@"

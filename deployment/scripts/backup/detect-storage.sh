#!/bin/bash
# Aria ERP - Storage Detection Script (Linux)
# Detects available backup storage locations in priority order:
# 1. External USB/storage devices
# 2. Network storage (mounted)
# 3. Local storage (fallback)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Minimum free space required (in GB)
MIN_FREE_SPACE_GB=5

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if a path has enough free space
check_free_space() {
    local path=$1
    local available_gb
    
    if [[ -d "$path" && -w "$path" ]]; then
        available_gb=$(df -BG "$path" | awk 'NR==2 {print $4}' | sed 's/G//')
        if [[ $available_gb -ge $MIN_FREE_SPACE_GB ]]; then
            return 0
        fi
    fi
    return 1
}

# Detect external USB/storage devices
detect_external_storage() {
    log_info "Checking for external storage devices..."
    
    # Check common mount points
    for mount_point in /media/* /mnt/usb* /run/media/*; do
        if [[ -d "$mount_point" ]]; then
            if check_free_space "$mount_point"; then
                echo "external:$mount_point"
                return 0
            fi
        fi
    done
    
    # Check removable devices
    for device in /sys/block/sd*/removable; do
        if [[ -f "$device" ]] && [[ $(cat "$device") -eq 1 ]]; then
            device_name=$(echo "$device" | cut -d'/' -f4)
            # Find mount point
            mount_point=$(lsblk -no MOUNTPOINT "/dev/${device_name}" 2>/dev/null | grep -v '^$' | head -1)
            if [[ -n "$mount_point" ]] && check_free_space "$mount_point"; then
                echo "external:$mount_point"
                return 0
            fi
        fi
    done
    
    return 1
}

# Detect network storage
detect_network_storage() {
    log_info "Checking for network storage..."
    
    # Check for mounted network shares (NFS, CIFS, SMB)
    while IFS= read -r line; do
        mount_point=$(echo "$line" | awk '{print $3}')
        fs_type=$(echo "$line" | awk '{print $5}')
        
        if [[ "$fs_type" =~ ^(nfs|cifs|smb) ]]; then
            if check_free_space "$mount_point"; then
                echo "network:$mount_point"
                return 0
            fi
        fi
    done < <(mount | grep -E 'type (nfs|cifs|smb)')
    
    # Check common network mount points
    for mount_point in /mnt/network* /mnt/nas* /mnt/backup*; do
        if [[ -d "$mount_point" ]] && check_free_space "$mount_point"; then
            echo "network:$mount_point"
            return 0
        fi
    done
    
    return 1
}

# Detect local storage (fallback)
detect_local_storage() {
    log_info "Using local storage as fallback..."
    
    local backup_dir="/opt/aria-erp/backups"
    
    # Create directory if it doesn't exist
    mkdir -p "$backup_dir" 2>/dev/null || {
        log_error "Cannot create backup directory: $backup_dir"
        return 1
    }
    
    if check_free_space "$backup_dir"; then
        echo "local:$backup_dir"
        return 0
    else
        log_error "Insufficient free space in local storage"
        return 1
    fi
}

# Main detection logic
main() {
    echo "=== Aria ERP Storage Detection ==="
    echo ""
    
    # Try external storage first
    if result=$(detect_external_storage); then
        log_info "✓ External storage detected: ${result#*:}"
        echo "$result"
        exit 0
    fi
    
    # Try network storage
    if result=$(detect_network_storage); then
        log_info "✓ Network storage detected: ${result#*:}"
        echo "$result"
        exit 0
    fi
    
    # Fallback to local storage
    if result=$(detect_local_storage); then
        log_warn "Using local storage: ${result#*:}"
        echo "$result"
        exit 0
    fi
    
    # No suitable storage found
    log_error "No suitable backup storage found"
    log_error "Please ensure at least ${MIN_FREE_SPACE_GB}GB of free space is available"
    exit 1
}

# Run main function
main "$@"

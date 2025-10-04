#!/bin/bash
# Aria ERP - Health Check Script (Linux)
# Monitors Docker container health, service availability, and system resources

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HEALTH_CHECK_TIMEOUT=10
API_HEALTH_ENDPOINT=${API_HEALTH_ENDPOINT:-"http://localhost/api/health"}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Health status
OVERALL_STATUS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
    OVERALL_STATUS=1
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    OVERALL_STATUS=2
}

# Check if Docker is running
check_docker() {
    echo ""
    echo "=== Docker Status ==="
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        return 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        return 1
    fi
    
    log_success "Docker daemon is running"
    
    # Get Docker version
    local docker_version=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
    log_info "Docker version: $docker_version"
    
    return 0
}

# Check container health
check_container_health() {
    local container_name=$1
    local display_name=${2:-$container_name}
    
    # Check if container exists
    if ! docker ps -a --format '{{.Names}}' | grep -q "^${container_name}$"; then
        log_warn "$display_name: Container not found"
        return 1
    fi
    
    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        log_error "$display_name: Container is not running"
        return 1
    fi
    
    # Get container health status
    local health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "none")
    
    if [[ "$health_status" == "healthy" ]]; then
        log_success "$display_name: Healthy"
        return 0
    elif [[ "$health_status" == "unhealthy" ]]; then
        log_error "$display_name: Unhealthy"
        return 1
    elif [[ "$health_status" == "starting" ]]; then
        log_warn "$display_name: Starting"
        return 1
    else
        # No health check configured, check if running
        local state=$(docker inspect --format='{{.State.Status}}' "$container_name" 2>/dev/null || echo "unknown")
        if [[ "$state" == "running" ]]; then
            log_success "$display_name: Running (no health check configured)"
            return 0
        else
            log_error "$display_name: Not running (status: $state)"
            return 1
        fi
    fi
}

# Check all Aria containers
check_aria_containers() {
    echo ""
    echo "=== Aria ERP Containers ==="
    
    local containers=(
        "aria-proxy:Traefik Proxy"
        "aria-database:PostgreSQL Database"
        "aria-backend:Backend API"
        "aria-asset:Asset Management"
        "aria-crm:CRM Frontend"
        "aria-hrms:HRMS Frontend"
        "aria-inventory:Inventory Frontend"
    )
    
    local all_healthy=0
    
    for container_info in "${containers[@]}"; do
        IFS=':' read -r container_name display_name <<< "$container_info"
        if ! check_container_health "$container_name" "$display_name"; then
            all_healthy=1
        fi
    done
    
    return $all_healthy
}

# Check database connectivity
check_database() {
    echo ""
    echo "=== Database Connectivity ==="
    
    local db_container="aria-database"
    local db_user=${POSTGRES_USER:-aria}
    local db_name=${POSTGRES_DB:-aria}
    
    if ! docker ps --format '{{.Names}}' | grep -q "^${db_container}$"; then
        log_error "Database container is not running"
        return 1
    fi
    
    # Test database connection
    if docker exec "$db_container" psql -U "$db_user" -d "$db_name" -c "SELECT 1" &> /dev/null; then
        log_success "Database connection successful"
        
        # Get database size
        local db_size=$(docker exec "$db_container" psql -U "$db_user" -d "$db_name" -t -c "SELECT pg_size_pretty(pg_database_size('$db_name'));" 2>/dev/null | xargs)
        log_info "Database size: $db_size"
        
        # Get connection count
        local connections=$(docker exec "$db_container" psql -U "$db_user" -d "$db_name" -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null | xargs)
        log_info "Active connections: $connections"
        
        return 0
    else
        log_error "Database connection failed"
        return 1
    fi
}

# Check API health endpoint
check_api_health() {
    echo ""
    echo "=== API Health Endpoint ==="
    
    if command -v curl &> /dev/null; then
        local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $HEALTH_CHECK_TIMEOUT "$API_HEALTH_ENDPOINT" 2>/dev/null || echo "000")
        
        if [[ "$response" == "200" ]]; then
            log_success "API health endpoint responding (HTTP 200)"
            return 0
        elif [[ "$response" == "000" ]]; then
            log_error "API health endpoint unreachable (connection failed)"
            return 1
        else
            log_warn "API health endpoint returned HTTP $response"
            return 1
        fi
    else
        log_warn "curl not installed, skipping API health check"
        return 0
    fi
}

# Check disk space
check_disk_space() {
    echo ""
    echo "=== Disk Space ==="
    
    local threshold=90
    
    # Check Docker data directory
    local docker_dir=$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || echo "/var/lib/docker")
    local usage=$(df -h "$docker_dir" | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [[ $usage -ge $threshold ]]; then
        log_error "Docker disk usage critical: ${usage}% (threshold: ${threshold}%)"
    elif [[ $usage -ge 80 ]]; then
        log_warn "Docker disk usage high: ${usage}% (threshold: ${threshold}%)"
    else
        log_success "Docker disk usage: ${usage}%"
    fi
    
    # Check backup directory if it exists
    for backup_dir in /opt/aria-erp/backups /media/*/AriaBackups /mnt/*/AriaBackups; do
        if [[ -d "$backup_dir" ]]; then
            local backup_usage=$(df -h "$backup_dir" | awk 'NR==2 {print $5}' | sed 's/%//')
            if [[ $backup_usage -ge $threshold ]]; then
                log_warn "Backup disk usage high: ${backup_usage}% at $backup_dir"
            else
                log_info "Backup disk usage: ${backup_usage}% at $backup_dir"
            fi
        fi
    done
}

# Check memory usage
check_memory() {
    echo ""
    echo "=== Memory Usage ==="
    
    # System memory
    local total_mem=$(free -h | awk 'NR==2 {print $2}')
    local used_mem=$(free -h | awk 'NR==2 {print $3}')
    local available_mem=$(free -h | awk 'NR==2 {print $7}')
    
    log_info "System memory: $used_mem used / $total_mem total ($available_mem available)"
    
    # Docker container memory
    echo ""
    docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}" | grep aria- || log_info "No Aria containers running"
}

# Check container logs for errors
check_container_logs() {
    echo ""
    echo "=== Recent Container Errors ==="
    
    local containers=(aria-proxy aria-database aria-backend aria-asset aria-crm aria-hrms aria-inventory)
    local found_errors=0
    
    for container in "${containers[@]}"; do
        if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
            local error_count=$(docker logs --since 1h "$container" 2>&1 | grep -iE "error|exception|fatal" | wc -l)
            
            if [[ $error_count -gt 0 ]]; then
                log_warn "$container: $error_count error(s) in last hour"
                found_errors=1
            fi
        fi
    done
    
    if [[ $found_errors -eq 0 ]]; then
        log_success "No recent errors in container logs"
    fi
}

# Generate health summary
generate_summary() {
    echo ""
    echo "========================================"
    echo "         Health Check Summary"
    echo "========================================"
    echo ""
    
    case $OVERALL_STATUS in
        0)
            echo -e "${GREEN}✓ All systems operational${NC}"
            echo "Status: HEALTHY"
            ;;
        1)
            echo -e "${YELLOW}! Some systems need attention${NC}"
            echo "Status: DEGRADED"
            ;;
        2)
            echo -e "${RED}✗ Critical issues detected${NC}"
            echo "Status: UNHEALTHY"
            ;;
    esac
    
    echo ""
    echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
}

# Main function
main() {
    echo "========================================"
    echo "    Aria ERP Health Check"
    echo "========================================"
    
    check_docker
    check_aria_containers
    check_database
    check_api_health
    check_disk_space
    check_memory
    check_container_logs
    generate_summary
    
    exit $OVERALL_STATUS
}

# Run main function
main "$@"

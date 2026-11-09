#!/bin/bash
# Deployment Health Check Script
# Tests all critical services and endpoints

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
MAX_RETRIES=30
RETRY_DELAY=10
TIMEOUT=10

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Logging
log_pass() {
    echo -e "${GREEN}✓${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

log_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Test Docker containers are running
test_containers() {
    echo "Testing Docker containers..."
    
    local containers=("aria-caddy" "aria-frontend" "aria-backend" "aria-postgres" "aria-redis")
    
    for container in "${containers[@]}"; do
        if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
            log_pass "Container $container is running"
        else
            log_fail "Container $container is not running"
        fi
    done
}

# Test container health
test_container_health() {
    echo
    echo "Testing container health..."
    
    local containers=("aria-frontend" "aria-backend" "aria-postgres" "aria-redis")
    
    for container in "${containers[@]}"; do
        local health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "no-health-check")
        
        if [ "$health_status" = "healthy" ]; then
            log_pass "Container $container is healthy"
        elif [ "$health_status" = "no-health-check" ]; then
            log_info "Container $container has no health check configured"
        else
            log_fail "Container $container health status: $health_status"
        fi
    done
}

# Test HTTP endpoints
test_http_endpoint() {
    local url=$1
    local name=$2
    local expected_status=${3:-200}
    
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout $TIMEOUT "$url" 2>/dev/null || echo "000")
    
    # Accept 2xx/3xx to handle valid reverse-proxy redirects (HTTP -> HTTPS)
    if [ "$response_code" -ge 200 ] && [ "$response_code" -lt 400 ]; then
        log_pass "$name endpoint returned $response_code (healthy)"
    else
        log_fail "$name endpoint returned $response_code (expected ${expected_status} or any 2xx/3xx)"
    fi
}

# Test all HTTP endpoints
test_endpoints() {
    echo
    echo "Testing HTTP endpoints..."
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 5
    
    # Test health endpoint
    test_http_endpoint "http://localhost/health/ready" "Backend readiness"
    test_http_endpoint "http://localhost/health/live" "Backend liveness"
    
    # Test frontend
    test_http_endpoint "http://localhost" "Frontend root"
    
    # Test HTTPS if available
    if curl -k -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "https://localhost" 2>/dev/null | grep -q "200\|301\|302"; then
        log_pass "HTTPS endpoint is accessible"
    else
        log_info "HTTPS endpoint not configured or not accessible"
    fi
}

# Test database connectivity
test_database() {
    echo
    echo "Testing database connectivity..."
    
    # Test PostgreSQL
    if docker exec aria-postgres pg_isready -U aria >/dev/null 2>&1; then
        log_pass "PostgreSQL is accepting connections"
    else
        log_fail "PostgreSQL is not accepting connections"
    fi
    
    # Test Redis (authenticate when REDIS_PASSWORD is configured)
    if docker exec aria-redis sh -lc 'if [ -n "$REDIS_PASSWORD" ]; then REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping; else redis-cli ping; fi' | grep -q "PONG"; then
        log_pass "Redis is responding"
    else
        log_fail "Redis is not responding"
    fi
}

# Test network connectivity
test_network() {
    echo
    echo "Testing network connectivity..."
    
    local network="aria-network"
    
    if docker network inspect "$network" >/dev/null 2>&1; then
        log_pass "Docker network $network exists"
        
        # Check connected containers
        local connected_containers=$(docker network inspect "$network" --format '{{len .Containers}}')
        log_info "Connected containers: $connected_containers"
    else
        log_fail "Docker network $network does not exist"
    fi
}

# Test volumes
test_volumes() {
    echo
    echo "Testing Docker volumes..."
    
    local volumes=("postgres-data" "redis-data" "caddy-data" "caddy-config")
    
    for volume in "${volumes[@]}"; do
        if docker volume inspect "aria_${volume}" >/dev/null 2>&1 || docker volume inspect "$volume" >/dev/null 2>&1; then
            log_pass "Volume $volume exists"
        else
            log_fail "Volume $volume does not exist"
        fi
    done
}

# Test resource usage
test_resources() {
    echo
    echo "Testing resource usage..."
    
    # Check CPU usage
    local cpu_usage=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}" | grep "aria-" | awk '{sum+=$2} END {print sum}' | sed 's/%//')
    
    if [ -n "$cpu_usage" ]; then
        log_info "Total CPU usage: ${cpu_usage}%"
    fi
    
    # Check memory usage
    local mem_usage=$(docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}" | grep "aria-")
    
    if [ -n "$mem_usage" ]; then
        log_info "Memory usage:"
        echo "$mem_usage" | while read line; do
            echo "  $line"
        done
    fi
}

# Test logs
test_logs() {
    echo
    echo "Checking for errors in logs..."
    
    local containers=("aria-frontend" "aria-backend")
    local error_count=0
    
    for container in "${containers[@]}"; do
        local errors=$(docker logs --tail 100 "$container" 2>&1 | grep -i "error\|fatal\|exception" | wc -l)
        
        if [ "$errors" -gt 0 ]; then
            log_info "Container $container has $errors error messages in recent logs"
            error_count=$((error_count + errors))
        fi
    done
    
    if [ "$error_count" -eq 0 ]; then
        log_pass "No errors found in recent logs"
    else
        log_info "Found $error_count error messages (review logs manually)"
    fi
}

# Display summary
display_summary() {
    echo
    echo "========================================"
    echo "  Deployment Health Check Summary"
    echo "========================================"
    echo
    echo "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo "Tests Failed: ${RED}$TESTS_FAILED${NC}"
    echo
    
    if [ "$TESTS_FAILED" -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed successfully!${NC}"
        return 0
    else
        echo -e "${RED}✗ Some tests failed. Please review the output above.${NC}"
        return 1
    fi
}

# Main execution
main() {
    echo "========================================"
    echo "  Aria ERP Deployment Health Check"
    echo "========================================"
    echo
    
    test_containers
    test_container_health
    test_endpoints
    test_database
    test_network
    test_volumes
    test_resources
    test_logs
    
    display_summary
}

# Run tests
main "$@"
exit $?

#!/bin/bash
#
# Comprehensive validation script for build-package.sh and test-package.sh
# Run this on a Linux system to validate all bash scripts
#

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}         Aria ERP - Bash Script Validation${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Determine script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR" && pwd)"

echo "Project root: $ROOT_DIR"
echo ""

TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "${YELLOW}[TEST]${NC} $test_name..."
    
    if eval "$test_command"; then
        echo -e "${GREEN}[PASS]${NC} $test_name"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}[FAIL]${NC} $test_name"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test 1: Check if scripts exist
run_test "Build script exists" \
    "[ -f '$ROOT_DIR/deployment/scripts/build-package.sh' ]"

run_test "Test script exists" \
    "[ -f '$ROOT_DIR/deployment/scripts/test-package.sh' ]"

run_test "Install script exists" \
    "[ -f '$ROOT_DIR/deployment/scripts/install-linux.sh' ]"

run_test "Uninstall script exists" \
    "[ -f '$ROOT_DIR/deployment/scripts/uninstall-linux.sh' ]"

run_test "SSL cert generator exists" \
    "[ -f '$ROOT_DIR/deployment/scripts/generate-ssl-cert-linux.sh' ]"

# Test 2: Check shebang
run_test "Build script has correct shebang" \
    "head -n 1 '$ROOT_DIR/deployment/scripts/build-package.sh' | grep -q '#!/bin/bash'"

run_test "Test script has correct shebang" \
    "head -n 1 '$ROOT_DIR/deployment/scripts/test-package.sh' | grep -q '#!/bin/bash'"

# Test 3: Check for Windows line endings (should not exist)
run_test "Build script has Unix line endings" \
    "! grep -q $'\r' '$ROOT_DIR/deployment/scripts/build-package.sh'"

run_test "Test script has Unix line endings" \
    "! grep -q $'\r' '$ROOT_DIR/deployment/scripts/test-package.sh'"

# Test 4: Syntax validation
if command -v bash &> /dev/null; then
    run_test "Build script syntax" \
        "bash -n '$ROOT_DIR/deployment/scripts/build-package.sh'"
    
    run_test "Test script syntax" \
        "bash -n '$ROOT_DIR/deployment/scripts/test-package.sh'"
    
    run_test "Install script syntax" \
        "bash -n '$ROOT_DIR/deployment/scripts/install-linux.sh'"
    
    run_test "Uninstall script syntax" \
        "bash -n '$ROOT_DIR/deployment/scripts/uninstall-linux.sh'"
    
    run_test "SSL generator syntax" \
        "bash -n '$ROOT_DIR/deployment/scripts/generate-ssl-cert-linux.sh'"
else
    echo -e "${YELLOW}[SKIP]${NC} Bash not available for syntax checks"
fi

# Test 5: Check if scripts are executable
run_test "Build script is executable" \
    "[ -x '$ROOT_DIR/deployment/scripts/build-package.sh' ]"

run_test "Test script is executable" \
    "[ -x '$ROOT_DIR/deployment/scripts/test-package.sh' ]"

# Test 6: Check for required functions in build script
run_test "Build script has clean_build_dir function" \
    "grep -q 'clean_build_dir()' '$ROOT_DIR/deployment/scripts/build-package.sh'"

run_test "Build script has build_docker_images function" \
    "grep -q 'build_docker_images()' '$ROOT_DIR/deployment/scripts/build-package.sh'"

run_test "Build script has ROOT_DIR variable" \
    "grep -q 'ROOT_DIR=' '$ROOT_DIR/deployment/scripts/build-package.sh'"

# Test 7: Check for proper error handling
run_test "Build script has set -e" \
    "grep -q 'set -e' '$ROOT_DIR/deployment/scripts/build-package.sh'"

run_test "Test script has set -e" \
    "grep -q 'set -e' '$ROOT_DIR/deployment/scripts/test-package.sh'"

# Test 8: Check Docker Compose template
run_test "Docker Compose template exists" \
    "[ -f '$ROOT_DIR/deployment/templates/docker-compose.production.yml' ]"

# Test 9: Check Traefik config templates
run_test "Traefik routes.yml exists" \
    "[ -f '$ROOT_DIR/deployment/templates/config/traefik/routes.yml' ]"

run_test "Traefik tls.yml exists" \
    "[ -f '$ROOT_DIR/deployment/templates/config/traefik/tls.yml' ]"

# Test 10: Check documentation
run_test "Installation docs exist" \
    "[ -f '$ROOT_DIR/deployment/docs/INSTALLATION.md' ]"

run_test "Configuration docs exist" \
    "[ -f '$ROOT_DIR/deployment/docs/CONFIGURATION.md' ]"

# Test 11: Verify no redundant files
run_test "No redundant ON_PREMISE_DEPLOYMENT_STATUS.md" \
    "! [ -f '$ROOT_DIR/ON_PREMISE_DEPLOYMENT_STATUS.md' ]"

run_test "No redundant PATH_BASED_ROUTING_SUMMARY.md" \
    "! [ -f '$ROOT_DIR/PATH_BASED_ROUTING_SUMMARY.md' ]"

# Summary
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}                    Test Summary${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"

if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    echo ""
    echo -e "${RED}Some tests failed. Please review the errors above.${NC}"
    exit 1
else
    echo -e "${GREEN}Failed: 0${NC}"
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}           All Tests Passed! ✓${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "The bash scripts are ready for deployment."
    echo ""
    echo "Next steps:"
    echo "  1. Run './deployment/scripts/test-package.sh' to test package validation"
    echo "  2. Run './deployment/scripts/build-package.sh' to create deployment package"
    echo ""
fi

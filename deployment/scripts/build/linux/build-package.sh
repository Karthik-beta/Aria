#!/bin/bash
#
# Aria ERP Package Builder
# Creates distributable packages for on-premise deployment
#

set -e

# Configuration - Determine project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$ROOT_DIR"

VERSION=${VERSION:-$(cat package.json | grep '"version"' | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[[:space:]]')}
BUILD_DIR="$ROOT_DIR/dist"
PACKAGE_NAME="aria-erp-v${VERSION}"
PLATFORMS=("linux" "windows")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

clean_build_dir() {
    log_info "Cleaning build directory..."
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"
}

build_docker_images() {
    log_info "Building Docker images..."
    
    # Build backend
    log_info "Building backend image..."
    docker build -t "aria-backend:${VERSION}" -f apps/backend/Dockerfile .
    
    # Build frontends
    local frontends=("asset" "crm" "hrms" "inventory")
    for frontend in "${frontends[@]}"; do
        log_info "Building $frontend image..."
        if [ "$frontend" = "crm" ]; then
            docker build -t "aria-${frontend}:${VERSION}" -f "apps/frontend/CRM/Dockerfile" .
        else
            docker build -t "aria-${frontend}:${VERSION}" -f "apps/frontend/${frontend}/Dockerfile" .
        fi
    done
    
    log_info "Docker images built successfully."
}

save_docker_images() {
    log_info "Saving Docker images..."
    
    local images_dir="$BUILD_DIR/images"
    mkdir -p "$images_dir"
    
    # Save all images
    docker save -o "$images_dir/aria-backend.tar" "aria-backend:${VERSION}"
    docker save -o "$images_dir/aria-asset.tar" "aria-asset:${VERSION}"
    docker save -o "$images_dir/aria-crm.tar" "aria-crm:${VERSION}"
    docker save -o "$images_dir/aria-hrms.tar" "aria-hrms:${VERSION}"
    docker save -o "$images_dir/aria-inventory.tar" "aria-inventory:${VERSION}"
    
    # Also save PostgreSQL and Traefik
    docker pull postgres:18-alpine
    docker pull traefik:v3.5
    docker save -o "$images_dir/postgres.tar" postgres:18-alpine
    docker save -o "$images_dir/traefik.tar" traefik:v3.5
    
    log_info "Docker images saved successfully."
}

create_package_structure() {
    log_info "Creating package structure..."
    
    local pkg_dir="$BUILD_DIR/$PACKAGE_NAME"
    
    # Create directories
    mkdir -p "$pkg_dir/bin"
    mkdir -p "$pkg_dir/config/traefik"
    mkdir -p "$pkg_dir/images"
    mkdir -p "$pkg_dir/docs"
    
    # Copy installation scripts
    cp deployment/scripts/install/linux/install.sh "$pkg_dir/bin/"
    cp deployment/scripts/install/windows/install.ps1 "$pkg_dir/bin/"
    cp deployment/scripts/install/linux/uninstall.sh "$pkg_dir/bin/"
    cp deployment/scripts/install/windows/uninstall.ps1 "$pkg_dir/bin/"
    chmod +x "$pkg_dir/bin"/*.sh
    
    # Copy Docker Compose template
    cp deployment/templates/docker-compose.production.yml "$pkg_dir/docker-compose.production.yml"
    
    # Copy environment template
    cp deployment/templates/.env.template "$pkg_dir/.env.template"
    
    # Copy Traefik configuration
    if [ -d "deployment/templates/config/traefik" ]; then
        cp deployment/templates/config/traefik/* "$pkg_dir/config/traefik/"
    fi
    
    # Copy Docker images
    cp "$BUILD_DIR/images"/*.tar "$pkg_dir/images/"
    
    # Copy documentation
    cp deployment/docs/*.md "$pkg_dir/docs/" 2>/dev/null || true
    cp README.md "$pkg_dir/docs/PROJECT_README.md" 2>/dev/null || true
    
    # Create VERSION file
    echo "$VERSION" > "$pkg_dir/VERSION"
    
    # Create load-images script
    cat > "$pkg_dir/bin/load-images.sh" << 'EOF'
#!/bin/bash
echo "Loading Docker images..."
for img in images/*.tar; do
    echo "Loading $(basename $img)..."
    docker load -i "$img"
done
echo "All images loaded successfully."
EOF
    chmod +x "$pkg_dir/bin/load-images.sh"
    
    # Create load-images script for Windows
    cat > "$pkg_dir/bin/load-images.ps1" << 'EOF'
Write-Host "Loading Docker images..." -ForegroundColor Green
Get-ChildItem images\*.tar | ForEach-Object {
    Write-Host "Loading $($_.Name)..." -ForegroundColor Yellow
    docker load -i $_.FullName
}
Write-Host "All images loaded successfully." -ForegroundColor Green
EOF
    
    log_info "Package structure created successfully."
}

create_archives() {
    log_info "Creating distribution archives..."
    
    cd "$BUILD_DIR"
    
    # Create tar.gz for Linux
    tar -czf "${PACKAGE_NAME}-linux.tar.gz" "$PACKAGE_NAME"
    log_info "Created ${PACKAGE_NAME}-linux.tar.gz"
    
    # Create zip for Windows
    if command -v zip &> /dev/null; then
        zip -r "${PACKAGE_NAME}-windows.zip" "$PACKAGE_NAME" > /dev/null
        log_info "Created ${PACKAGE_NAME}-windows.zip"
    else
        log_error "zip command not found. Skipping Windows archive."
    fi
    
    cd ..
    
    log_info "Distribution archives created successfully."
}

generate_checksums() {
    log_info "Generating checksums..."
    
    cd "$BUILD_DIR"
    
    if command -v sha256sum &> /dev/null; then
        sha256sum *.tar.gz *.zip 2>/dev/null > checksums.txt || true
        log_info "Checksums generated in checksums.txt"
    fi
    
    cd ..
}

cleanup() {
    log_info "Cleaning up temporary files..."
    rm -rf "$BUILD_DIR/images"
    rm -rf "$BUILD_DIR/$PACKAGE_NAME"
}

show_summary() {
    cat << EOF

${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}
${GREEN}                 Package Build Complete!${NC}
${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

Version: $VERSION
Build Directory: $BUILD_DIR

Distribution Packages:
  - ${PACKAGE_NAME}-linux.tar.gz
  - ${PACKAGE_NAME}-windows.zip

Installation:
  Linux:   Extract and run: sudo ./bin/install-linux.sh
  Windows: Extract and run: .\bin\install-windows.ps1 (as Administrator)

${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

EOF
}

# Main build flow
main() {
    log_info "Starting Aria ERP package build (version: $VERSION)..."
    
    clean_build_dir
    build_docker_images
    save_docker_images
    create_package_structure
    create_archives
    generate_checksums
    cleanup
    show_summary
}

# Run main function
main "$@"

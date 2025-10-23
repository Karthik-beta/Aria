# Technical Design Document (TDD)

## Aria ERP - Complete Deployment and Infrastructure Rewrite

### Document Information

- **Version**: 1.0
- **Date**: October 23, 2025
- **Author**: System Architect
- **Project**: Aria ERP Deployment Infrastructure Overhaul
- **Branch**: refactor/deployment-rewrite

***

## 1. Executive Summary

This Technical Design Document outlines the complete rewrite of the Aria ERP deployment and infrastructure layer. The project involves migrating from Traefik to Caddy, implementing a multi-zone Next.js 16 frontend architecture, and creating a robust, portable deployment system that supports both Linux and Windows 11 environments for SME clients.

### Key Changes

- **Frontend**: Migration to Next.js 16 multi-zone architecture in a single application
- **Reverse Proxy**: Complete replacement of Traefik with Caddy v2
- **Docker**: Rewritten Dockerfiles for frontend and backend
- **Deployment**: Cross-platform support (Linux/Windows 11) with service configuration
- **SSL**: Automatic SSL certificate generation and management
- **Portability**: Packaged deployment for FTP/USB distribution

***

## 2. Current State Analysis

### 2.1 Existing Architecture

Based on the repository analysis, the current system uses:

- **Traefik v3.5** as reverse proxy
- **Multiple frontend applications** (asset, hrms, inventory, crm) as separate containers
- **PostgreSQL 18** database
- **Node.js backend** with tRPC
- **Docker Compose** for orchestration


### 2.2 Identified Issues

- Multiple frontend containers increase complexity
- Traefik configuration overhead
- Lack of Windows 11 deployment support
- No automated SSL certificate management for private networks
- Complex deployment process for client sites

***

## 3. Solution Architecture

### 3.1 High-Level Architecture

```mermaid
graph TB
    subgraph "Client Network"
        Client[Client Browsers]
        
        subgraph "Caddy Reverse Proxy"
            Caddy[Caddy v2<br/>- HTTP/HTTPS/WSS/HTTP3<br/>- Auto SSL<br/>- Load Balancing]
        end
        
        subgraph "Application Layer"
            Frontend[Next.js 16 Multi-Zone<br/>- App Switcher<br/>- All modules in one app]
            Backend[Node.js Backend<br/>- tRPC API<br/>- Business Logic]
        end
        
        subgraph "Data Layer"
            DB[(PostgreSQL 18<br/>Database)]
        end
        
        Client --> Caddy
        Caddy --> Frontend
        Caddy --> Backend
        Frontend --> Backend
        Backend --> DB
    end
```


### 3.2 Multi-Zone Frontend Architecture

The new frontend will use Next.js 16 multi-zone architecture within a single application:

```
/                 → Main landing/dashboard (default zone)
/asset/*          → Asset Management Module
/hrms/*           → HR Management Module  
/inventory/*      → Inventory Management Module
/crm/*            → CRM Module
/api/trpc/*       → Backend API routes
```


***

## 4. Detailed Design

### 4.1 Caddy Configuration

#### 4.1.1 Caddyfile Structure

```caddyfile
# Global options
{
    # Enable HTTP/3
    servers {
        protocol {
            experimental_http3
        }
    }
    
    # Auto HTTPS settings
    auto_https on
    
    # Local development CA
    local_certs
}

# Production configuration
{$DOMAIN:localhost} {
    # Enable all protocols
    protocols h1 h2 h3
    
    # Frontend routes
    route {
        # API routes to backend
        reverse_proxy /api/* backend:3001
        reverse_proxy /trpc/* backend:3001
        
        # WebSocket support
        reverse_proxy /ws backend:3001 {
            header_up Upgrade {>Upgrade}
            header_up Connection {>Connection}
        }
        
        # Frontend routes
        reverse_proxy frontend:3000
    }
    
    # Security headers
    header {
        # Security headers
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        
        # Remove server header
        -Server
    }
    
    # Compression
    encode gzip zstd
    
    # Rate limiting
    rate_limit {
        zone dynamic {
            key {remote_host}
            events 1000
            window 1m
        }
    }
    
    # Logging
    log {
        output file /var/log/caddy/access.log {
            roll_size 100MB
            roll_keep 10
        }
        format json
    }
}
```


### 4.2 Frontend Architecture (Next.js 16)

#### 4.2.1 Next.js Configuration

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Multi-zone configuration - no basePath needed in Next.js 16
  // Routes are handled natively within the single application
  
  // Production optimizations
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  
  // Enable HTTP/3 and modern features
  experimental: {
    // Optimize for production
    optimizePackageImports: [
      '@radix-ui/react-icons',
      '@tabler/icons-react',
      'lucide-react',
      'recharts'
    ],
    
    // Enable modern web features
    serverComponentsExternalPackages: [
      'sharp',
      '@prisma/client',
      'prisma'
    ],
  },
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  
  // Headers for PWA and security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Content-Type-Options', 
            value: 'nosniff'
          }
        ],
      },
    ];
  },
  
  // Route rewrites for multi-zone behavior
  async rewrites() {
    return [
      // Internal API routes
      {
        source: '/api/:path*',
        destination: '/api/:path*'
      },
      {
        source: '/trpc/:path*', 
        destination: '/api/trpc/:path*'
      }
    ];
  },
};

export default nextConfig;
```


#### 4.2.2 App Router Structure

```
apps/frontend/src/app/
├── layout.tsx                 # Root layout
├── page.tsx                   # Main dashboard
├── globals.css               # Global styles
├── api/                      # API routes
│   └── trpc/                 # tRPC endpoints
├── asset/                    # Asset Management Zone
│   ├── layout.tsx
│   ├── page.tsx
│   └── [...slug]/
├── hrms/                     # HR Management Zone  
│   ├── layout.tsx
│   ├── page.tsx
│   └── [...slug]/
├── inventory/                # Inventory Management Zone
│   ├── layout.tsx
│   ├── page.tsx
│   └── [...slug]/
├── crm/                      # CRM Zone
│   ├── layout.tsx
│   ├── page.tsx
│   └── [...slug]/
└── components/               # Shared components
    └── app-switcher.tsx      # Navigation between zones
```


### 4.3 Docker Configuration

#### 4.3.1 Frontend Dockerfile

```dockerfile
# Frontend Dockerfile - apps/frontend/Dockerfile
FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat

# Install pnpm
RUN corepack enable pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY packages/ ./packages/
COPY apps/frontend/package.json ./apps/frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile --production=false

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY apps/frontend ./apps/frontend
COPY turbo.json package.json pnpm-workspace.yaml ./

# Install pnpm
RUN corepack enable pnpm

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
WORKDIR /app/apps/frontend
RUN pnpm build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create nextjs user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/apps/frontend/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000

# server.js is created by next build from the standalone output
CMD ["node", "apps/frontend/server.js"]
```


#### 4.3.2 Backend Dockerfile

```dockerfile
# Backend Dockerfile - apps/backend/Dockerfile
FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat

# Install pnpm
RUN corepack enable pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY packages/ ./packages/
COPY apps/backend/package.json ./apps/backend/

# Install dependencies
RUN pnpm install --frozen-lockfile --production=false

# Build the source code
FROM base AS builder
WORKDIR /app

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules  
COPY --from=deps /app/packages ./packages
COPY apps/backend ./apps/backend
COPY turbo.json package.json pnpm-workspace.yaml ./

# Install pnpm
RUN corepack enable pnpm

# Build the application
WORKDIR /app/apps/backend
RUN pnpm build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create app user
RUN addgroup --system --gid 1001 backend
RUN adduser --system --uid 1001 backend

# Copy built application
COPY --from=builder --chown=backend:backend /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/node_modules ./node_modules

USER backend

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/main.js"]
```


### 4.4 Deployment Architecture

#### 4.4.1 Linux Deployment (docker-compose.production.yml)

```yaml
services:
  caddy:
    image: caddy:2.8-alpine
    container_name: aria-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"  # HTTP/3
    volumes:
      - ./deployment/caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - ./deployment/caddy/data:/data
      - ./deployment/caddy/config:/config
      - ./deployment/caddy/logs:/var/log/caddy
    environment:
      - DOMAIN=${DOMAIN:-localhost}
    networks:
      - aria-network
    depends_on:
      - frontend
      - backend

  frontend:
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile
    container_name: aria-frontend
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=http://backend:3001
    networks:
      - aria-network
    depends_on:
      - backend

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile  
    container_name: aria-backend
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://aria:${POSTGRES_PASSWORD}@postgres:5432/aria
      - PORT=3001
    networks:
      - aria-network
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:18-alpine
    container_name: aria-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=aria
      - POSTGRES_USER=aria
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - aria-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -d aria -U aria"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres-data:
    driver: local

networks:
  aria-network:
    driver: bridge
```


#### 4.4.2 Windows 11 Deployment Configuration

**docker-compose.windows.yml**

```yaml
services:
  caddy:
    image: caddy:2.8-windowsservercore-ltsc2022
    container_name: aria-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - type: bind
        source: ./deployment/caddy/Caddyfile
        target: C:\caddy\Caddyfile
        read_only: true
      - caddy-data:C:\data
      - caddy-config:C:\config
      - type: bind
        source: ./deployment/caddy/logs
        target: C:\logs
    environment:
      - DOMAIN=${DOMAIN:-localhost}
    networks:
      - aria-network
    depends_on:
      - frontend
      - backend

  frontend:
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile.windows
    container_name: aria-frontend
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=http://backend:3001
    networks:
      - aria-network
    depends_on:
      - backend

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile.windows
    container_name: aria-backend
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://aria:${POSTGRES_PASSWORD}@postgres:5432/aria
      - PORT=3001
    networks:
      - aria-network
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:18-windowsservercore
    container_name: aria-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=aria
      - POSTGRES_USER=aria
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:C:\var\lib\postgresql\data
    networks:
      - aria-network
    healthcheck:
      test: ["CMD", "pg_isready", "-d", "aria", "-U", "aria"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres-data:
  caddy-data:
  caddy-config:

networks:
  aria-network:
    driver: nat
```


### 4.5 SSL Certificate Management

#### 4.5.1 Automatic SSL Certificate Generation

```dockerfile
# SSL Certificate Generator - deployment/ssl/Dockerfile
FROM alpine:3.19

RUN apk add --no-cache openssl

COPY generate-certs.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/generate-certs.sh

ENTRYPOINT ["/usr/local/bin/generate-certs.sh"]
```

**generate-certs.sh**

```bash
#!/bin/sh
set -e

# Configuration
CERT_DIR="/certs"
DAYS=365
KEY_SIZE=2048

# Create certificate directory
mkdir -p "$CERT_DIR"

# Function to generate certificates for all IP addresses
generate_certs() {
    local domain=${1:-localhost}
    local ips=$(ip route | awk '/src/ {print $9}' | sort -u)
    local san_entries=""
    
    # Build SAN entries for all IPs
    for ip in $ips; do
        san_entries="${san_entries}IP:${ip},"
    done
    
    # Remove trailing comma
    san_entries=${san_entries%,}
    
    # Create OpenSSL config with SAN
    cat > "$CERT_DIR/openssl.conf" <<EOF
[req]
default_bits = $KEY_SIZE
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=US
ST=State
L=City
O=Organization
OU=OrgUnit
CN=$domain

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = $domain
DNS.2 = *.$domain
DNS.3 = localhost
EOF

    # Add IP addresses to alt_names
    local counter=1
    for ip in $ips; do
        echo "IP.$counter = $ip" >> "$CERT_DIR/openssl.conf"
        counter=$((counter + 1))
    done

    # Generate private key
    openssl genrsa -out "$CERT_DIR/server.key" $KEY_SIZE

    # Generate certificate
    openssl req -new -x509 -key "$CERT_DIR/server.key" \
        -out "$CERT_DIR/server.crt" \
        -days $DAYS \
        -config "$CERT_DIR/openssl.conf" \
        -extensions v3_req

    # Set permissions
    chmod 600 "$CERT_DIR/server.key"
    chmod 644 "$CERT_DIR/server.crt"
    
    echo "SSL certificates generated successfully!"
    echo "Certificate: $CERT_DIR/server.crt"
    echo "Private Key: $CERT_DIR/server.key"
    echo "Valid for $DAYS days"
}

# Main execution
generate_certs "${DOMAIN:-localhost}"
```


### 4.6 Service Configuration

#### 4.6.1 Linux Systemd Service

**deployment/systemd/aria.service**

```ini
[Unit]
Description=Aria ERP Application
Requires=docker.service
After=docker.service
StartLimitIntervalSec=0

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/aria
ExecStartPre=/usr/bin/docker compose -f docker-compose.production.yml pull
ExecStart=/usr/bin/docker compose -f docker-compose.production.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.production.yml down
TimeoutStartSec=300
TimeoutStopSec=120
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```


#### 4.6.2 Windows Service Configuration

**deployment/windows/aria-service.xml**

```xml
<service>
  <id>aria-erp</id>
  <name>Aria ERP</name>
  <description>Aria ERP Application Service</description>
  
  <executable>docker</executable>
  <arguments>compose -f docker-compose.windows.yml up</arguments>
  <workingdirectory>C:\aria</workingdirectory>
  
  <startmode>Automatic</startmode>
  <delayedAutoStart>true</delayedAutoStart>
  
  <onfailure action="restart" delay="10 sec"/>
  <onfailure action="restart" delay="20 sec"/>
  <onfailure action="reboot" delay="1 day"/>
  
  <resetfailure>1 day</resetfailure>
  
  <logmode>roll-by-time</logmode>
  <logpath>C:\aria\logs</logpath>
  
  <env name="POSTGRES_PASSWORD" value="%POSTGRES_PASSWORD%"/>
  <env name="DOMAIN" value="%DOMAIN%"/>
</service>
```


### 4.7 Packaging and Distribution

#### 4.7.1 Build Script

**scripts/build-deployment.sh**

```bash
#!/bin/bash
set -e

VERSION=${1:-"latest"}
PLATFORM=${2:-"linux"}
BUILD_DIR="./dist/aria-erp-${VERSION}-${PLATFORM}"

echo "Building Aria ERP deployment package v${VERSION} for ${PLATFORM}..."

# Create build directory
mkdir -p "$BUILD_DIR"

# Copy application files
cp -r apps "$BUILD_DIR/"
cp -r packages "$BUILD_DIR/"
cp package.json pnpm-workspace.yaml turbo.json "$BUILD_DIR/"

# Copy deployment configurations
mkdir -p "$BUILD_DIR/deployment"
cp -r deployment/caddy "$BUILD_DIR/deployment/"
cp -r deployment/ssl "$BUILD_DIR/deployment/"

if [ "$PLATFORM" = "linux" ]; then
    cp docker-compose.production.yml "$BUILD_DIR/"
    cp -r deployment/systemd "$BUILD_DIR/deployment/"
    cp scripts/install-linux.sh "$BUILD_DIR/"
elif [ "$PLATFORM" = "windows" ]; then
    cp docker-compose.windows.yml "$BUILD_DIR/"
    cp -r deployment/windows "$BUILD_DIR/deployment/"
    cp scripts/install-windows.ps1 "$BUILD_DIR/"
fi

# Create environment template
cat > "$BUILD_DIR/.env.template" <<EOF
# Database Configuration
POSTGRES_PASSWORD=your_secure_password_here

# Domain Configuration (leave as localhost for auto-IP SSL)
DOMAIN=localhost

# Application Configuration  
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
EOF

# Create installation README
cat > "$BUILD_DIR/README.md" <<EOF
# Aria ERP Deployment Package v${VERSION}

## System Requirements
- Docker Engine 24.0+
- Docker Compose v2.20+
- 4GB RAM minimum, 8GB recommended
- 20GB disk space minimum

## Installation Instructions

### ${PLATFORM^} Installation
1. Extract this package to your desired location
2. Copy .env.template to .env and configure
3. Run the installation script:
   - Linux: sudo ./install-linux.sh
   - Windows: Run PowerShell as Administrator and execute ./install-windows.ps1

## Configuration
Edit the .env file to customize:
- Database password
- Domain name (or leave as localhost for auto-IP SSL)

## Support
For technical support, contact your Aria ERP deployment team.
EOF

# Create archive
if [ "$PLATFORM" = "linux" ]; then
    tar -czf "aria-erp-${VERSION}-${PLATFORM}.tar.gz" -C "./dist" "aria-erp-${VERSION}-${PLATFORM}"
else
    (cd "./dist" && zip -r "../aria-erp-${VERSION}-${PLATFORM}.zip" "aria-erp-${VERSION}-${PLATFORM}")
fi

echo "Deployment package created: aria-erp-${VERSION}-${PLATFORM}.tar.gz"
```


### 4.8 Testing Strategy

#### 4.8.1 Automated Testing Pipeline

```yaml
# .github/workflows/deployment-test.yml
name: Deployment Testing

on:
  push:
    branches: [refactor/deployment-rewrite]
  pull_request:
    branches: [refactor/deployment-rewrite]

jobs:
  test-linux-deployment:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Docker
        uses: docker/setup-buildx-action@v3
      
      - name: Build and test Linux deployment
        run: |
          cp .env.example .env
          docker compose -f docker-compose.production.yml build
          docker compose -f docker-compose.production.yml up -d
          
      - name: Health check
        run: |
          sleep 30
          curl -f http://localhost/ || exit 1
          curl -f http://localhost/api/health || exit 1
          
      - name: Cleanup
        run: docker compose -f docker-compose.production.yml down -v

  test-windows-deployment:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build and test Windows deployment  
        run: |
          Copy-Item .env.example .env
          docker compose -f docker-compose.windows.yml build
          docker compose -f docker-compose.windows.yml up -d
          
      - name: Health check
        run: |
          Start-Sleep 30
          Invoke-WebRequest -Uri "http://localhost/" -UseBasicParsing
          Invoke-WebRequest -Uri "http://localhost/api/health" -UseBasicParsing
          
      - name: Cleanup  
        run: docker compose -f docker-compose.windows.yml down -v

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

  performance-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup and deploy
        run: |
          cp .env.example .env
          docker compose -f docker-compose.production.yml up -d
          sleep 45
          
      - name: Load testing with Artillery
        run: |
          npm install -g artillery
          artillery quick --count 200 --num 20 http://localhost/
```


***

## 5. Implementation Plan

### 5.1 Phase 1: Infrastructure Migration (Week 1-2)

1. **Replace Traefik with Caddy**
    - Create Caddyfile configuration
    - Test SSL certificate generation
    - Verify HTTP/3 support
2. **Frontend Consolidation**
    - Migrate to Next.js 16 multi-zone architecture
    - Implement app switcher component
    - Update routing and navigation

### 5.2 Phase 2: Docker Optimization (Week 3)

1. **Dockerfile Rewrite**
    - Implement multi-stage builds
    - Optimize image sizes
    - Add health checks
2. **Windows Support**
    - Create Windows-specific Dockerfiles
    - Test Windows container compatibility
    - Implement Windows service configuration

### 5.3 Phase 3: Deployment Automation (Week 4)

1. **Packaging System**
    - Create build scripts
    - Implement portable deployment packages
    - Add installation automation
2. **Service Configuration**
    - Linux systemd service setup
    - Windows service configuration
    - Auto-startup configuration

### 5.4 Phase 4: Testing and Validation (Week 5)

1. **Testing Implementation**
    - Automated deployment tests
    - Security scanning
    - Performance validation
    - Cross-platform testing
2. **Documentation**
    - Deployment guides
    - Troubleshooting documentation
    - Operations manual

***

## 6. Security Considerations

### 6.1 SSL/TLS Security

- **Automatic SSL Generation**: Self-signed certificates for all available IP addresses
- **HTTP/3 Support**: Latest protocol for enhanced performance and security
- **Security Headers**: Comprehensive security header implementation via Caddy


### 6.2 Container Security

- **Non-root Users**: All containers run with dedicated non-root users
- **Minimal Base Images**: Alpine Linux for reduced attack surface
- **Health Checks**: Implemented for all services to ensure availability


### 6.3 Network Security

- **Internal Networks**: Docker networks for service isolation
- **Port Management**: Only necessary ports exposed
- **Rate Limiting**: Built-in rate limiting via Caddy

***

## 7. Performance Optimization

### 7.1 Frontend Optimization

- **Next.js 16 Features**: Leveraging latest optimizations
- **Multi-zone Architecture**: Reduced bundle sizes per zone
- **Static Asset Optimization**: Proper caching and compression


### 7.2 Backend Optimization

- **Connection Pooling**: Optimized database connections
- **Health Monitoring**: Comprehensive health checks
- **Resource Limits**: Proper container resource allocation


### 7.3 Infrastructure Optimization

- **HTTP/3**: Latest protocol support for improved performance
- **Compression**: Gzip and Zstd compression via Caddy
- **Caching**: Strategic caching headers for static assets

***

## 8. Monitoring and Logging

### 8.1 Application Logging

- **Structured Logging**: JSON format logs
- **Log Rotation**: Automatic log rotation with size limits
- **Centralized Logging**: Container logs accessible via Docker commands


### 8.2 Health Monitoring

- **Health Endpoints**: All services expose health check endpoints
- **Container Health**: Docker health checks for automatic restarts
- **Service Dependencies**: Proper startup ordering and dependency checking

***

## 9. Deployment Guide

### 9.1 Linux Deployment

```bash
# Extract deployment package
tar -xzf aria-erp-v1.0-linux.tar.gz
cd aria-erp-v1.0-linux

# Configure environment
cp .env.template .env
# Edit .env file with your settings

# Install and start
sudo ./install-linux.sh

# Verify installation
sudo systemctl status aria
curl http://localhost/
```


### 9.2 Windows 11 Deployment

```powershell
# Extract deployment package
Expand-Archive aria-erp-v1.0-windows.zip -DestinationPath C:\aria

# Configure environment  
Copy-Item .env.template .env
# Edit .env file with your settings

# Install and start (Run as Administrator)
.\install-windows.ps1

# Verify installation
Get-Service aria-erp
Invoke-WebRequest http://localhost/
```


***

## 10. Maintenance and Updates

### 10.1 Update Procedure

1. **Backup**: Automated backup of database and configuration
2. **Deploy**: Deploy new package with zero-downtime strategy
3. **Verify**: Health checks and validation procedures
4. **Rollback**: Automated rollback capability if issues detected

### 10.2 Monitoring

- **Resource Usage**: CPU, memory, and disk monitoring
- **Application Health**: Endpoint monitoring and alerting
- **Log Analysis**: Centralized log monitoring and analysis

***

## 11. Conclusion

This Technical Design Document provides a comprehensive roadmap for completely rewriting the Aria ERP deployment and infrastructure layer. The new architecture provides:

✅ **Cross-platform Support**: Native support for both Linux and Windows 11
✅ **Simplified Frontend**: Multi-zone Next.js 16 application
✅ **Modern Infrastructure**: Caddy v2 with HTTP/3 and automatic SSL
✅ **Portable Deployment**: Easy-to-distribute deployment packages
✅ **Production Ready**: Comprehensive testing, monitoring, and security measures
✅ **SME Optimized**: Designed for 200 users with easy deployment and maintenance

The implementation will be conducted in phases with thorough testing at each stage to ensure reliability and performance for client deployments.
<span style="display:none">[^1][^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^2][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^3][^30][^31][^32][^33][^34][^35][^36][^37][^38][^39][^4][^40][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://caddyserver.com/docs/install

[^2]: https://www.docker.com/blog/deploying-web-applications-quicker-and-easier-with-caddy-2/

[^3]: https://caddyserver.com/docs/

[^4]: https://hub.docker.com/_/caddy

[^5]: https://betterstack.com/community/guides/web-servers/caddy/

[^6]: https://nextjs.org/docs/pages/guides/multi-zones

[^7]: https://dev.to/devops_descent/mastering-docker-essential-best-practices-for-efficiency-and-security-34ij

[^8]: https://caddyserver.com/docs/running

[^9]: https://github.com/vercel/next.js/discussions/16995

[^10]: https://docs.docker.com/compose/

[^11]: https://github.com/caddyserver/caddy-docker

[^12]: https://nextjs.org/docs/app/getting-started/deploying

[^13]: https://docs.docker.com/build/building/best-practices/

[^14]: https://caddyserver.com

[^15]: https://codeparrot.ai/blogs/deploy-nextjs-app-with-docker-complete-guide-for-2025

[^16]: https://docs.docker.com/compose/releases/release-notes/

[^17]: https://caddy.community/t/caddy-via-docker-windows-var/23068

[^18]: https://github.com/jayeshjawale95/nextjs-multizones-docker

[^19]: https://betterstack.com/community/guides/scaling-docker/docker-compose-getting-started/

[^20]: https://github.com/caddyserver/caddy

[^21]: https://forums.docker.com/t/can-docker-run-in-production-on-windows-server/146878

[^22]: https://learn.microsoft.com/en-us/virtualization/windowscontainers/quick-start/set-up-environment

[^23]: https://docs.docker.com/desktop/setup/install/windows-install/

[^24]: https://forums.docker.com/t/deploy-docker-image-on-production-server/143235

[^25]: https://learn.microsoft.com/en-us/virtualization/windowscontainers/manage-docker/configure-docker-daemon

[^26]: https://docs.docker.com/engine/daemon/

[^27]: https://codefresh.io/blog/using-docker-generate-ssl-certificates/

[^28]: https://www.ionos.com/digitalguide/server/configuration/docker-windows-11/

[^29]: https://forums.docker.com/t/how-to-automatically-start-docker-in-windows-10-without-user-login/140086

[^30]: https://stackoverflow.com/questions/26028971/docker-container-ssl-certificates

[^31]: https://stackoverflow.com/questions/45554311/docker-on-windows-in-production

[^32]: https://stackoverflow.com/questions/51252181/how-to-start-docker-daemon-windows-service-at-startup-without-the-need-to-log

[^33]: https://hub.docker.com/r/stakater/ssl-certs-generator

[^34]: https://www.reddit.com/r/docker/comments/159espu/why_cant_docker_desktop_windows_be_a_service/

[^35]: https://docs.docker.com/reference/cli/dockerd/

[^36]: https://github.com/paulczar/omgwtfssl

[^37]: https://forums.docker.com/t/dockerizing-a-windows-service-net/18415

[^38]: https://blog.openreplay.com/fix-cannot-connect-to-the-docker-daemon-windows/

[^39]: https://www.globalsign.com/en/blog/securing-docker-containers-ssl-tls-certificates

[^40]: https://www.youtube.com/watch?v=_Mu4lI9NpPc


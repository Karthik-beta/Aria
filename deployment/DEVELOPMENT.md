# Aria ERP Deployment Package - Developer Guide

This guide is for developers who need to build and test the deployment package.

## Overview

The deployment infrastructure provides:

- Automated packaging scripts
- Cross-platform installation (Windows/Linux)
- Docker-based containerization
- System service integration
- Modular frontend selection

## Directory Structure

```
deployment/
├── scripts/
│   ├── build-package.sh        # Main build script
│   ├── test-package.sh         # Testing script
│   ├── install-linux.sh        # Linux installer
│   ├── install-windows.ps1     # Windows installer
│   ├── uninstall-linux.sh      # Linux uninstaller
│   └── uninstall-windows.ps1   # Windows uninstaller
├── templates/
│   ├── docker-compose.production.yml
│   ├── .env.template
│   ├── config/traefik/         # Traefik configuration
│   └── aria-erp.service.template
├── docs/
│   ├── INSTALLATION.md
│   ├── CONFIGURATION.md
│   └── TROUBLESHOOTING.md
└── README.md
```

## Building the Package

### Prerequisites

- Docker and Docker Compose installed
- Bash shell (Git Bash on Windows)
- `pnpm` package manager
- At least 10GB free disk space

### Build Process

1. **Build all applications:**

   ```bash
   pnpm build
   ```

2. **Create deployment package:**

   ```bash
   pnpm package
   ```

   This script will:
   - Build all Docker images
   - Save images as tar archives
   - Create package directory structure
   - Copy configuration templates
   - Copy documentation
   - Generate distribution archives

3. **Output:**
   - `dist/aria-erp-v{version}-linux.tar.gz`
   - `dist/aria-erp-v{version}-windows.zip`
   - `dist/checksums.txt`

## Testing the Package

### Automated Tests

Run the test suite:

```bash
pnpm package:test
```

This validates:

- Docker availability
- Required files present
- Script syntax correctness
- Docker Compose configuration
- Image build process
- Documentation completeness

### Manual Testing

#### Linux Testing

1. **Extract package:**

   ```bash
   tar -xzf dist/aria-erp-v0.1.0-linux.tar.gz
   cd aria-erp-v0.1.0
   ```

2. **Load images:**

   ```bash
   sudo ./bin/load-images.sh
   ```

3. **Install:**

   ```bash
   sudo ./bin/install-linux.sh --domain test.local --modules full
   ```

4. **Verify installation:**

   ```bash
   sudo systemctl status aria-erp
   docker compose ps
   ```

5. **Test access:**

   ```bash
   curl http://localhost
   ```

6. **Uninstall:**
   ```bash
   sudo ./bin/uninstall-linux.sh
   ```

#### Windows Testing

1. Extract ZIP file
2. Open PowerShell as Administrator
3. Navigate to extracted directory
4. Run: `.\bin\load-images.ps1`
5. Run: `.\bin\install-windows.ps1 -Domain "test.local" -Modules "full"`
6. Verify: `docker compose ps`
7. Test access in browser: `http://localhost`
8. Uninstall: `.\bin\uninstall-windows.ps1`

## Development Workflow

### Adding New Features

1. **Update templates** in `deployment/templates/`
2. **Update installation scripts** if needed
3. **Update documentation** in `deployment/docs/`
4. **Test changes** with `pnpm package:test`
5. **Build package** with `pnpm package`
6. **Manual test** on target platform

### Modifying Docker Images

1. Update Dockerfiles in `apps/*/Dockerfile`
2. Test locally: `docker build -t test-image -f apps/backend/Dockerfile .`
3. Update docker-compose.production.yml if needed
4. Rebuild package

### Updating Documentation

Documentation is in `deployment/docs/`:

- **INSTALLATION.md** - Installation procedures
- **CONFIGURATION.md** - Configuration reference
- **TROUBLESHOOTING.md** - Common issues and solutions

Keep documentation in sync with code changes.

## Package Components

### Installation Scripts

#### bin/install-linux.sh (in packaged distribution)

- Checks prerequisites (Docker, ports, permissions)
- Creates installation directories
- Copies configuration files
- Configures environment variables
- Installs systemd service
- Starts services

#### bin/install-windows.ps1 (in packaged distribution)

- Checks for admin privileges
- Verifies Docker Desktop is running
- Creates installation directories
- Copies configuration files
- Creates scheduled task for auto-start
- Starts services

**Note**: The build script (`deployment/scripts/build/linux/build-package.sh`) copies installation scripts from `deployment/scripts/install/` into `bin/` in the packaged distribution.

### Docker Compose Template

The production compose file (`docker-compose.production.yml`) includes:

- Traefik reverse proxy
- PostgreSQL database
- Backend API
- Frontend modules (profile-based)

### Environment Configuration

`.env.template` provides:

- Version settings
- Domain configuration
- Database credentials
- Module licensing
- Application settings

### Traefik Configuration

Static configuration files:

- `routes.yml` - HTTP routing rules
- `tls.yml` - SSL/TLS configuration

## Troubleshooting Development Issues

### Build Fails

**Docker images won't build:**

```bash
# Check Docker
docker version

# Build manually to see errors
docker build -t test -f apps/backend/Dockerfile .

# Check disk space
df -h
```

**Package script fails:**

```bash
# Run with verbose output
bash -x deployment/scripts/build/linux/build-package.sh
```

### Test Failures

**Script syntax errors:**

```bash
# Check specific script
bash -n deployment/scripts/install/linux/install.sh

# Check with shellcheck (if installed)
shellcheck deployment/scripts/*.sh
```

**Docker Compose validation fails:**

```bash
cd deployment/templates
docker compose -f docker-compose.production.yml config
```

### Installation Test Fails

**Services won't start:**

```bash
# Check Docker logs
docker compose logs

# Check specific container
docker logs aria-backend

# Verify environment file
cat .env
```

**Port conflicts:**

```bash
# Find what's using port 80/443
sudo netstat -tulpn | grep -E ':(80|443)'

# Kill conflicting process or change ports
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build Deployment Package

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10

      - name: Install dependencies
        run: pnpm install

      - name: Build applications
        run: pnpm build

      - name: Run tests
        run: pnpm package:test

      - name: Build package
        run: pnpm package

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: deployment-package
          path: dist/*.tar.gz
```

## Best Practices

### Security

1. **Never commit secrets** - Use templates with placeholders
2. **Auto-generate passwords** - Installation scripts generate secure passwords
3. **Validate inputs** - Check user inputs in scripts
4. **Use minimal permissions** - Non-root containers where possible

### Reliability

1. **Health checks** - All services have health checks
2. **Auto-restart** - Services restart on failure
3. **Graceful shutdown** - Proper signal handling
4. **Data persistence** - Volumes for all stateful data

### Maintainability

1. **Clear documentation** - Keep docs updated
2. **Consistent naming** - Follow naming conventions
3. **Modular scripts** - Break complex scripts into functions
4. **Version everything** - Track versions in all artifacts

### Testing

1. **Test on clean systems** - Use VMs or containers
2. **Test both platforms** - Windows and Linux
3. **Test upgrade paths** - Not just fresh installs
4. **Automate where possible** - Reduce manual testing

## Release Process

1. **Update version** in `package.json`
2. **Update CHANGELOG** with changes
3. **Run full test suite:** `pnpm package:test`
4. **Build package:** `pnpm package`
5. **Manual test** on both platforms
6. **Tag release** in git
7. **Create GitHub release** with artifacts
8. **Update documentation** if needed

## Support and Debugging

### Log Locations

**Linux:**

- System logs: `journalctl -u aria-erp`
- Docker logs: `docker compose logs`
- Installation: `/opt/aria-erp/logs/`

**Windows:**

- Docker logs: `docker compose logs`
- Installation: `C:\Program Files\AriaERP\logs\`

### Common Development Issues

**"Image not found" during installation:**

- Ensure images are loaded: `docker images | grep aria`
- Check image names match compose file
- Verify VERSION in .env

**Services restart continuously:**

- Check environment variables
- Verify database connectivity
- Review container logs

**Module not accessible:**

- Check LICENSED_MODULES in .env
- Verify Traefik routing
- Check DNS/hosts file

## Contributing

When contributing to deployment infrastructure:

1. Follow existing code style
2. Update documentation with changes
3. Add tests for new features
4. Test on both Windows and Linux
5. Update this guide if adding new components

---

**Last Updated**: October 3, 2025  
**Version**: 0.1.0

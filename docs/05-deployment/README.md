# Deployment Documentation

This document provides a comprehensive overview of the Aria ERP deployment process, built with Docker and Caddy.

## Overview

The deployment process is designed to be simple, reliable, and cross-platform. It uses Docker Compose to orchestrate the different services of the application, and Caddy as a reverse proxy.

## Tech Stack

- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **Reverse Proxy**: Caddy
- **Database**: PostgreSQL
- **Cache**: Redis

## Project Structure

```
deployment/
├── caddy/
│   ├── Caddyfile.development
│   └── Caddyfile.production
├── scripts/
│   ├── install-linux.sh
│   └── install-windows.ps1
├── ssl/
│   ├── generate-certs.ps1
│   └── generate-certs.sh
├── systemd/
│   └── aria-erp.service
├── tests/
│   ├── health-check.ps1
│   └── health-check.sh
└── windows/
    └── aria-erp.xml
```

- **`caddy/`**: Contains the Caddy configuration files for development and production.
- **`scripts/`**: Contains the installation scripts for Linux and Windows.
- **`ssl/`**: Contains scripts to generate SSL certificates for development.
- **`systemd/`**: Contains the systemd service file for Linux.
- **`tests/`**: Contains health check scripts for Linux and Windows.
- **`windows/`**: Contains the Windows service configuration file.

## Installation

The installation process is automated with scripts for Linux and Windows.

### Linux

Run the `install-linux.sh` script as root. This will:

1.  Install Docker and Docker Compose if they are not already installed.
2.  Create the necessary directories.
3.  Generate SSL certificates for development.
4.  Create a `.env` file from the template.
5.  Build the Docker images.
6.  Create a systemd service to manage the application.
7.  Start the application.

### Windows

Run the `install-windows.ps1` script as an administrator. This will:

1.  Check if Docker Desktop is installed.
2.  Create the necessary directories.
3.  Generate SSL certificates for development.
4.  Create a `.env` file from the template.
5.  Build the Docker images.
6.  Create a Windows service to manage the application.
7.  Start the application.

## Configuration

The application is configured using environment variables in a `.env` file. The installation scripts create a `.env` file from the `.env.production.template` file.

### Required Environment Variables

- `POSTGRES_PASSWORD`: The password for the PostgreSQL database.
- `REDIS_PASSWORD`: The password for the Redis cache.
- `JWT_SECRET`: The secret for signing JWTs.
- `DOMAIN`: The domain name or IP address of the server.

## Services

The application is composed of the following services:

- **`caddy`**: The Caddy reverse proxy.
- **`frontend`**: The Next.js frontend.
- **`backend`**: The NestJS backend.
- **`postgres`**: The PostgreSQL database.
- **`redis`**: The Redis cache.

These services are defined in the `docker-compose.production.yml` file.

## SSL Certificates

For development, SSL certificates are generated automatically by the installation scripts. For production, it is recommended to use a trusted certificate authority like Let's Encrypt. Caddy can automatically obtain and renew certificates from Let's Encrypt.

## Health Checks

The `tests/` directory contains health check scripts for Linux and Windows. These scripts check the status of the different services and provide a summary of the application's health.

## Troubleshooting

### Container Issues

- **Container won't start**: Check the container's logs for errors.
- **Container keeps restarting**: Check the container's health check.

### Network Issues

- **Cannot access application**: Check the firewall settings.
- **Internal service communication failing**: Check the Docker network.

### Database Issues

- **Database connection failed**: Check the database credentials in the `.env` file.
- **Database performance issues**: Check the database logs for slow queries.

## Best Practices

### Docker

- **Use multi-stage builds** to create small and secure images.
- **Run containers as a non-root user**.
- **Use a `.dockerignore` file** to exclude unnecessary files from the build context.
- **Scan images for vulnerabilities**.

### Caddy

- **Use persistent volumes** for TLS certificates.
- **Enable logging** to facilitate debugging.
- **Secure the Caddyfile** by restricting file permissions.
- **Use separate site blocks** for different sites.

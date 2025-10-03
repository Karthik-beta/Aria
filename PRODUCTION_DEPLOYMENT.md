# Production Deployment Guide

This guide covers security best practices and deployment strategies for the Aria ERP system in production environments.

## Table of Contents

- [Security Checklist](#security-checklist)
- [SSL/TLS Certificate Management](#ssltls-certificate-management)
- [Secrets Management](#secrets-management)
- [Environment Configuration](#environment-configuration)
- [Deployment Options](#deployment-options)
- [Monitoring & Maintenance](#monitoring--maintenance)

## Security Checklist

Before deploying to production, ensure:

- [ ] Self-signed certificates replaced with trusted CA or Let's Encrypt
- [ ] Private keys NOT committed to version control
- [ ] Environment variables configured via secure method
- [ ] Database credentials rotated from defaults
- [ ] Docker secrets or external secrets manager implemented
- [ ] HTTPS-only enforced with HSTS headers
- [ ] Security headers configured (CSP, X-Frame-Options, etc.)
- [ ] Container images scanned for vulnerabilities
- [ ] Network policies and firewalls configured
- [ ] Logging and monitoring enabled
- [ ] Backup and disaster recovery plan in place
- [ ] Rate limiting and DDoS protection configured

## SSL/TLS Certificate Management

### ⚠️ Critical Security Requirements

1. **Development certificates MUST NOT be used in production**
2. **Private keys MUST NOT be committed to git**
3. **Certificates MUST be from a trusted Certificate Authority**

### Option 1: Let's Encrypt (Recommended)

**Pros**: Free, automated, trusted by all browsers

**Setup**:

1. Update `docker-compose.yml`:

```yaml
services:
  traefik:
    command:
      - '--providers.docker=true'
      - '--providers.file.directory=/etc/traefik/dynamic'
      - '--providers.file.watch=true'
      - '--entrypoints.web.address=:80'
      - '--entrypoints.websecure.address=:443'
      - '--entrypoints.web.http.redirections.entrypoint.to=websecure'
      - '--entrypoints.web.http.redirections.entrypoint.scheme=https'
      # Let's Encrypt configuration
      - '--certificatesresolvers.letsencrypt.acme.email=your-email@example.com'
      - '--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json'
      - '--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web'
    volumes:
      - '/var/run/docker.sock:/var/run/docker.sock:ro'
      - './traefik/dynamic:/etc/traefik/dynamic:ro'
      - './letsencrypt:/letsencrypt'
    ports:
      - '80:80'
      - '443:443'
```

2. Update `traefik/dynamic/static-ip-routes.yml`:

```yaml
http:
  routers:
    backend-static:
      rule: 'Host(`yourdomain.com`) && PathPrefix(`/api`)'
      service: backend
      middlewares:
        - backend-stripprefix
      tls:
        certResolver: letsencrypt

    asset-static:
      rule: 'Host(`yourdomain.com`) && PathPrefix(`/asset`)'
      service: asset
      tls:
        certResolver: letsencrypt
```

3. Ensure port 80 is accessible for HTTP-01 challenge

4. Start services - Traefik will automatically obtain certificates

**Certificate Renewal**: Automatic (every 60 days)

### Option 2: Commercial CA Certificate

**Pros**: Flexibility, longer validity periods, organization validation

**Setup**:

1. Purchase certificate from trusted CA (DigiCert, GlobalSign, etc.)

2. Store certificates securely (see Secrets Management section)

3. Use Docker secrets:

```yaml
services:
  traefik:
    secrets:
      - traefik_cert
      - traefik_key
    volumes:
      - './traefik/dynamic:/etc/traefik/dynamic:ro'

secrets:
  traefik_cert:
    file: /secure/path/to/server.crt
  traefik_key:
    file: /secure/path/to/server.key
```

4. Update `traefik/dynamic/tls.yml`:

```yaml
tls:
  certificates:
    - certFile: /run/secrets/traefik_cert
      keyFile: /run/secrets/traefik_key
```

**Certificate Renewal**: Manual (typically annual)

### Option 3: Internal CA (Enterprise)

**Pros**: Control over issuance, no external dependencies

**Setup**:

1. Use your organization's PKI infrastructure

2. Generate certificates with proper SAN entries:

```bash
openssl req -new -key server.key -out server.csr -config openssl.conf -extensions v3_req
```

3. Submit CSR to internal CA

4. Deploy using Docker secrets or vault integration

## Secrets Management

### Level 1: Environment Variables (Basic)

**Use case**: Small deployments, testing

```bash
# .env (NEVER commit this file)
POSTGRES_PASSWORD=strong_random_password
DATABASE_URL=postgresql://aria:password@postgres:5432/aria
```

**Limitations**:
- Environment variables visible in `docker inspect`
- Not encrypted at rest
- Manual rotation required

### Level 2: Docker Secrets (Better)

**Use case**: Docker Swarm deployments

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    secrets:
      - db_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password

  backend:
    secrets:
      - db_password

secrets:
  db_password:
    external: true
```

Create secrets:

```bash
echo "strong_password" | docker secret create db_password -
```

**Benefits**:
- Encrypted at rest in Swarm mode
- Not visible in logs or `docker inspect`
- Can be rotated without downtime

### Level 3: External Secrets Manager (Production)

**Use case**: Enterprise production environments

#### AWS Secrets Manager

```yaml
services:
  backend:
    environment:
      AWS_REGION: us-east-1
      DB_SECRET_ARN: arn:aws:secretsmanager:region:account:secret:aria/db
```

Application code fetches secrets at runtime:

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });
const response = await client.send(
  new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN })
);
```

#### HashiCorp Vault

```yaml
services:
  backend:
    environment:
      VAULT_ADDR: https://vault.example.com
      VAULT_ROLE: aria-backend
```

Use Vault Agent sidecar or SDK:

```typescript
import vault from 'node-vault';

const vaultClient = vault({
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN
});

const secrets = await vaultClient.read('secret/data/aria/db');
```

#### Azure Key Vault

```yaml
services:
  backend:
    environment:
      AZURE_KEY_VAULT_NAME: aria-vault
      AZURE_CLIENT_ID: ${AZURE_CLIENT_ID}
      AZURE_CLIENT_SECRET: ${AZURE_CLIENT_SECRET}
      AZURE_TENANT_ID: ${AZURE_TENANT_ID}
```

#### Google Secret Manager

```yaml
services:
  backend:
    environment:
      GCP_PROJECT_ID: aria-project
      GOOGLE_APPLICATION_CREDENTIALS: /secrets/gcp-key.json
```

## Environment Configuration

### Configuration Hierarchy

1. **Default values** (in code)
2. **Environment-specific files** (`.env.production`)
3. **Environment variables** (container runtime)
4. **Secrets manager** (highest priority)

### Best Practices

1. **Separate environments**:
   - `docker-compose.yml` - development
   - `docker-compose.prod.yml` - production overrides

2. **Use `.env.example`** for documentation:
   ```bash
   cp .env.example .env
   # Edit .env with actual values
   ```

3. **Validate required variables** at startup:
   ```typescript
   const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];
   requiredVars.forEach(varName => {
     if (!process.env[varName]) {
       throw new Error(`Missing required env var: ${varName}`);
     }
   });
   ```

4. **Never log secrets**:
   ```typescript
   // ❌ BAD
   console.log('Config:', process.env);
   
   // ✅ GOOD
   console.log('Config loaded:', Object.keys(process.env));
   ```

## Deployment Options

### Option 1: Docker Compose (Single Server)

**Best for**: Small to medium deployments, single server

```bash
# Production compose file
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**Requirements**:
- Server with Docker and Docker Compose
- Proper firewall configuration
- Regular backup strategy

### Option 2: Docker Swarm (Multi-Server)

**Best for**: High availability, load balancing

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml aria

# Scale services
docker service scale aria_backend=3
```

**Benefits**:
- Built-in secrets management
- Rolling updates
- Service discovery
- Load balancing

### Option 3: Kubernetes (Enterprise)

**Best for**: Large scale, complex orchestration

```yaml
# kubernetes/deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aria-backend
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: backend
        image: aria/backend:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: aria-secrets
              key: database-url
```

**Tools**:
- Helm charts for package management
- Cert-manager for automatic TLS
- Ingress controller for routing
- Kubernetes secrets or external secrets operator

### Option 4: Cloud PaaS

**Best for**: Minimal infrastructure management

- **AWS ECS/Fargate**: Container orchestration
- **Azure App Service**: Managed platform
- **Google Cloud Run**: Serverless containers
- **DigitalOcean App Platform**: Simple deployment

## Monitoring & Maintenance

### Certificate Monitoring

1. **Expiration alerts**:
   ```bash
   # Check certificate expiry
   openssl x509 -in /etc/ssl/traefik/server.crt -noout -enddate
   ```

2. **Automated monitoring**:
   - Use services like SSL Labs, Uptime Robot
   - Set up alerts 30 days before expiry
   - For Let's Encrypt: monitor renewal logs

### Log Aggregation

Configure centralized logging:

```yaml
services:
  backend:
    logging:
      driver: json-file
      options:
        max-size: '10m'
        max-file: '3'
```

**Production logging solutions**:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Grafana Loki
- Cloud services (AWS CloudWatch, Azure Monitor, Google Cloud Logging)

### Health Checks

Ensure all services have health endpoints:

```yaml
services:
  backend:
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
```

### Backup Strategy

1. **Database backups**:
   ```bash
   # Automated daily backup
   docker exec aria_postgres pg_dump -U aria aria > backup_$(date +%Y%m%d).sql
   ```

2. **Volume backups**:
   ```bash
   # Backup Docker volumes
   docker run --rm -v aria_postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-data.tar.gz /data
   ```

3. **Backup retention**: Keep 7 daily, 4 weekly, 12 monthly

### Update Strategy

1. **Test in staging** environment first
2. **Use rolling updates** to minimize downtime
3. **Keep previous image** for quick rollback:
   ```bash
   # Tag before updating
   docker tag aria/backend:latest aria/backend:backup
   
   # Rollback if needed
   docker tag aria/backend:backup aria/backend:latest
   docker-compose up -d
   ```

## Security Hardening

### Container Security

1. **Run as non-root user**:
   ```dockerfile
   RUN addgroup -S appgroup && adduser -S appuser -G appgroup
   USER appuser
   ```

2. **Use minimal base images**:
   - Alpine Linux (already used)
   - Distroless images

3. **Scan images regularly**:
   ```bash
   docker scan aria/backend:latest
   ```

### Network Security

1. **Firewall rules**:
   ```bash
   # Allow only necessary ports
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw deny 3000/tcp  # Block direct backend access
   ```

2. **Use Docker networks**:
   ```yaml
   networks:
     frontend:
       driver: bridge
     backend:
       driver: bridge
       internal: true  # No external access
   ```

### Application Security

1. **Security headers** (add to Traefik middleware):
   ```yaml
   http:
     middlewares:
       security-headers:
         headers:
           stsSeconds: 31536000
           stsIncludeSubdomains: true
           stsPreload: true
           forceSTSHeader: true
           contentTypeNosniff: true
           browserXssFilter: true
           frameDeny: true
   ```

2. **Rate limiting**:
   ```yaml
   http:
     middlewares:
       rate-limit:
         rateLimit:
           average: 100
           burst: 50
   ```

## Compliance & Auditing

### Audit Logging

Log all security-relevant events:
- Authentication attempts
- Authorization failures
- Configuration changes
- Certificate rotations
- Secret access

### Compliance Frameworks

- **GDPR**: Data protection and privacy
- **SOC 2**: Security controls and monitoring
- **HIPAA**: Healthcare data protection (if applicable)
- **PCI DSS**: Payment data security (if applicable)

## Disaster Recovery

### Recovery Time Objective (RTO)

Target: < 1 hour

1. Keep infrastructure as code (IaC) in version control
2. Maintain automated deployment scripts
3. Document recovery procedures
4. Regular disaster recovery drills

### Recovery Point Objective (RPO)

Target: < 1 hour

1. Automated hourly database backups
2. WAL archiving for PostgreSQL
3. Replicate backups to separate geographic location

### Incident Response Plan

1. **Detection**: Monitoring alerts trigger
2. **Assessment**: Determine severity and impact
3. **Containment**: Isolate affected services
4. **Recovery**: Restore from backup or rollback
5. **Post-mortem**: Document incident and improvements

---

## Quick Production Deployment Checklist

Before going live:

- [ ] SSL/TLS certificates configured (Let's Encrypt or CA)
- [ ] Private keys secured (not in git, using secrets management)
- [ ] Environment variables configured
- [ ] Database credentials rotated
- [ ] Backups automated and tested
- [ ] Monitoring and alerting configured
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] Firewall rules applied
- [ ] Health checks working
- [ ] Logs aggregated centrally
- [ ] Disaster recovery plan documented and tested
- [ ] Performance testing completed
- [ ] Security audit completed
- [ ] Documentation updated

---

**Last Updated**: December 2024  
**Maintained by**: Aria Development Team

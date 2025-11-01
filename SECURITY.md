# Security Best Practices - Aria ERP

Quick reference for maintaining security across the Aria ERP monorepo.

## 🔐 Certificate Management

### Development

- ✅ Use self-signed certificates included in repo
- ✅ Certificates are in `.gitignore` patterns
- ⚠️ Private keys should be regenerated locally if needed

### Production

- ❌ **NEVER** use development certificates in production
- ✅ Use Let's Encrypt (recommended - free, automated)
- ✅ Use commercial CA certificates (for organizations)
- ✅ Store private keys securely in deployment environment
- ✅ Monitor certificate expiration (30-day alerts)
- ✅ Implement automatic renewal workflows

**Reference**: See `deployment/docs/CONFIGURATION.md` for SSL/TLS configuration in production

## 🔑 Secrets Management

### Never Commit These to Git

- ❌ Private keys (`.key`, `.pem` files)
- ❌ Passwords or API keys in code
- ❌ `.env` files with real credentials
- ❌ Database connection strings with passwords
- ❌ JWT secrets or encryption keys

### Use These Instead

- ✅ `.env.example` for documentation (no real values)
- ✅ Environment variables at runtime
- ✅ Docker secrets (Swarm mode)
- ✅ External secrets managers (Vault, AWS Secrets Manager, Azure Key Vault)
- ✅ CI/CD secret stores (GitHub Secrets, GitLab CI Variables)

**Reference**: See `deployment/docs/CONFIGURATION.md` for production secrets management

## 🛡️ Container Security

### Dockerfile Best Practices

- ✅ Use official base images (`node:24-alpine`)
- ✅ Multi-stage builds to minimize attack surface
- ✅ Run as non-root user
- ✅ Scan images for vulnerabilities (`docker scan`)
- ✅ Keep base images updated
- ❌ Don't install unnecessary packages
- ❌ Don't expose internal ports unnecessarily

### Runtime Security

- ✅ Use Docker networks to isolate services
- ✅ Run containers with read-only filesystems where possible
- ✅ Set resource limits (CPU, memory)
- ✅ Enable Docker Content Trust
- ❌ Don't run privileged containers
- ❌ Don't mount sensitive host directories

## 🌐 Network Security

### Traefik Configuration

- ✅ HTTPS-only (redirect HTTP → HTTPS)
- ✅ Enable HSTS headers
- ✅ Configure security headers (CSP, X-Frame-Options)
- ✅ Implement rate limiting
- ✅ Use internal Docker networks for backend communication
- ❌ Don't expose unnecessary ports to host

### Firewall Rules

```bash
# Allow only HTTPS
ufw allow 443/tcp

# Allow HTTP for Let's Encrypt challenge
ufw allow 80/tcp

# Block direct access to application ports
ufw deny 3000/tcp
```

## 🔍 Monitoring & Auditing

### What to Monitor

- ✅ Failed authentication attempts
- ✅ Certificate expiration dates
- ✅ Unusual access patterns
- ✅ Container health and restart events
- ✅ Resource usage anomalies
- ✅ Security scan results

### Logging Requirements

- ✅ Centralized log aggregation
- ✅ Log security events (auth, authz, config changes)
- ✅ Retain logs per compliance requirements
- ❌ Don't log sensitive data (passwords, tokens, PII)
- ❌ Don't log at excessive verbosity in production

## 📝 Configuration Management

### Environment Variables

```bash
# ✅ GOOD: Use environment variables
DATABASE_URL=${DATABASE_URL}

# ❌ BAD: Hardcode credentials
DATABASE_URL=postgresql://user:password@host/db
```

### Configuration Files

- ✅ Use `.env.example` for templates
- ✅ Document all required variables
- ✅ Validate required variables at startup
- ✅ Use different configs per environment
- ❌ Don't commit `.env` files
- ❌ Don't hardcode secrets in code

## 🔄 Update & Patch Management

### Regular Updates

- ✅ Update dependencies monthly (security patches weekly)
- ✅ Use `pnpm audit` to check for vulnerabilities
- ✅ Subscribe to security advisories
- ✅ Test updates in staging before production
- ✅ Have rollback plan ready

### Docker Images

```bash
# Check for vulnerabilities
docker scan aria/backend:latest

# Update base images regularly
docker pull node:24-alpine
docker-compose build
```

## 💾 Backup & Recovery

### What to Backup

- ✅ Database (automated daily backups)
- ✅ Docker volumes (persistent data)
- ✅ Configuration files (in version control)
- ✅ Secrets (in encrypted backup, separate from code)

### Recovery Testing

- ✅ Test backup restoration quarterly
- ✅ Document recovery procedures
- ✅ Measure and maintain RTO/RPO targets
- ✅ Practice disaster recovery drills

**Reference**: See `deployment/docs/CONFIGURATION.md` for backup and restore procedures

## 🧪 Security Testing

### Before Each Release

- ✅ Dependency vulnerability scan (`pnpm audit`)
- ✅ Container image scan (`docker scan`)
- ✅ Static analysis (ESLint security rules)
- ✅ Authentication/authorization testing
- ✅ Input validation testing

### Periodic Security Audits

- ✅ Penetration testing (annually)
- ✅ Code security review (quarterly)
- ✅ Access control audit (quarterly)
- ✅ Secrets rotation (per policy)

## 📋 Pre-Production Checklist

Before deploying to production:

- [ ] SSL/TLS from trusted CA configured
- [ ] All private keys secured (not in git)
- [ ] Environment variables properly configured
- [ ] Default credentials changed
- [ ] Secrets management implemented
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] Firewall rules applied
- [ ] Monitoring and alerting active
- [ ] Backup automation tested
- [ ] Logs centralized
- [ ] Disaster recovery plan documented
- [ ] Security audit completed
- [ ] Vulnerability scans passed

## 🆘 Incident Response

### If a Security Incident Occurs

1. **Immediate Actions**:
   - Isolate affected systems
   - Preserve evidence (logs, memory dumps)
   - Activate incident response team

2. **Assessment**:
   - Determine scope and impact
   - Identify compromised systems/data
   - Document timeline

3. **Containment**:
   - Block attack vectors
   - Reset compromised credentials
   - Apply emergency patches

4. **Recovery**:
   - Restore from clean backups
   - Rebuild compromised systems
   - Verify system integrity

5. **Post-Incident**:
   - Conduct post-mortem analysis
   - Update security controls
   - Notify affected parties if required
   - Document lessons learned

## 📚 Additional Resources

- [deployment/README.md](./deployment/README.md) - On-premise deployment overview
- [deployment/docs/INSTALLATION.md](./deployment/docs/INSTALLATION.md) - Installation guide
- [deployment/docs/CONFIGURATION.md](./deployment/docs/CONFIGURATION.md) - Configuration reference including SSL/TLS
- [caddy/certs/README.md](./caddy/certs/README.md) - Certificate management for development

## 🤝 Security Contact

For security vulnerabilities or concerns:

- **DO NOT** create public GitHub issues
- Contact: [security@ariaerp.example.com](mailto:security@ariaerp.example.com)
- Use encrypted communication when sharing sensitive details

---

**Remember**: Security is everyone's responsibility. When in doubt, ask before deploying!

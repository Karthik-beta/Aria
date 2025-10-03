# SSL/TLS Certificates

This directory contains SSL/TLS certificates for HTTPS support in the Aria ERP system.

## ⚠️ SECURITY WARNINGS

### Development vs. Production

**The certificates in this directory are ONLY for local development and MUST NOT be used in production.**

- ✅ **Development**: Self-signed certificates are acceptable for local testing
- ❌ **Production**: Use trusted CA certificates or Let's Encrypt instead

### Private Key Security

**⚠️ CRITICAL**: Private keys (`.key`, `.pem` files) should NEVER be committed to version control.

- The included `server.key` is for development convenience only
- For production, use:
  - Docker secrets (`docker secret create`)
  - Environment variables pointing to mounted volumes
  - External secrets management (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault)
  - Traefik's ACME/Let's Encrypt integration (no manual keys needed)

## Files

### Active Certificates

- **`server.crt`** - Public SSL certificate (self-signed for development)
- **`server.key`** - Private key for SSL certificate (⚠️ DEV ONLY - excluded from git)
- **`openssl.conf`** - OpenSSL configuration for certificate generation

## Certificate Details

The included certificates are self-signed and configured for local development:

- **Key Size**: 4096-bit RSA
- **Validity**: 365 days from generation
- **Subject**: CN=localhost
- **SAN (Subject Alternative Names)**:
  - DNS: localhost
  - DNS: asset
  - DNS: backend
  - DNS: crm
  - DNS: hrms
  - DNS: inventory
  - DNS: traefik
  - DNS: postgres
  - IP: 127.0.0.1

## Regenerating Certificates

If you need to regenerate the certificates (e.g., after expiration):

### Windows (using Git's OpenSSL)

```powershell
cd traefik/certs
& "C:\Program Files\Git\usr\bin\openssl.exe" req -x509 -nodes -days 365 -newkey rsa:4096 `
  -keyout server.key -out server.crt -config openssl.conf `
  -extensions v3_req
```

### Linux/Mac

```bash
cd traefik/certs
openssl req -x509 -nodes -days 365 -newkey rsa:4096 \
  -keyout server.key -out server.crt -config openssl.conf \
  -extensions v3_req
```

## Production Deployment

**⚠️ CRITICAL WARNING**: The self-signed certificates are for development only and will trigger browser security warnings.

### Production Certificate Options

For production deployments, you MUST use one of these options:

#### Option 1: Let's Encrypt (Recommended - Free & Automated)

Configure Traefik ACME integration in `docker-compose.yml`:

```yaml
command:
  - '--certificatesresolvers.letsencrypt.acme.email=your-email@example.com'
  - '--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json'
  - '--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web'
volumes:
  - './letsencrypt:/letsencrypt'
```

Then update router configurations to use the resolver:

```yaml
routers:
  backend-static:
    tls:
      certResolver: letsencrypt
```

**Benefits**:
- Free, automated certificate issuance and renewal
- Trusted by all browsers
- Renews automatically every 60 days

#### Option 2: Docker Secrets (For Commercial/Internal CA Certificates)

**NEVER** put production certificates directly in this directory.

1. Store certificates securely outside the repository
2. Use Docker secrets:

```yaml
# docker-compose.yml
services:
  traefik:
    secrets:
      - traefik_cert
      - traefik_key

secrets:
  traefik_cert:
    file: /secure/external/path/server.crt
  traefik_key:
    file: /secure/external/path/server.key
```

3. Update `traefik/dynamic/tls.yml`:

```yaml
tls:
  certificates:
    - certFile: /run/secrets/traefik_cert
      keyFile: /run/secrets/traefik_key
```

#### Option 3: External Secrets Manager

Use enterprise secrets management systems:
- AWS Secrets Manager
- Azure Key Vault  
- HashiCorp Vault
- Google Secret Manager

See [PRODUCTION_DEPLOYMENT.md](../../PRODUCTION_DEPLOYMENT.md#secrets-management) for detailed configuration.

## Security Best Practices

### 🔴 Critical Security Rules

1. **NEVER commit production private keys to version control**
   - The included `server.key` is excluded from git via `.gitignore`
   - This file is for development convenience only

2. **NEVER use development certificates in production**
   - Self-signed certificates will cause browser warnings
   - Users may ignore security warnings, creating vulnerabilities

3. **NEVER reuse private keys across environments**
   - Generate unique keys for dev, staging, and production

### ✅ Recommended Practices

1. **Use Docker secrets or environment variables** for production credentials
2. **Rotate certificates before expiration** (Let's Encrypt auto-renews)
3. **Use 4096-bit RSA or 256-bit ECDSA** key sizes minimum
4. **Enable TLS 1.2+ only** (configured in `traefik/dynamic/tls.yml`)
5. **Monitor certificate expiration dates** (set 30-day alerts)
6. **Set proper file permissions**:
   ```bash
   chmod 600 server.key  # Private key readable only by owner
   chmod 644 server.crt  # Public certificate readable by all
   ```

### 📚 Additional Resources

- [PRODUCTION_DEPLOYMENT.md](../../PRODUCTION_DEPLOYMENT.md) - Complete production deployment guide
- [SECURITY.md](../../SECURITY.md) - Security best practices quick reference
- [DOCKER_HTTPS_SETUP.md](../../DOCKER_HTTPS_SETUP.md) - HTTPS setup documentation

## Verifying Certificates

Check certificate details:

```bash
# View certificate information
openssl x509 -in server.crt -text -noout

# Verify certificate matches private key
openssl x509 -noout -modulus -in server.crt | openssl md5
openssl rsa -noout -modulus -in server.key | openssl md5
# The MD5 hashes should match

# Check certificate validity dates
openssl x509 -noout -dates -in server.crt
```

## Troubleshooting

### "Failed to find any PEM data in certificate input"

**Cause**: Certificate file is corrupted or not in PEM format

**Solution**:

- Regenerate certificates using commands above
- Ensure files use LF line endings (not CRLF)
- Verify files aren't empty: `cat server.crt`

### "Certificate has expired"

**Cause**: Certificate validity period has passed

**Solution**: Regenerate certificates with the commands above

### "NET::ERR_CERT_AUTHORITY_INVALID" in browser

**Cause**: Self-signed certificate is not trusted

**Solution**:

- Expected behavior for self-signed certs
- Accept the warning for development
- Use production certificates for public deployment

## References

- [OpenSSL Documentation](https://www.openssl.org/docs/)
- [Traefik TLS Configuration](https://doc.traefik.io/traefik/https/tls/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)

---

**Last Updated**: 2025  
**Security Notice**: Review and update certificates before production deployment

# SSL/TLS Certificates

This directory contains SSL/TLS certificates for HTTPS support in the Aria ERP system.

## Files

### Active Certificates

- **`server.crt`** - Public SSL certificate (self-signed for development)
- **`server.key`** - Private key for SSL certificate
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

**⚠️ WARNING**: The self-signed certificates are for development only and will trigger browser security warnings.

For production, you have two options:

### Option 1: Let's Encrypt (Automated)

Configure Traefik ACME integration in `docker-compose.yml`:

```yaml
command:
  - '--certificatesresolvers.letsencrypt.acme.tlschallenge=true'
  - '--certificatesresolvers.letsencrypt.acme.email=your-email@example.com'
  - '--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json'
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

### Option 2: Commercial Certificate

1. Obtain certificate and private key from your CA
2. Replace `server.crt` and `server.key` with production files
3. Update ownership/permissions:
   ```bash
   chmod 600 server.key
   chmod 644 server.crt
   ```

## Security Best Practices

1. **Never commit production private keys** to version control
2. Use Docker secrets or environment variables for production credentials
3. Rotate certificates before expiration
4. Use 2048-bit or higher key sizes
5. Enable TLS 1.2+ only (configured in `traefik/dynamic/tls.yml`)
6. Monitor certificate expiration dates

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

# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Aria ERP, report it immediately through internal channels.

### How to Report

1. **Do not** create a public GitHub issue for security vulnerabilities
2. **Contact** the engineering lead directly via email: **karthikpar@protonmail.com**
3. **Subject line**: `[SECURITY] Aria ERP — Brief description`
4. **Include**:
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact and severity assessment
   - Suggested fix (if any)

### Response Timeline

| Stage           | Timeline     |
| --------------- | ------------ |
| Acknowledgment  | 48 hours     |
| Initial triage  | 7 days       |
| Critical fix    | 30 days      |
| Non-critical fix| Next release |

## Security Practices

All team members must follow these practices when contributing:

### Secrets Management

- **Never commit secrets** — API keys, passwords, tokens, and credentials must use environment variables
- Use `.env` files locally (already in `.gitignore`)
- Reference `.env.example` / `.env.development.template` for required variables
- Rotate secrets immediately if accidentally committed

### Input Validation

- Validate and sanitize all user inputs at system boundaries (API endpoints, form submissions)
- Use Prisma's parameterized queries — never construct raw SQL with string interpolation
- Apply DTOs and validation pipes in NestJS controllers

### Authentication and Authorization

- All API endpoints must enforce authentication unless explicitly public
- Follow the authorization model provided by better-auth's admin plugin
- Never store passwords in plain text — use proper hashing (handled by better-auth)

### Dependency Security

- Review dependency updates for known CVEs before merging
- Run `bun audit` periodically to check for vulnerable packages
- Pin major versions of critical dependencies

### Code Review

- All changes require at least one review before merging
- Security-sensitive changes (auth, payments, data access) require extra scrutiny
- Watch for OWASP Top 10 vulnerabilities during review:
  - Injection (SQL, NoSQL, command)
  - Broken authentication
  - Sensitive data exposure
  - Broken access control
  - Security misconfiguration
  - Cross-site scripting (XSS)
  - Insecure deserialization

### Infrastructure

- Keep Docker images minimal with multi-stage builds
- TLS/HTTPS enforced in production via Caddy
- Database connections use SSL in production
- Follow the principle of least privilege for service accounts

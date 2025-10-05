# Support

Thank you for using Aria ERP! This document provides guidance on how to get help and support.

## Documentation

Before seeking support, please check our comprehensive documentation:

- **[Getting Started Guide](./docs/getting-started.md)** - Setup and installation
- **[FAQ](./docs/faq.md)** - Common questions and troubleshooting
- **[Architecture Guide](./docs/architecture.md)** - System design and technical details
- **[Deployment Guide](./docs/deployment.md)** - Production deployment
- **[Troubleshooting](./deployment/docs/TROUBLESHOOTING.md)** - Common issues and solutions

## Community Support

### GitHub Discussions

For general questions, ideas, and community discussions:

👉 [Start a Discussion](https://github.com/Karthik-beta/Aria/discussions)

**Best for:**

- General questions about Aria ERP
- Feature requests and ideas
- Sharing how you're using Aria
- Getting advice from the community

### GitHub Issues

For bug reports and technical issues:

👉 [Report an Issue](https://github.com/Karthik-beta/Aria/issues/new)

**Before creating an issue:**

1. Search existing issues to avoid duplicates
2. Check the [FAQ](./docs/faq.md) and [Troubleshooting Guide](./deployment/docs/TROUBLESHOOTING.md)
3. Gather relevant information (logs, error messages, system details)
4. Use the provided issue templates

**Best for:**

- Bug reports
- Technical problems
- Feature requests
- Documentation improvements

## Commercial Support

### Enterprise Support

For organizations requiring dedicated support, we offer:

- **Priority Response**: Guaranteed response times
- **Direct Communication**: Email and phone support
- **Custom Integration**: Help with custom deployments
- **Training**: Team training and onboarding
- **SLA Options**: Service level agreements

📧 Contact: [Insert Enterprise Support Email]

### Professional Services

We provide professional services including:

- Custom feature development
- System integration
- Performance optimization
- Security audits
- Migration assistance
- On-site training

📧 Contact: [Insert Professional Services Email]

## Self-Help Resources

### Troubleshooting Guide

Comprehensive troubleshooting for common issues:

👉 [Troubleshooting Guide](./deployment/docs/TROUBLESHOOTING.md)

**Covers:**

- Installation problems
- Service startup failures
- Database connection issues
- Performance problems
- SSL/TLS certificate issues

### FAQ

Frequently asked questions and quick solutions:

👉 [FAQ](./docs/faq.md)

**Includes:**

- Setup and installation
- Development workflows
- TypeScript and testing
- Deployment strategies
- Common error messages

### Community Resources

- **[Contribution Guide](./CONTRIBUTING.md)** - How to contribute
- **[Development Agents](./AGENTS.md)** - Development philosophy
- **[Security Policy](./SECURITY.md)** - Security guidelines

## Reporting Security Vulnerabilities

**⚠️ Do not report security vulnerabilities through public GitHub issues.**

Please report security issues responsibly:

👉 Follow our [Security Policy](./SECURITY.md)

**Include:**

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We take security seriously and will respond promptly to security reports.

## Response Times

### Community Support (GitHub)

- **General Questions**: 24-72 hours
- **Bug Reports**: 48-96 hours
- **Feature Requests**: Reviewed weekly

_Note: These are guidelines, not guarantees. Response times may vary._

### Commercial Support

Response times vary by support tier. Contact us for details.

## Support Checklist

When seeking support, please provide:

- [ ] **Aria ERP version** - From package.json or release tag
- [ ] **Environment** - OS (Linux/Windows), Node.js version
- [ ] **Issue description** - Clear, concise explanation
- [ ] **Steps to reproduce** - How to recreate the issue
- [ ] **Expected behavior** - What should happen
- [ ] **Actual behavior** - What actually happens
- [ ] **Logs** - Relevant error messages and logs
- [ ] **Configuration** - Relevant config (remove secrets!)
- [ ] **Screenshots** - If applicable

## Language Support

- **Primary Language**: English
- **Documentation**: English
- **Community**: Primarily English

## Contribution

The best way to get support is often to contribute!

- Fix bugs you encounter
- Improve documentation
- Answer community questions
- Share your experiences

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to contribute.

## Stay Updated

- **⭐ Star** the repository on GitHub
- **👀 Watch** for release notifications
- **📢 Follow** project announcements

## Useful Commands

Quick reference for common support-related commands:

```bash
# Check version
cat package.json | grep version

# View logs (Docker)
docker-compose logs -f [service-name]

# Run health check (Linux)
sudo bash deployment/scripts/monitoring/health-check.sh

# Run health check (Windows)
.\deployment\scripts\monitoring\health-check.ps1

# Test build
pnpm build

# Run tests
pnpm test
```

## External Resources

- **NestJS**: https://docs.nestjs.com/
- **Next.js**: https://nextjs.org/docs
- **TypeScript**: https://www.typescriptlang.org/docs/
- **Docker**: https://docs.docker.com/
- **pnpm**: https://pnpm.io/

---

**Thank you for being part of the Aria ERP community!**

If you have suggestions for improving this support document, please open an issue or pull request.

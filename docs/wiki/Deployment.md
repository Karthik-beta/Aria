# Deployment

| Target | How |
|---|---|
| Windows demo or single PC | [Aria ERP Setup](Getting-Started#demo-on-windows-aria-erp-setup) (Docker Desktop, `docker-compose.local.yml`) |
| Linux or Windows server | `docker-compose.production.yml` with release images, installed as a systemd unit or Windows service |
| Railway | Backend and frontend `railway.json`, gated on CI |

## Production with Docker Compose

`docker-compose.production.yml` runs Caddy (TLS and reverse proxy), the frontend, a one-shot `migrate` job, the backend, PostgreSQL 18, Redis 7, and Prometheus, Grafana, cAdvisor and node-exporter for monitoring.

Images are published to GitHub Container Registry:

```
ghcr.io/karthik-beta/aria-backend:<version>
ghcr.io/karthik-beta/aria-frontend:<version>
```

Pin the release in `.env` with `VERSION=X.Y.Z`. To upgrade, change `VERSION` and restart; the `migrate` job applies database migrations before the backend starts.

Install scripts: `deployment/scripts/install-linux.sh` (systemd) and `deployment/scripts/install-windows.ps1` (Windows service).

## Further reading

- [Deployment documentation](https://github.com/Karthik-beta/Aria/blob/master/docs/05-deployment/README.md): full production guide, Railway, monitoring, recovery
- [Local deployment and Aria ERP Setup](https://github.com/Karthik-beta/Aria/blob/master/deployment/local/README.md)
- [Code signing](https://github.com/Karthik-beta/Aria/blob/master/CODE_SIGNING.md) for the Windows installer
- [Security policy](https://github.com/Karthik-beta/Aria/blob/master/SECURITY.md)

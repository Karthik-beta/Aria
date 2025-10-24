# Docker Development Environment - Access Instructions

## ✅ IMPORTANT: Access Through Caddy

To use the Docker development environment correctly, you **must** access the application through the Caddy reverse proxy at:

```
http://localhost
```

**NOT** at `http://localhost:3000` (the direct frontend port).

## Why This Matters

### Correct Access (Through Caddy)

When you access **`http://localhost`** (port 80):

```
Browser → Caddy (:80) → Routes traffic correctly:
  ├─ /                → frontend:3000  (Next.js app)
  ├─ /trpc/*          → backend:3001   (tRPC HTTP)
  └─ /trpc-ws         → backend:3001   (tRPC WebSocket)
```

✅ HTTP requests: `http://localhost/trpc/...` → Works  
✅ WebSocket: `ws://localhost/trpc-ws` → Works  
✅ Frontend: `http://localhost` → Works

### Incorrect Access (Bypassing Caddy)

When you access **`http://localhost:3000`** directly:

```
Browser → frontend:3000 (bypassing Caddy)
  ├─ /                → frontend:3000  ✅ Works
  ├─ /trpc/*          → frontend:3000  ❌ 404 Not Found
  └─ /trpc-ws         → frontend:3000  ❌ 404 Not Found
```

❌ HTTP requests: `http://localhost:3000/trpc/...` → 404  
❌ WebSocket: `ws://localhost:3000/trpc-ws` → 404  
✅ Frontend: `http://localhost:3000` → Works (but broken functionality)

## Quick Start

1. **Start Docker services**:

   ```powershell
   docker compose -f docker-compose.development.yml up -d
   ```

2. **Open browser to**:

   ```
   http://localhost
   ```

3. **Verify everything works**:
   - Frontend loads correctly
   - Browser console shows: `[WebSocket] ✅ Connected to ws://localhost/trpc-ws`
   - No 404 errors for `/trpc` requests

## Port Mapping Reference

| Service  | Internal Port | External Port | Purpose                     |
| -------- | ------------- | ------------- | --------------------------- |
| Caddy    | 80            | 80            | Reverse proxy (HTTP)        |
| Caddy    | 2019          | 2680          | Admin API                   |
| Frontend | 3000          | 3000          | Next.js dev server (direct) |
| Backend  | 3001          | 3001          | NestJS API (direct)         |
| Postgres | 5432          | 5432          | Database                    |
| Redis    | 6379          | 6379          | Cache                       |

## When To Use Direct Ports

Direct port access (`:3000`, `:3001`) is useful for:

- **Debugging**: Check logs or inspect individual services
- **Testing**: Direct API calls to backend
- **Development**: IDE connections to services

But **for normal usage**, always go through Caddy at `:80`.

## Environment Configuration

### Docker Environment

```yaml
# docker-compose.development.yml
frontend:
  environment:
    - NEXT_PUBLIC_API_URL= # Empty → relative URLs
    - DOCKER=true # Disables Next.js rewrites
```

With empty `NEXT_PUBLIC_API_URL`:

- Browser uses relative URLs: `/trpc/*` → Routed by Caddy
- WebSocket uses current host: `ws://localhost/trpc-ws`

### Local Development (Without Docker)

Create `apps/frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

This allows the frontend to connect directly to the backend when both run via `pnpm dev`.

## Troubleshooting

### Issue: 404 Errors for `/trpc` Requests

**Symptom**:

```
GET http://localhost:3000/trpc/inventory.listItems [404 Not Found]
```

**Solution**: Access through Caddy at `http://localhost`, not `http://localhost:3000`.

---

### Issue: WebSocket Connection Fails

**Symptom**:

```
[WebSocket] ❌ Failed to connect
```

**Solution**:

1. Ensure you're accessing through `http://localhost`
2. Check Caddy logs: `docker logs aria-dev-caddy`
3. Verify backend is healthy: `docker ps` (should show "healthy")

---

### Issue: CORS Errors

**Symptom**:

```
Access to XMLHttpRequest has been blocked by CORS policy
```

**Solution**: This shouldn't happen when accessing through Caddy. If it does:

1. Verify you're at `http://localhost`, not `http://localhost:3000`
2. Check backend CORS configuration in `apps/backend/src/main.ts`

---

## Architecture Summary

```
┌─────────────────────────────────────────────────┐
│  Browser (http://localhost)                     │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Caddy Reverse Proxy (:80)                      │
│  ├─ /           → frontend:3000                 │
│  ├─ /trpc/*     → backend:3001/trpc/*           │
│  └─ /trpc-ws    → backend:3001/trpc-ws (WS)     │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌───────────────┐    ┌────────────────┐
│  Frontend     │    │  Backend       │
│  (Next.js)    │    │  (NestJS)      │
│  :3000        │    │  :3001         │
└───────────────┘    └────────┬───────┘
                              │
                              ▼
                     ┌────────────────┐
                     │  PostgreSQL    │
                     │  :5432         │
                     └────────────────┘
```

## Additional Resources

- [Docker WebSocket Fix](./DOCKER_WEBSOCKET_FIX.md) - Technical details
- [Windows Port Exclusion Fix](./WINDOWS_PORT_EXCLUSION_FIX.md) - Port binding issues
- [Caddy Documentation](https://caddyserver.com/docs/) - Reverse proxy configuration
- [tRPC WebSocket Guide](https://trpc.io/docs/server/websockets) - Official tRPC docs

---

**Last Updated**: October 24, 2025  
**Status**: ✅ Working

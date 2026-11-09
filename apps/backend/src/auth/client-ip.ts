import type { NextFunction, Request, Response } from "express";

/**
 * Internal header carrying the resolved client IP to Better Auth.
 *
 * Better Auth reads the left-most entry of the configured IP headers without
 * checking who set it, so pointing it at `x-forwarded-for` would let any client
 * that reaches the backend directly pick its own rate-limit bucket. Instead,
 * {@link clientIpMiddleware} always overwrites this header with Express's
 * `req.ip`, which only honours `X-Forwarded-For` hops from trusted proxies.
 */
export const CLIENT_IP_HEADER = "x-aria-client-ip";

/**
 * Peers whose `X-Forwarded-For` is trusted (Express `trust proxy` syntax).
 *
 * Defaults to private ranges so Caddy and the Next.js server work out of the
 * box in Docker (bridge networks) and native installs (loopback). Set
 * `TRUSTED_PROXIES` (comma-separated IPs/CIDRs or presets) to narrow it, e.g.
 * when the backend port is reachable from other hosts on a private LAN.
 */
export const DEFAULT_TRUSTED_PROXIES = "loopback, linklocal, uniquelocal";

export function resolveTrustedProxies(
	raw: string | undefined = process.env.TRUSTED_PROXIES,
): string[] {
	const value = raw?.trim() ? raw : DEFAULT_TRUSTED_PROXIES;
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

/**
 * Replaces any client-supplied {@link CLIENT_IP_HEADER} with the client IP
 * Express resolved from the socket and trusted proxy hops.
 */
export function clientIpMiddleware(
	req: Request,
	_res: Response,
	next: NextFunction,
): void {
	const ip = req.ip ?? req.socket.remoteAddress;
	if (ip) {
		req.headers[CLIENT_IP_HEADER] = ip;
	} else {
		delete req.headers[CLIENT_IP_HEADER];
	}
	next();
}

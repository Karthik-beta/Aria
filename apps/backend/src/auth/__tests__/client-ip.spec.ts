import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import {
	CLIENT_IP_HEADER,
	clientIpMiddleware,
	DEFAULT_TRUSTED_PROXIES,
	resolveTrustedProxies,
} from "../client-ip.js";

describe("resolveTrustedProxies", () => {
	it("defaults to private ranges", () => {
		expect(resolveTrustedProxies(undefined)).toEqual(
			DEFAULT_TRUSTED_PROXIES.split(", "),
		);
		expect(resolveTrustedProxies("  ")).toEqual(
			DEFAULT_TRUSTED_PROXIES.split(", "),
		);
	});

	it("parses a comma-separated override", () => {
		expect(resolveTrustedProxies("10.0.0.5, 172.18.0.0/16,")).toEqual([
			"10.0.0.5",
			"172.18.0.0/16",
		]);
	});
});

function startServer(trustProxy: string[]): Promise<Server> {
	const app = express();
	app.set("trust proxy", trustProxy);
	app.use(clientIpMiddleware, (req, res) => {
		res.json({ ip: req.headers[CLIENT_IP_HEADER] ?? null });
	});
	return new Promise((resolve) => {
		const server = app.listen(0, "127.0.0.1", () => resolve(server));
	});
}

async function resolvedIp(
	server: Server,
	headers: Record<string, string>,
): Promise<string | null> {
	const { port } = server.address() as AddressInfo;
	const response = await fetch(`http://127.0.0.1:${port}/`, { headers });
	return ((await response.json()) as { ip: string | null }).ip;
}

describe("clientIpMiddleware", () => {
	let trustedServer: Server;
	let untrustedServer: Server;

	beforeAll(async () => {
		// The test client connects from loopback: a trusted proxy hop here...
		trustedServer = await startServer(["loopback"]);
		// ...and an untrusted direct caller here.
		untrustedServer = await startServer(["10.255.255.1"]);
	});

	afterAll(() => {
		trustedServer.close();
		untrustedServer.close();
	});

	it("uses X-Forwarded-For from a trusted proxy", async () => {
		expect(
			await resolvedIp(trustedServer, { "x-forwarded-for": "203.0.113.7" }),
		).toBe("203.0.113.7");
	});

	it("skips spoofed entries a trusted proxy appended to", async () => {
		expect(
			await resolvedIp(trustedServer, {
				"x-forwarded-for": "198.51.100.1, 203.0.113.7",
			}),
		).toBe("203.0.113.7");
	});

	it("ignores X-Forwarded-For from an untrusted direct caller", async () => {
		const ip = await resolvedIp(untrustedServer, {
			"x-forwarded-for": "203.0.113.7",
		});
		expect(ip).not.toBe("203.0.113.7");
		expect(ip).toContain("127.0.0.1");
	});

	it("overwrites a client-supplied client IP header", async () => {
		const ip = await resolvedIp(untrustedServer, {
			[CLIENT_IP_HEADER]: "203.0.113.7",
		});
		expect(ip).not.toBe("203.0.113.7");
		expect(ip).toContain("127.0.0.1");
	});
});

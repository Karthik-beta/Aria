import { describe, expect, it, mock } from "bun:test";
import {
	deployMigrations,
	resolveDatabaseTarget,
} from "./migration-preflight.js";

describe("resolveDatabaseTarget", () => {
	it("rejects missing and malformed database URLs", () => {
		expect(() => resolveDatabaseTarget(undefined)).toThrow(
			"DATABASE_URL is required",
		);
		expect(() => resolveDatabaseTarget("not-a-url")).toThrow(
			"valid PostgreSQL URL",
		);
		expect(() =>
			resolveDatabaseTarget("https://database.example/aria"),
		).toThrow("postgres or postgresql protocol");
	});

	it("returns only a sanitized host, port, and database name", () => {
		const target = resolveDatabaseTarget(
			"postgresql://aria:super-secret@postgres.railway.internal:6543/aria%20demo?sslmode=require&schema=public",
		);

		expect(target.displayName).toBe("postgres.railway.internal:6543/aria demo");
		expect(target.displayName).not.toContain("aria:super-secret");
		expect(target.displayName).not.toContain("sslmode");
		expect(target.connectionString).toContain("super-secret");
	});
});

describe("deployMigrations", () => {
	const databaseUrl = "postgresql://aria:secret@postgres:5432/aria";

	it("retries connectivity and runs migrations once after PostgreSQL is ready", async () => {
		let connectionAttempts = 0;
		const connect = mock(async () => {
			connectionAttempts += 1;
			if (connectionAttempts < 3) {
				throw Object.assign(new Error("connection refused"), {
					code: "ECONNREFUSED",
				});
			}
		});
		const runMigrations = mock(async () => 0);
		const sleep = mock(async () => undefined);
		const messages: string[] = [];

		await deployMigrations({
			databaseUrl,
			connect,
			runMigrations,
			sleep,
			log: (message) => messages.push(message),
			attempts: 4,
			delayMs: 1,
		});

		expect(connect).toHaveBeenCalledTimes(3);
		expect(sleep).toHaveBeenCalledTimes(2);
		expect(runMigrations).toHaveBeenCalledTimes(1);
		expect(messages.join("\n")).not.toContain("secret");
		expect(messages.join("\n")).not.toContain("connection refused");
	});

	it("fails after bounded readiness retries without running migrations", async () => {
		const connect = mock(async () => {
			throw Object.assign(new Error("connection refused"), {
				code: "ECONNREFUSED",
			});
		});
		const runMigrations = mock(async () => 0);

		await expect(
			deployMigrations({
				databaseUrl,
				connect,
				runMigrations,
				sleep: async () => undefined,
				log: () => undefined,
				attempts: 3,
				delayMs: 0,
			}),
		).rejects.toThrow("after 3 attempts");

		expect(connect).toHaveBeenCalledTimes(3);
		expect(runMigrations).not.toHaveBeenCalled();
	});

	it("does not retry a Prisma migration failure", async () => {
		const connect = mock(async () => undefined);
		const runMigrations = mock(async () => 1);

		await expect(
			deployMigrations({
				databaseUrl,
				connect,
				runMigrations,
				log: () => undefined,
			}),
		).rejects.toThrow("failed with exit code 1");

		expect(connect).toHaveBeenCalledTimes(1);
		expect(runMigrations).toHaveBeenCalledTimes(1);
	});
});
